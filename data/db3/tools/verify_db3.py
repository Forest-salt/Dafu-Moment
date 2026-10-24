"""Run DB3 package only in a freshly initialized local temporary MySQL server."""
from pathlib import Path
import argparse, json, os, secrets, shutil, socket, subprocess, sys, tempfile, time
from types import SimpleNamespace

PACKAGE = Path(__file__).resolve().parents[1]
REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / 'backend/tools'))
from data_audit import query

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--mysql-bin', required=True)
    p.add_argument('--output', required=True, help='New output folder, must not exist')
    p.add_argument('--original-checks', default=str(PACKAGE/'source-ddl/原包校验SQL.sql'))
    a = p.parse_args()
    out = Path(a.output).resolve()
    if out.exists(): raise SystemExit('Refuse reuse of existing output directory')
    out.mkdir(parents=True)
    owned = Path(tempfile.mkdtemp(prefix='codex-db3-')).resolve()
    bindir = Path(a.mysql_bin).resolve()
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    init = subprocess.run([str(bindir/'mysqld.exe'),'--no-defaults','--initialize-insecure',
                           '--basedir='+str(bindir.parent),'--datadir='+str(owned/'data')],
                          capture_output=True,creationflags=flags)
    (out/'initialization.log').write_bytes(init.stdout+init.stderr)
    if init.returncode: raise RuntimeError('Temporary initialization failed')
    with socket.socket() as s: s.bind(('127.0.0.1',0)); port=s.getsockname()[1]
    log=(out/'server.log').open('wb')
    proc=subprocess.Popen([str(bindir/'mysqld.exe'),'--no-defaults',
        '--basedir='+str(bindir.parent),'--datadir='+str(owned/'data'),
        '--bind-address=127.0.0.1','--port='+str(port),'--mysqlx=0',
        '--innodb-buffer-pool-size=64M','--innodb-redo-log-capacity=32M',
        '--pid-file='+str(owned/'server.pid'),'--console'],stdout=log,stderr=log,creationflags=flags)
    args=SimpleNamespace(mysql=str(bindir/'mysql.exe'),host='127.0.0.1',port=port,user='root',database='mysql')
    results=[]
    def run(file): return query(args,file.read_text(encoding='utf-8-sig'))
    def scalar(sql): return int(query(args,sql).strip())
    def passed(name,detail):
        results.append({'check':name,'passed':True,'detail':detail}); print('PASS '+name,flush=True)
    def checksums(): return query(args,'CHECKSUM TABLE '+','.join('`'+t+'`' for t in query(args,"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME;").splitlines())+';')
    try:
        for _ in range(120):
            if proc.poll() is not None: raise RuntimeError('Temporary server exited')
            try: query(args,'SELECT 1;'); break
            except RuntimeError: time.sleep(.2)
        else: raise RuntimeError('Temporary server unavailable')
        password=secrets.token_hex(24)
        query(args,"ALTER USER 'root'@'localhost' IDENTIFIED BY '"+password+"';")
        os.environ['MYSQL_PWD']=password
        for file in ['00_create_tables.sql','01_add_foreign_keys.sql','02_dictionary_seed.sql']:
            run(PACKAGE/'sql'/file)
        args.database='dafu_shike'
        count=scalar("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE';")
        fks=scalar("SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_TYPE='FOREIGN KEY';")
        columns=scalar("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE();")
        assert (count,fks)==(78,106),(count,fks)
        passed('db3_schema_78_tables_106_foreign_keys',f'{columns} columns; actual MySQL 8.0.46 build')
        first=checksums()
        for file in ['00_create_tables.sql','01_add_foreign_keys.sql','02_dictionary_seed.sql']:
            run(PACKAGE/'sql'/file)
        assert checksums()==first
        passed('schema_and_dictionary_repeat_preserve_rows','Second run has no table deletion or dictionary row change')
        run(PACKAGE/'sql/03_collected_places.sql')
        first=checksums()
        run(PACKAGE/'sql/03_collected_places.sql')
        assert checksums()==first
        places=json.loads((PACKAGE/'collection/places.json').read_text(encoding='utf-8'))
        assert scalar('SELECT COUNT(*) FROM location;')==len(places)
        passed('public_places_import_twice',f'{len(places)} source-backed name/address rows, no duplicates')
        run(PACKAGE/'sql/04_synthetic_test_seed.sql')
        first=checksums()
        run(PACKAGE/'sql/04_synthetic_test_seed.sql')
        assert checksums()==first
        stats={
          'check_ins':scalar('SELECT COUNT(*) FROM check_in WHERE id BETWEEN 8320001 AND 8320030;'),
          'days':scalar('SELECT COUNT(DISTINCT check_in_date) FROM check_in WHERE id BETWEEN 8320001 AND 8320030;'),
          'achievement_progress':scalar('SELECT COUNT(*) FROM user_achievement WHERE id BETWEEN 8330001 AND 8330012;'),
          'achievement_definitions':scalar('SELECT COUNT(*) FROM achievement;'),
          'pets':scalar('SELECT COUNT(*) FROM pet WHERE id BETWEEN 8340001 AND 8340003;'),
          'profiles':scalar('SELECT COUNT(*) FROM dietary_profile WHERE id BETWEEN 8350001 AND 8350003;'),
          'pending_tasks':scalar('SELECT COUNT(*) FROM task_claim WHERE id BETWEEN 8370001 AND 8370005 AND status=0;')}
        assert stats=={'check_ins':30,'days':7,'achievement_progress':12,'achievement_definitions':4,'pets':3,'profiles':3,'pending_tasks':5},stats
        passed('synthetic_seed_counts_and_repeat',stats)
        try: query(args,"INSERT INTO check_in(user_id,location_id,check_in_date) VALUES(8300001,8310001,'2026-10-18');")
        except RuntimeError as e: assert '1062' in str(e)
        else: raise AssertionError('Unique key did not reject duplicate')
        assert scalar('SELECT COUNT(*) FROM check_in;')==30
        passed('duplicate_check_in_rejected','Same user/location/day insert rejected with 1062')
        try: query(args,"INSERT INTO check_in(user_id,location_id,check_in_date) VALUES(999999999,8310001,'2026-10-18');")
        except RuntimeError as e: assert '1452' in str(e)
        else: raise AssertionError('Foreign key did not reject orphan')
        passed('orphan_check_in_rejected','Nonexistent user rejected with 1452')
        run(PACKAGE/'source-ddl/seed_demo.sql')
        run(PACKAGE/'source-ddl/seed_demo.sql')
        raw=run(Path(a.original_checks))
        (out/'original_check_output.txt').write_text(raw,encoding='utf-8')
        values=[line.strip() for line in raw.splitlines() if line.strip()]
        assert values[:3]==['78','106','78'],values
        assert all(x=='0' for x in values[3:]),values
        passed('original_demo_twice_and_original_checks','Original checking queries report no anomaly rows; table-count comment 74 is stale')
        query(args,'INSERT INTO rating_detail(review_id,dimension_id,score) VALUES(900001,3,4.0);')
        raw=run(Path(a.original_checks))
        assert any('900001' in line for line in raw.splitlines()),raw
        passed('original_checks_detect_injected_invalid_dimension','Injected forbidden dine-in packaging dimension is reported; data quality checks are not empty-pass')
        result={'mysql_version':query(args,'SELECT VERSION();').strip(),'production_accessed':False,
                'schema_tables':count,'schema_foreign_keys':fks,'schema_columns':columns,
                'source_places':len(places),'synthetic':stats,'results':results}
        (out/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    finally:
        if proc.poll() is None:
            try: query(args,'SHUTDOWN;'); proc.wait(timeout=15)
            except Exception: proc.terminate(); proc.wait(timeout=15)
        log.close(); os.environ.pop('MYSQL_PWD',None)
        if owned.parent==Path(tempfile.gettempdir()).resolve() and owned.name.startswith('codex-db3-'):
            shutil.rmtree(owned)

if __name__=='__main__': main()
