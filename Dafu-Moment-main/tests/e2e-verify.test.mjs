/**
 * 大福食刻 DAFU MOMENT E2E 验收（E2E 编号用例 + 三视口回归，node 直跑）
 * 运行：node tests/e2e-verify.test.mjs
 * 前置：docker compose up -d --build（http://localhost:8095）
 * 产物：C:\Users\Zviolin\AppData\Local\Temp\lb-e2e\*.png
 */
import { chromium } from 'playwright-core';
import fs from 'fs';

const BASE = 'http://localhost:8095';
const EXE = 'C:\\Users\\Zviolin\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const OUT = 'C:\\Users\\Zviolin\\AppData\\Local\\Temp\\lb-e2e';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
let pass = 0, fail = 0;

/**
 * 登记一个 E2E 用例
 * @param {string} id - E2E-xx
 * @param {string} desc
 * @param {Function} fn
 */
async function case_e2e(id, desc, fn) {
    try {
        await fn();
        pass++;
        results.push({ id, desc, ok: true });
        console.log(`  [PASS] ${id} ${desc}`);
    } catch (e) {
        fail++;
        results.push({ id, desc, ok: false, msg: String(e.message || e).slice(0, 200) });
        console.log(`  [FAIL] ${id} ${desc} -> ${String(e.message || e).slice(0, 200)}`);
    }
}

/**
 * 断言
 */
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert failed'); }

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 120)));

/** 取美岐食区 id */
const canteens = await (await fetch(`${BASE}/api/canteens`)).json();
const MQ_ID = canteens.data.find((c) => c.name.includes('美岐')).id;
/** 点位总数（v2.0 四类型点位，数量由种子决定，标记数断言据此放宽） */
const POINT_COUNT = canteens.data.length;

console.log('=== DAFU MOMENT E2E 验收（chromium 1280x800） ===');

console.log('[分组] 美食地图');
await case_e2e('E2E-M1', '/map 渲染全部点位标记，点击标记出详情卡', async () => {
    await page.goto(`${BASE}/map`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('.pin', { timeout: 8000 });
    const pinCount = await page.locator('.pin').count();
    assert(pinCount >= POINT_COUNT, `标记数=${pinCount}（期望 ≥ ${POINT_COUNT}）`);
    await page.locator('.pin').first().click();
    await page.waitForSelector('.pin-card', { timeout: 4000 });
    const cardText = await page.locator('.pin-card').textContent();
    assert(cardText.includes('窗口'), '详情卡缺窗口数');
    assert(cardText.includes('查看食区详情'), '详情卡缺跳转按钮');
    await page.screenshot({ path: `${OUT}\\e2e-m1-map.png` });
});

await case_e2e('E2E-M2', '标记详情卡跳转 /canteen/:id', async () => {
    await page.locator('.pin-card .pc-btn').click();
    await page.waitForURL(/\/canteen\/\d+/, { timeout: 8000 });
    await page.waitForSelector('h1', { timeout: 8000 });
    const h1 = await page.locator('h1').first().textContent();
    assert(h1.trim().length > 0, '食区详情页 h1 为空');
});

await case_e2e('E2E-M3', `/map?focus=${MQ_ID} 直达定位美岐详情卡`, async () => {
    await page.goto(`${BASE}/map?focus=${MQ_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('.pin-card', { timeout: 8000 });
    const t = await page.locator('.pin-card .pc-title').textContent();
    assert(t.includes('美岐'), `详情卡=${t}`);
    await page.screenshot({ path: `${OUT}\\e2e-m3-focus.png` });
});

await case_e2e('E2E-M4', '食区详情页「在地图上查看」回链', async () => {
    await page.goto(`${BASE}/canteen/${MQ_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
    const link = page.locator('.map-link');
    assert(await link.count() === 1, '缺 map-link');
    await link.click();
    await page.waitForURL(/\/map\?focus=/, { timeout: 8000 });
    await page.waitForSelector('.pin-card', { timeout: 8000 });
});

console.log('[分组] 分类导航（美团式九宫格）');
await case_e2e('E2E-C1', '首页分类九宫格渲染（含美食地图入口）', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('.cat-tile', { timeout: 8000 });
    const n = await page.locator('.cat-tile').count();
    assert(n >= 8, `tile 数=${n}`);
    const mapTile = page.locator('.cat-tile', { hasText: '美食地图' });
    assert(await mapTile.count() === 1, '缺「美食地图」tile');
    const icons = await page.locator('.cat-ico svg').count();
    assert(icons >= n - 1, `图标 svg 数=${icons} < tile 数`);
    await page.screenshot({ path: `${OUT}\\e2e-c1-home.png` });
});

await case_e2e('E2E-C2', '点击品类「汉堡简餐」→ 搜索页承接品类筛选', async () => {
    await page.locator('.cat-tile', { hasText: '汉堡简餐' }).click();
    await page.waitForURL(/\/search\?category=/, { timeout: 8000 });
    await page.waitForSelector('.cat-tag', { timeout: 8000 });
    const tag = await page.locator('.cat-tag').textContent();
    assert(tag.includes('汉堡简餐'), `tag=${tag}`);
    await page.waitForSelector('.result-grid .dish-card, .result-grid > *', { timeout: 8000 });
    const total = await page.locator('.result-grid > *').count();
    assert(total > 0, '结果为空');
    // URL 同步检查
    const url = page.url();
    assert(url.includes('category=' + encodeURIComponent('汉堡简餐')), `URL 未同步: ${url}`);
    await page.screenshot({ path: `${OUT}\\e2e-c2-search.png` });
});

await case_e2e('E2E-C3', '关闭品类 tag → 筛选清除结果恢复', async () => {
    await page.locator('.cat-close').click();
    await page.waitForTimeout(800);
    assert(await page.locator('.cat-tag').count() === 0, 'tag 未消失');
    const url = page.url();
    assert(!url.includes('category='), `URL 仍含 category: ${url}`);
});

await case_e2e('E2E-C4', '顶栏「地图」入口跳转 /map', async () => {
    await page.locator('.nav-links a', { hasText: '地图' }).click();
    await page.waitForURL(/\/map$/, { timeout: 8000 });
    await page.waitForSelector('.pin', { timeout: 8000 });
});

console.log('[分组] 三视口响应式回归（375 / 768 / 1280）');
for (const [name, w, h] of [['m375', 375, 812], ['t768', 768, 1024], ['d1280', 1280, 800]]) {
    await case_e2e(`E2E-V-${name}`, `${w}x${h} 首页/地图/搜索无横向溢出且无 JS 报错`, async () => {
        const c2 = await browser.newContext({ viewport: { width: w, height: h } });
        const p2 = await c2.newPage();
        const errs = [];
        p2.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
        try {
            for (const path of ['/', '/map', `/search?category=${encodeURIComponent('汉堡简餐')}`]) {
                await p2.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
                await p2.waitForTimeout(600);
                const m = await p2.evaluate(() => ({
                    sw: document.documentElement.scrollWidth,
                    cw: document.documentElement.clientWidth,
                }));
                assert(m.sw <= m.cw + 1, `${path} 横向溢出 sw=${m.sw} cw=${m.cw}`);
            }
            await p2.goto(`${BASE}/map`, { waitUntil: 'networkidle' });
            await p2.waitForTimeout(500);
            await p2.screenshot({ path: `${OUT}\\vp-${name}-map.png` });
            assert(errs.length === 0, `JS 报错: ${JSON.stringify(errs)}`);
        } finally {
            await c2.close();
        }
    });
}

await browser.close();

// 汇总
console.log('---');
console.log(`结果: ${pass} passed, ${fail} failed, 共 ${pass + fail} 例`);
console.log(`截图目录: ${OUT}`);
if (consoleErrors.length) console.log(`(主页面 pageerror: ${consoleErrors.length})`);
fs.writeFileSync(`${OUT}\\result.json`, JSON.stringify(results, null, 2));
if (fail > 0) process.exit(1);
