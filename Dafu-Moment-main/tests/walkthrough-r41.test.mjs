/**
 * r41 走查：地图中文注记恢复（单层 wprd scl=1 style=7 带注记街道图）
 * 运行：node tests/walkthrough-r41.test.mjs
 * 前置：docker compose up -d --build（前端 http://localhost:8095）
 *
 * 教训修正（r40 假阳性）：naturalWidth 只证明图片加载成功，空白占位瓦片（192~215B）同样通过；
 * 本轮改在 node 侧回源取瓦片字节大小断言内容非空（有字街道图 >3KB，空白占位 <1KB）。
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
 * 登记一个走查用例
 * @param {string} id - R-xx
 * @param {string} desc
 * @param {Function} fn
 */
async function case_r(id, desc, fn) {
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

/** 断言 */
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert failed'); }

/* API 登录拿 token（验证码走 DEBUG debugCode 通道），UI 走查用 localStorage 注入免验证码流程 */
const cap = await (await fetch(`${BASE}/api/auth/captcha`)).json();
const login = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'zhangwl', password: '123456', captchaId: cap.data.captchaId, captchaCode: cap.data.debugCode }),
})).json();
assert(login.data && login.data.token, `API 登录失败: ${JSON.stringify(login).slice(0, 120)}`);
const TOKEN = login.data.token;
const USER = login.data.user;

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript(([t, u]) => {
    localStorage.setItem('fk_token', t);
    localStorage.setItem('fk_user', JSON.stringify(u));
}, [TOKEN, USER]);

console.log('=== r41 走查（chromium 1280x800 DPR=2） ===');

/**
 * 等待地图瓦片稳定并收集 scl=1 底图瓦片 URL（双采样防缩放动画竞态）
 * @returns {Promise<string[]>} 去重后的瓦片 URL 列表
 */
async function collect_tiles() {
    let last = '';
    for (let i = 0; i < 14; i++) {
        const snap = await page.evaluate(() => [...document.querySelectorAll('img.leaflet-tile')]
            .filter((i) => i.src.includes('scl=1'))
            .map((i) => `${i.src}`)
            .sort().join('|'));
        if (snap === last && snap.length > 0) return [...new Set(snap.split('|'))];
        last = snap;
        await page.waitForTimeout(600);
    }
    return [...new Set(last.split('|').filter(Boolean))];
}

/**
 * node 侧回源取瓦片字节（内容非空断言的关键：浏览器 performance API 跨域拿不到 transferSize）
 * @param {string[]} urls
 * @returns {Promise<number[]>} 每张瓦片字节数
 */
async function tile_sizes(urls) {
    const sizes = [];
    for (const u of urls.slice(0, 8)) sizes.push((await (await fetch(u)).arrayBuffer()).byteLength);
    return sizes;
}

await case_r('R1', '首页地图加载且底图全部为 scl=1 带注记瓦片（无 style=8 残留）', async () => {
    await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.leaflet-tile', { timeout: 20000 });
    const urls = await collect_tiles();
    assert(urls.length > 0, '未收集到 scl=1 瓦片');
    const style8 = await page.evaluate(() => [...document.querySelectorAll('img.leaflet-tile')].filter((i) => i.src.includes('style=8')).length);
    assert(style8 === 0, `仍有 ${style8} 张 style=8 路网层瓦片（应为 0，双层已撤）`);
    const sizes = await tile_sizes(urls);
    const empty = sizes.filter((s) => s < 3000).length;
    assert(empty === 0, `${empty}/${sizes.length} 张瓦片 <3KB（空白占位，无注记内容）；样本: ${sizes.join(',')}`);
    console.log(`    瓦片字节数样本: ${sizes.join(', ')}（>3KB = 含注记内容）`);
});

await case_r('R2', '放大两级（z18）注记瓦片仍有内容（256 源原生到 z19）', async () => {
    await page.click('.leaflet-control-zoom-in');
    await page.click('.leaflet-control-zoom-in');
    const urls = await collect_tiles();
    assert(urls.length > 0, 'z18 未收集到瓦片');
    const zs = [...new Set(urls.map((u) => Number(u.match(/z=(\d+)/)[1])))];
    assert(zs.every((z) => z >= 17), `出现异常层级: ${zs.join(',')}`);
    const sizes = await tile_sizes(urls);
    const empty = sizes.filter((s) => s < 2000).length;
    assert(empty === 0, `${empty}/${sizes.length} 张瓦片近空白；样本: ${sizes.join(',')}`);
    console.log(`    z18 视图瓦片层级: ${zs.join(',')}；字节样本: ${sizes.join(', ')}`);
});

await case_r('R3', '截图人工复核中文标注（建平路/餐厅名等）', async () => {
    await page.screenshot({ path: `${OUT}/r41-map-z18.png` });
    await page.click('.leaflet-control-zoom-out');
    await page.click('.leaflet-control-zoom-out');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/r41-map-default.png` });
    assert(fs.existsSync(`${OUT}/r41-map-default.png`), '截图未生成');
});

console.log(`\n=== 结果: ${pass} 过 / ${fail} 挂 ===`);
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'} ${r.id} ${r.desc}${r.ok ? '' : ' -> ' + r.msg}`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
