"""Real-MySQL regression in a newly initialized, disposable local server only."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import time
import tempfile
import shutil
from types import SimpleNamespace

from data_audit import ROOT, query, column_metadata


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--mysql-bin', required=True)
    p.add_argument('--baseline-init', required=True)
    p.add_argument('--work-dir', required=True, help='New dedicated directory; must not exist')
    a = p.parse_args()
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    work = Path(a.work_dir).resolve()
    if work.exists():
        raise SystemExit('Refused: work directory already exists; never reuse an existing data directory.')
    work.mkdir(parents=True)
    # MySQL's Windows binary can truncate non-ASCII datadir arguments. Own a fresh
    # ASCII temporary directory instead of using a project path or installed service.
    owned_temp = Path(tempfile.mkdtemp(prefix='codex-d-data-')).resolve()
    data = owned_temp / 'data'
    mysql_bin = Path(a.mysql_bin).resolve()
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    init = subprocess.run([str(mysql_bin / 'mysqld.exe'), '--no-defaults', '--initialize-insecure',
                           '--basedir=' + str(mysql_bin.parent), '--datadir=' + str(data)],
                          capture_output=True, text=True, creationflags=flags)
    (work / 'initialization.log').write_text(init.stdout + init.stderr, encoding='utf-8')
    if init.returncode:
        raise RuntimeError('Temporary MySQL initialization failed; see initialization.log')
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    server_log = (work / 'server.log').open('w', encoding='utf-8')
    process = subprocess.Popen([str(mysql_bin / 'mysqld.exe'), '--no-defaults',
        '--basedir=' + str(mysql_bin.parent), '--datadir=' + str(data),
        '--bind-address=127.0.0.1', '--port=' + str(port), '--mysqlx=0',
        '--innodb-buffer-pool-size=64M', '--innodb-redo-log-capacity=32M',
        '--pid-file=' + str(owned_temp / 'server.pid'), '--console'],
        stdout=server_log, stderr=subprocess.STDOUT, creationflags=flags)
    args = SimpleNamespace(mysql=str(mysql_bin / 'mysql.exe'), host='127.0.0.1',
                           port=port, user='root', database='mysql')
    results = []

    def passed(name, detail):
        results.append({'check': name, 'passed': True, 'detail': detail})
        print('PASS ' + name, flush=True)

    def count_missing():
        return int(query(args, "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND COLUMN_COMMENT='';").strip())

    def indexes():
        return query(args, 'SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX;')

    def apply(rollback=False, expect_fail=False):
        cmd = [sys.executable, str(ROOT / 'backend/tools/apply_data_comments.py'),
               '--mysql', args.mysql, '--host', args.host, '--port', str(port),
               '--database', args.database]
        if rollback:
            cmd.append('--rollback')
        r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', creationflags=flags)
        if expect_fail:
            assert r.returncode != 0 and 'Refused:' in r.stderr + r.stdout, r.stdout + r.stderr
        else:
            assert r.returncode == 0, r.stdout + r.stderr

    try:
        for attempt in range(100):
            if process.poll() is not None:
                raise RuntimeError('Temporary server exited; inspect server.log')
            try:
                query(args, 'SELECT 1;')
                break
            except RuntimeError:
                time.sleep(0.2)
        else:
            raise RuntimeError('Temporary server did not become ready')
        password = secrets.token_hex(24)
        query(args, "ALTER USER 'root'@'localhost' IDENTIFIED BY '" + password + "';")
        os.environ['MYSQL_PWD'] = password
        source = Path(a.baseline_init).read_text(encoding='utf-8')
        query(args, source)
        args.database = 'dafu'
        baseline = column_metadata(args)
        assert len(baseline) == 191
        # Repository fixture consists of structure only, not user data or credentials.
        fixture = ROOT / 'docs/data/baseline-columns.json'
        if fixture.exists():
            assert json.loads(fixture.read_text(encoding='utf-8')) == baseline
        else:
            fixture.write_text(json.dumps(baseline, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        original_indexes = indexes()
        assert count_missing() == 78
        query(args, "INSERT INTO `user` (id,username,password,nickname) VALUES (70001,'d_data_sentinel','synthetic-only','Synthetic sentinel');")
        before = query(args, 'SELECT id,username,nickname FROM `user` ORDER BY id;')
        apply(); apply()
        assert count_missing() == 0
        assert column_metadata(args) == baseline
        assert indexes() == original_indexes
        assert query(args, 'SELECT id,username,nickname FROM `user` ORDER BY id;') == before
        passed('migration_twice_preserves_data_and_structure', '78 missing comments filled; 191 column properties and all indexes unchanged; sentinel retained')
        query(args, "ALTER TABLE `user` MODIFY COLUMN nickname VARCHAR(40) NOT NULL COMMENT '展示名';")
        apply(expect_fail=True)
        assert 'varchar(40)' in query(args, "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user' AND COLUMN_NAME='nickname';")
        passed('schema_drift_is_refused', 'Existing changed type is not reverted silently')
        query(args, "ALTER TABLE `user` MODIFY COLUMN nickname VARCHAR(32) NOT NULL COMMENT '展示名';")
        apply(rollback=True); apply(rollback=True)
        assert count_missing() == 78 and indexes() == original_indexes and column_metadata(args) == baseline
        assert query(args, 'SELECT id,username,nickname FROM `user` ORDER BY id;') == before
        passed('rollback_twice_preserves_data_and_structure', 'Only patch comments removed; data and indexes retained')
        query(args, 'ALTER TABLE station MODIFY COLUMN canteen_id BIGINT NOT NULL;')
        query(args, (ROOT / 'backend/sql/migration/001_existing_column_comments.sql').read_text(encoding='utf-8'))
        drifted = query(args, "SELECT COLUMN_TYPE,COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='station' AND COLUMN_NAME='canteen_id';")
        assert drifted.rstrip('\r\n') == 'bigint\t', drifted
        query(args, 'ALTER TABLE station MODIFY COLUMN canteen_id INT NOT NULL;')
        passed('raw_sql_skips_changed_column_definition', 'Even direct SQL does not reset a changed target column type')
        query(args, "ALTER TABLE `user` MODIFY COLUMN id BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Existing team annotation';")
        apply()
        assert query(args, "SELECT COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user' AND COLUMN_NAME='id';").strip() == 'Existing team annotation'
        passed('existing_team_comments_preserved', 'Nonempty annotation is never overwritten')
        inspection = (ROOT / 'backend/sql/inspection/existing_data_checks.sql').read_text(encoding='utf-8')
        clean = query(args, inspection)
        assert len(clean.splitlines()) == 6 and all(line.endswith('\t0') for line in clean.splitlines()), clean
        query(args, 'INSERT INTO station (id,canteen_id,name) VALUES (80001,99999,\'Synthetic orphan\');')
        broken = query(args, inspection)
        assert 'orphan_direct_references\t1' in broken, broken
        assert int(query(args, 'SELECT COUNT(*) FROM station;')) == 1
        passed('inspection_detects_fault_without_repair', 'Injected orphan counted; read-only script did not delete or modify it')
        snapshot = work / 'snapshot.json'
        cmd = [sys.executable, str(ROOT / 'backend/tools/data_audit.py'), '--mysql', args.mysql,
               '--port', str(port), '--database', 'dafu', '--source-commit', 'working-tree-based-on-6c3ee277', '--output', str(snapshot)]
        r = subprocess.run(cmd, capture_output=True, encoding='utf-8', creationflags=flags)
        assert r.returncode == 0, r.stderr
        exported = json.loads(snapshot.read_text(encoding='utf-8'))
        assert exported['row_counts']['user'] == 1 and len(exported['columns']) == 191
        assert 'd_data_sentinel' not in snapshot.read_text(encoding='utf-8')
        assert 'synthetic-only' not in snapshot.read_text(encoding='utf-8')
        r = subprocess.run(cmd, capture_output=True, encoding='utf-8', creationflags=flags)
        assert r.returncode != 0
        passed('metadata_snapshot_excludes_rows_and_refuses_overwrite', 'Structure, counts and commit only; existing snapshot not replaced')
        query(args, 'DROP DATABASE dafu;')
        args.database = 'mysql'
        current = (ROOT / 'backend/sql/init.sql').read_text(encoding='utf-8')
        query(args, current); query(args, current)
        args.database = 'dafu'
        assert column_metadata(args) == baseline and indexes() == original_indexes and count_missing() == 0
        passed('new_database_init_twice', 'Fresh init repeatable; 22 tables / 191 columns, unchanged schema and indexes')
        report = {'mysql_version': query(args, 'SELECT VERSION();').strip(), 'isolated_server': True,
                  'production_accessed': False, 'results': results}
        (work / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    finally:
        if process.poll() is None:
            try:
                query(args, 'SHUTDOWN;')
                process.wait(timeout=15)
            except Exception:
                process.terminate()
                process.wait(timeout=15)
        server_log.close()
        os.environ.pop('MYSQL_PWD', None)
        temp_root = Path(tempfile.gettempdir()).resolve()
        if owned_temp.parent == temp_root and owned_temp.name.startswith('codex-d-data-'):
            shutil.rmtree(owned_temp)


if __name__ == '__main__':
    main()
