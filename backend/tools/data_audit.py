"""MySQL CLI helpers for D's explicit, read-only inspection and guarded migration."""
import argparse
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def parser(description):
    p = argparse.ArgumentParser(description=description)
    p.add_argument('--mysql', required=True, help='mysql executable path')
    p.add_argument('--host', default='127.0.0.1')
    p.add_argument('--port', required=True, type=int)
    p.add_argument('--user', default='root')
    p.add_argument('--database', required=True)
    return p


def query(args, sql):
    # Authentication comes from MySQL's normal client configuration or MYSQL_PWD.
    # Do not put passwords in command arguments, files, output or snapshots.
    command = [args.mysql, '--protocol=TCP', '--host=' + args.host,
               '--port=' + str(args.port), '--user=' + args.user,
               '--database=' + args.database, '--default-character-set=utf8mb4',
               '--batch', '--raw', '--skip-column-names']
    result = subprocess.run(command, input=sql, encoding='utf-8', capture_output=True,
                            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return result.stdout


def column_metadata(args):
    sql = """SELECT JSON_OBJECT('table_name', TABLE_NAME, 'column_name', COLUMN_NAME,
      'ordinal_position', ORDINAL_POSITION, 'column_type', COLUMN_TYPE,
      'is_nullable', IS_NULLABLE, 'column_default', COLUMN_DEFAULT, 'extra', EXTRA,
      'collation_name', COLLATION_NAME, 'generation_expression', GENERATION_EXPRESSION)
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
    ORDER BY TABLE_NAME, ORDINAL_POSITION;"""
    return [json.loads(line) for line in query(args, sql).splitlines() if line]


def main():
    p = parser('Export structure and counts only; never exports business rows or credentials.')
    p.add_argument('--output', required=True)
    p.add_argument('--source-commit', required=True, help='Commit corresponding to the inspected database')
    args = p.parse_args()
    tables = query(args, "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME;").splitlines()
    counts = {}
    for table in tables:
        quoted = table.replace('`', '``')
        counts[table] = int(query(args, f'SELECT COUNT(*) FROM `{quoted}`;').strip())
    # Not a transactionally consistent backup of row data. A backup/recovery test is separate.
    result = {'database': args.database, 'source_commit': args.source_commit,
              'snapshot_kind': 'structure-and-counts-only',
              'consistent_data_backup': False, 'columns': column_metadata(args),
              'row_counts': counts}
    output = Path(args.output)
    with output.open('x', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f'Saved metadata and counts for {len(tables)} tables; no business rows exported.')


if __name__ == '__main__':
    main()
