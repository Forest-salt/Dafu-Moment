"""Collect a small, explicit set of public primary sources; no sign-in or review scraping."""
from pathlib import Path
from html.parser import HTMLParser
import csv, hashlib, json, re, time, urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
if (ROOT/'collection/round2/summary.json').exists():
    raise SystemExit('第二批60条数据已生成；请改用tools/collect_round2.py，避免旧版15条采集器覆盖新数据。')
OUT = ROOT / 'collection'
OUT.mkdir(parents=True, exist_ok=True)
SOURCES = [
 ('fzu_canteens_2025', 'https://hqc.fzu.edu.cn/info/1032/3114.htm'),
 ('fzu_taoliyuan_2026', 'https://hqc.fzu.edu.cn/info/1032/3376.htm'),
 ('mcd_official_stores', 'https://www.mcdonalds.com.cn/page/giftcard-available-stores'),
]

class Text(HTMLParser):
    def __init__(self):
        super().__init__(); self.skip = 0; self.parts = []
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'): self.skip += 1
        if tag in ('p', 'td', 'tr', 'div', 'br', 'h1', 'h2'): self.parts.append('\n')
    def handle_endtag(self, tag):
        if tag in ('script', 'style'): self.skip = max(0, self.skip - 1)
    def handle_data(self, value):
        if not self.skip: self.parts.append(value)

manifest, texts = [], {}
now = datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()
for key, url in SOURCES:
    req = urllib.request.Request(url, headers={'User-Agent': 'DafuCourseDataCollector/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=35) as r:
            payload = r.read(8_000_000); status = r.status
        html = payload.decode('utf-8', errors='replace')
        parser = Text(); parser.feed(html)
        text = '\n'.join(x.strip() for x in ''.join(parser.parts).splitlines() if x.strip())
        (OUT / (key + '.html')).write_bytes(payload)
        (OUT / (key + '.txt')).write_text(text, encoding='utf-8')
        manifest.append({'key': key, 'url': url, 'fetched_at': now, 'status': status,
                         'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()})
        texts[key] = text
    except Exception as e:
        manifest.append({'key': key, 'url': url, 'fetched_at': now, 'error': str(e)})
    time.sleep(0.8)

rows = []
names = ['玫瑰园食惠餐厅','丁香园品膳餐厅','桃李园餐厅','佳客来西餐厅',
         '海棠园京元餐厅','丹桂园朝阳餐厅','茉莉园聚誉餐厅','百合园立品餐厅',
         '紫竹园到口餐厅','紫荆园捷祥餐厅','牡丹园清谷餐厅','芙蓉园兴安餐厅']
for name in names:
    if name in texts.get('fzu_canteens_2025', ''):
        rows.append({'record_id': f'fzu-{len(rows)+1:03d}', 'name': name, 'address': None,
                     'scene_category': '食堂', 'source_key': 'fzu_canteens_2025',
                     'source_url': SOURCES[0][1], 'source_published_date': '2025-06-30',
                     'collected_at': now, 'business_status_verified': False,
                     'delivery_to_fzu_verified': False, 'coordinates_verified': False,
                     'note': '官方历史资料确认名称；当前营业状态、价格和坐标未核验'})
store_text = texts.get('mcd_official_stores', '')
for match in re.finditer(r'(福州麦当劳[^\n]{0,80}(?:国宾大道)[^\n]{0,80}餐厅)\s*\n([^\n]+)', store_text):
    name, address = match.group(1, 2)
    if '闽侯' not in address or '上街' not in address:
        continue
    rows.append({'record_id': f'mcd-{len(rows)+1:03d}', 'name': name, 'address': address,
                 'scene_category': '其他', 'source_key': 'mcd_official_stores',
                 'source_url': SOURCES[2][1], 'source_published_date': None,
                 'collected_at': now, 'business_status_verified': False,
                 'delivery_to_fzu_verified': False, 'coordinates_verified': False,
                 'note': '品牌官方名录确认名称和地址；周边候选，未核验到校配送和距离'})
dedup = {(r['name'], r['address']): r for r in rows}
rows = list(dedup.values())
(OUT / 'sources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
(OUT / 'places.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
if rows:
    with (OUT / 'places.csv').open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
print(json.dumps({'sources': manifest, 'records': len(rows), 'names': [r['name'] for r in rows]}, ensure_ascii=False))
