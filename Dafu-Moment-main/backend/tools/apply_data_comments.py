"""Apply/revert comment-only SQL after comparing all baseline column properties."""
import json
from data_audit import ROOT, parser, query, column_metadata


def main():
    p = parser('Guarded existing-column comment migration; never runs automatically at boot.')
    p.add_argument('--rollback', action='store_true')
    args = p.parse_args()
    expected = json.loads((ROOT / 'docs/data/baseline-columns.json').read_text(encoding='utf-8'))
    actual = {(r['table_name'], r['column_name']): r for r in column_metadata(args)}
    drift = [f"{r['table_name']}.{r['column_name']}" for r in expected
             if actual.get((r['table_name'], r['column_name'])) != r]
    expected_keys = {(r['table_name'], r['column_name']) for r in expected}
    expected_tables = {r['table_name'] for r in expected}
    drift += [f'{t}.{c} (extra column)' for t, c in actual
              if t in expected_tables and (t, c) not in expected_keys]
    if drift:
        raise SystemExit('Refused: baseline column structure differs: ' + ', '.join(drift))
    folder = 'rollback' if args.rollback else 'migration'
    sql = (ROOT / f'backend/sql/{folder}/001_existing_column_comments.sql').read_text(encoding='utf-8')
    query(args, sql)
    print('Comment rollback completed.' if args.rollback else 'Comment migration completed.')


if __name__ == '__main__':
    main()
