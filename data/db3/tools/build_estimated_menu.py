"""Fill missing menu prices with explicitly user-authorized demo estimates, never real prices.

Dish names are an explicit subset of the existing pinned public source; whole group meals,
ambiguous shorthand and the excluded2021 source are not expanded to fabricate coverage.
The SQL only inserts missing station/name rows. Existing dish rows are never updated.
"""
from pathlib import Path
import csv, json, hashlib

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'collection/round2/ffm-qishan.geojson'
SOURCE_URL='https://raw.githubusercontent.com/155TuT/FFM-FzuFoodMap/9d9680b6a4050fff132eb551c79f7818c8e9e928/fzu-food-map/public/data/fuzhou/qishan.geojson'
# Amounts are deliberately explicit and deterministic, so reviewers can inspect every estimate.
MENU={
 'qishan-018':[('重庆小面',12),('牛肉拌面',15),('肉酱拌面',13)],
 'qishan-019':[('肉夹馍',10),('拌扁肉',12),('凉皮',10)],
 'qishan-022':[('天九湾炝肉',13),('山里炝粉',12),('莆田卤面',12)],
 'qishan-024':[('沙姜焗鸡',16),('豉汁排骨',16),('松板肉',18)],
 'qishan-025':[('麻婆豆腐',12),('脆皮鸭',18),('水煮鱼',18),('红糖糍粑',10)],
 'qishan-029':[('牛肉粉',15),('羊肉米线',15),('凉拌米线',12)],
 'qishan-040':[('牛肉面',15),('虾饺',13),('盐酥鸡',13),('甜不辣',10),('卤鸭腿',15),('炸猪排',15)],
 'qishan-041':[('干煸炒面',12),('羊肉抓饭',15),('过油肉炒面',13)],
 'qishan-044':[('和牛汉堡肉盖饭',18),('松板肉饭',16)],
 'qishan-047':[('猪肝粥',12),('海鲜粥',15),('皮蛋瘦肉粥',12)],
 'qishan-050':[('大葱水饺',12),('荠菜水饺',12),('拌猪耳朵',15),('拌皮冻',12)],
}
def q(s):return "'"+str(s).replace('\\','\\\\').replace("'","''")+"'"
def main():
    features={f['properties']['id']:f['properties'] for f in json.loads(SOURCE.read_text(encoding='utf-8'))['features']}
    rows=[]
    sql=['-- 用户2026-10-25授权的估算演示菜单；不是商家实价，不代表已核实的当前完整菜单。',
         '-- 普通餐品10至13元为主，牛羊肉15元左右，较丰盛者16至18元；单份规格也是演示假设。',
         '-- 店名/菜名取自已有公开资料。独立门店映射为点位下的同名经营档口，不声称实测室内位置。',
         '-- 新菜status=0待审核，price_unit保留估算标识；已有同档口同名菜品完全不更新。',
         'USE dafu_shike;','SET NAMES utf8mb4;','START TRANSACTION;']
    for source_id,items in MENU.items():
        source=features[source_id];name=source['name'];address=source['address']
        match=f"name={q(name)} AND address <=> {q(address)} AND deleted_at IS NULL"
        sql += [f'-- {source_id} {name}',f'SET @d_menu_locations=(SELECT COUNT(*) FROM location WHERE {match});',
                "SET @d_menu_guard=IF(@d_menu_locations=1,'DO 0','SELECT * FROM information_schema.D_MENU_LOCATION_NOT_UNIQUE');",
                'PREPARE d_menu_stmt FROM @d_menu_guard;','EXECUTE d_menu_stmt;','DEALLOCATE PREPARE d_menu_stmt;',
                f'SET @d_menu_location=(SELECT id FROM location WHERE {match} LIMIT 1);',
                f'INSERT INTO station(name,location_id) SELECT {q(name)},@d_menu_location WHERE NOT EXISTS(SELECT 1 FROM station WHERE location_id=@d_menu_location AND name={q(name)} AND deleted_at IS NULL);',
                f'SET @d_menu_stations=(SELECT COUNT(*) FROM station WHERE location_id=@d_menu_location AND name={q(name)} AND deleted_at IS NULL);',
                "SET @d_menu_guard=IF(@d_menu_stations=1,'DO 0','SELECT * FROM information_schema.D_MENU_STATION_NOT_UNIQUE');",
                'PREPARE d_menu_stmt FROM @d_menu_guard;','EXECUTE d_menu_stmt;','DEALLOCATE PREPARE d_menu_stmt;',
                f'SET @d_menu_station=(SELECT id FROM station WHERE location_id=@d_menu_location AND name={q(name)} AND deleted_at IS NULL LIMIT 1);']
        for dish,price in items:
            assert dish in source.get('notes',''),(source_id,dish,'Dish name not in source')
            assert 10<=price<=18
            reason='普通餐品估价' if price<=13 else '牛羊肉/肉类或海鲜估价' if price==15 else '较丰盛餐品估价'
            rows.append({'source_id':source_id,'location_name':name,'location_address':address,'station_name':name,'dish_name':dish,'price':f'{price:.2f}','price_kind':'estimated_demo','price_unit':'份（估算演示价）','portion_basis':'单份为演示假设，实际份量未核实','price_reason':reason,'price_source':'用户2026-10-25授权的估价规则','dish_name_source_url':SOURCE_URL,'station_mapping':'独立门店映射为同名经营档口，非室内位置测量','status':0,'overwrite_existing':False})
            sql.append(f"INSERT INTO dish(station_id,name,price,price_unit,status) SELECT @d_menu_station,{q(dish)},{price:.2f},'份（估算演示价）',0 WHERE NOT EXISTS(SELECT 1 FROM dish WHERE station_id=@d_menu_station AND name={q(dish)} AND deleted_at IS NULL);")
    sql.append('COMMIT;')
    (ROOT/'sql/06_estimated_menu_seed.sql').write_text('\n'.join(sql)+'\n',encoding='utf-8')
    (ROOT/'collection/estimated-menu.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    with (ROOT/'collection/estimated-menu.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
    summary={'estimated_dishes':len(rows),'represented_shops':len(MENU),'verified_real_unit_prices_added':0,'existing_rows_overwritten':0,'price_range':[min(int(float(r['price'])) for r in rows),max(int(float(r['price'])) for r in rows)],'source_snapshot_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'authorization_date':'2026-10-25','historical_2021_used':False}
    (ROOT/'reports/estimated-menu-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
if __name__=='__main__':main()
