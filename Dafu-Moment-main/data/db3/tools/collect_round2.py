"""Build DB3 public-place SQL from pinned public sources; facts and source limitations stay together.

Uses FFM's MIT-licensed GeoJSON (license kept with snapshot), school public notices and map.
No review text/rating, no invented dish prices, no room/student data, no real DB connection.
"""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import argparse, csv, hashlib, json, subprocess, urllib.request

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'collection/round2'
FFM='9d9680b6a4050fff132eb551c79f7818c8e9e928'
URL=f'https://raw.githubusercontent.com/155TuT/FFM-FzuFoodMap/{FFM}/fzu-food-map/public/data/fuzhou/qishan.geojson'
ALIASES={
 '玫瑰园':'玫瑰园食惠餐厅','芙蓉园':'芙蓉园兴安餐厅','紫荆园':'紫荆园捷祥餐厅',
 '牡丹园':'牡丹园清谷餐厅','丁香园':'丁香园品膳餐厅','丹桂园':'丹桂园朝阳餐厅',
 '百合园':'百合园立品餐厅','茉莉园':'茉莉园聚誉餐厅',
}
def save(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
def q(value):return 'NULL' if value is None else "'"+str(value).replace('\\','\\\\').replace("'","''")+"'"
def csv_out(path,rows):
    if not rows:return
    keys=list(dict.fromkeys(k for row in rows for k in row))
    with path.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=keys);w.writeheader()
        for row in rows:w.writerow({k:json.dumps(v,ensure_ascii=False) if isinstance(v,(list,dict)) else v for k,v in row.items()})
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--refresh',action='store_true');p.add_argument('--node',default='node');p.add_argument('--map-export',action='store_true',help='仅显式指定时导出暂缓的地图参考SQL');a=p.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    if not (OUT/'round1-places.json').exists():
        (OUT/'round1-places.json').write_bytes((ROOT/'collection/places.json').read_bytes())
    if a.refresh:
        for file,url in [('ffm-qishan.geojson',URL),('FFM-LICENSE.txt',f'https://raw.githubusercontent.com/155TuT/FFM-FzuFoodMap/{FFM}/LICENSE')]:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'DafuCourseDataCollector/2.0'}),timeout=30) as r:raw=r.read(5_000_000)
            (OUT/file).write_bytes(raw)
    features=json.loads((OUT/'ffm-qishan.geojson').read_text(encoding='utf-8'))['features']
    assert len(features)==53,'Pinned source changed or incomplete snapshot'
    # GeoJSON defaults to WGS84 (RFC7946); FFM uses MapLibre/MapTiler without conversion.
    # This is an explicitly recorded CRS inference, not a claim of field-survey accuracy.
    js="const fs=require('fs'),c=require(process.argv[1]);const f=JSON.parse(fs.readFileSync(process.argv[2],'utf8')).features;console.log(JSON.stringify(f.map(x=>c.wgs84togcj02(...x.geometry.coordinates))));"
    coords=json.loads(subprocess.check_output([a.node,'-e',js,str(Path(__file__).parent/'vendor/coordtransform.js'),str(OUT/'ffm-qishan.geojson')],encoding='utf-8')) if a.map_export else [None]*len(features)
    rows=json.loads((OUT/'round1-places.json').read_text(encoding='utf-8'))
    by_name={r['name']:r for r in rows};merged=[];collected_at=datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()
    for feature,gcj in zip(features,coords):
        b=feature['properties'];name=ALIASES.get(b['name'],b['name'])
        if name in by_name:
            r=by_name[name];merged.append({'source_id':b['id'],'source_name':b['name'],'canonical_name':name,'reason':'人工明确的同一食堂简称映射，不另建点位'})
            if not r.get('address'):r['address']=b.get('address')
        else:
            scene='学生街' if '岐安福大学生街' in str(b.get('address','')) else '其他'
            r={'record_id':b['id'],'name':name,'address':b.get('address'),'scene_category':scene,'source_key':'ffm_qishan','source_url':URL,'source_published_date':None,'collected_at':collected_at,'business_status_verified':False,'delivery_to_fzu_verified':False,'coordinates_verified':False,'note':'公开探店地图记录；不是当日到店或平台配送确认'}
            rows.append(r);by_name[name]=r
        r.update(coordinate_source_id=b['id'],source_coordinates=feature['geometry']['coordinates'],gcj02=[round(gcj[0],7),round(gcj[1],7)] if gcj else None,coordinate_basis='地图暂缓：仅留存原始坐标，不自动生成地图SQL' if not gcj else 'GeoJSON/RFC7946+MapLibre/MapTiler推定WGS84，离线转换GCJ02；非实测',reference_average_spend=b.get('price'),source_business_hours=b.get('openhour'),source_says_takeaway='可外卖' in b.get('tags',{}).get('characteristics',[]))
        r['evidence_urls']=list(dict.fromkeys([r['source_url'],URL]))
    assert len(rows)==60 and len(merged)==8
    assert len({(r['name'],r.get('address')) for r in rows})==60
    save(ROOT/'collection/places.json',rows);csv_out(ROOT/'collection/places.csv',rows);save(OUT/'deduplication.json',merged)
    csv_out(OUT/'normalized-places.csv',rows)
    # Insert or fill a missing address; never replace an existing nonempty address/map.
    sql=['-- 新采集公开点位60条，含第一批15条；8个食堂简称归一合并。无真实评价、菜价或到校配送保证。','USE dafu_shike;','SET NAMES utf8mb4;','START TRANSACTION;']
    for r in rows:
        names=[r['name']]+[alias for alias,canonical in ALIASES.items() if canonical==r['name']]
        match='name IN ('+','.join(q(n) for n in names)+')'
        if r['scene_category']!='食堂':match+=' AND address <=> '+q(r.get('address'))
        sql+=['-- '+r['record_id']+' '+r['source_url'],f"INSERT INTO location(name,address,scene_category_id) SELECT {q(r['name'])},{q(r.get('address'))},c.id FROM scene_category c WHERE c.name={q(r['scene_category'])} AND NOT EXISTS(SELECT 1 FROM location WHERE {match} AND deleted_at IS NULL);"]
        if r.get('address') and r['scene_category']=='食堂':sql.append(f"UPDATE location SET address={q(r['address'])} WHERE {match} AND address IS NULL AND deleted_at IS NULL;")
    sql.append('COMMIT;');(ROOT/'sql/03_collected_places.sql').write_text('\n'.join(sql)+'\n',encoding='utf-8')
    if a.map_export:
        sql=['-- 53个餐厅/门店点位的地图参考坐标；不是53个食堂室内档口坐标。','-- 来源FFM MIT；源坐标系依据和转换记录见collection/round2/normalized-places.csv。','-- 已有坐标不覆盖；发现重名多候选即停止，避免错挂。','USE dafu_shike;','SET NAMES utf8mb4;','START TRANSACTION;']
        for r in rows:
            if not r.get('gcj02'):continue
            match=f"name={q(r['name'])} AND deleted_at IS NULL"
            if r['scene_category']!='食堂':match+=' AND address <=> '+q(r.get('address'))
            marker='D采集FFM:'+r['coordinate_source_id']+';GCJ02推定转换;非实测'
            lng,lat=r['gcj02'];assert 118<lng<120 and 25<lat<27
            sql += [f"SET @d_map_count=(SELECT COUNT(*) FROM location WHERE {match});", "SET @d_map_guard=IF(@d_map_count=1,'DO 0','SELECT * FROM information_schema.D_COLLECTED_PLACE_NOT_UNIQUE');",'PREPARE d_map_stmt FROM @d_map_guard;','EXECUTE d_map_stmt;','DEALLOCATE PREPARE d_map_stmt;',f"SET @d_location=(SELECT id FROM location WHERE {match} LIMIT 1);",f"INSERT INTO map_location(latitude,longitude,description) SELECT {lat},{lng},{q(marker)} WHERE (SELECT map_location_id FROM location WHERE id=@d_location) IS NULL AND NOT EXISTS(SELECT 1 FROM map_location WHERE description={q(marker)});",f"UPDATE location SET map_location_id=(SELECT MIN(id) FROM map_location WHERE description={q(marker)}) WHERE id=@d_location AND map_location_id IS NULL;"]
        # User deferred maps/navigation. Keep optional SQL out of the normal import/commit set.
        deferred=ROOT/'deferred/map';deferred.mkdir(parents=True,exist_ok=True)
        sql.append('COMMIT;');(deferred/'05_collected_map_locations.sql').write_text('\n'.join(sql)+'\n',encoding='utf-8')
    save(OUT/'summary.json',{'public_places':len(rows),'merged_aliases':len(merged),'reference_coordinates':len(coords),'historical_food_entries':0,'historical_station_names':0,'historical_2021_excluded':True,'map_export_enabled':a.map_export,'current_indoor_station_coordinates':0,'individual_dish_prices':0,'ffm_commit':FFM,'source_url':URL,'collected_at':collected_at})
    save(OUT/'snapshot-manifest.json',[{'file':f.name,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in sorted(OUT.iterdir()) if f.is_file() and f.suffix in ('.json','.geojson','.md','.txt') and f.name!='snapshot-manifest.json'])
    print((OUT/'summary.json').read_text(encoding='utf-8'))
if __name__=='__main__':main()
