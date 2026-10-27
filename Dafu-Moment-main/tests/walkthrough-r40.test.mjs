/**
 * r40 走查：地图 512 注记层（scl=2）实测 + AI 模型设置卡迁移（node 直跑）
 * 运行：node tests/walkthrough-r40.test.mjs
 * 前置：docker compose up -d --build（前端 http://localhost:8095）
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
// deviceScaleFactor=2 模拟高分屏：512 物理瓦片在 256 CSS 格上应逐物理像素锐利
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript(([t, u]) => {
    localStorage.setItem('fk_token', t);
    localStorage.setItem('fk_user', JSON.stringify(u));
}, [TOKEN, USER]);

console.log('=== r40 走查（chromium 1280x800 DPR=2） ===');

/**
 * 等待注记瓦片集稳定：连续两次采样 DOM 快照一致且无加载失败项
 * 规避 Leaflet 缩放动画中「新 img 未加载完就被断言」的竞态
 * @returns {Promise<{imgs: Array<{z:string, w:number, src:string}>, stable: boolean}>}
 */
async function wait_tiles_stable() {
    let last = '';
    for (let i = 0; i < 12; i++) {
        const snap = await page.evaluate(() => [...document.querySelectorAll('img.leaflet-tile')]
            .filter((i) => i.src.includes('style=8'))
            .map((i) => `${i.src.match(/z=(\d+)/)?.[1]}:${i.naturalWidth}`)
            .sort().join('|'));
        const zeroCnt = snap.split('|').filter((s) => s.endsWith(':0')).length;
        if (snap === last && snap.length > 0 && zeroCnt === 0) {
            return { stable: true, imgs: snap.split('|').map((s) => ({ z: s.split(':')[0], w: Number(s.split(':')[1]) })) };
        }
        last = snap;
        await page.waitForTimeout(600);
    }
    const snap = last.split('|').map((s) => ({ z: s.split(':')[0], w: Number(s.split(':')[1]) }));
    return { stable: false, imgs: snap };
}

await case_r('R1', '/map 注记层请求 scl=2 且渲染 naturalWidth=512（2x 超采样生效）', async () => {
    await page.goto(`${BASE}/map`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('.pin', { timeout: 8000 });
    const { stable, imgs } = await wait_tiles_stable();
    assert(imgs.length > 0, '未见注记瓦片');
    assert(imgs.every((i) => i.w === 512), `注记瓦片宽度异常: ${JSON.stringify(imgs.filter((i) => i.w !== 512))}`);
    assert(stable, `瓦片 12 轮采样后仍有加载失败/未完成项: ${imgs.filter((i) => i.w !== 512).length} 张`);
    await page.screenshot({ path: `${OUT}\\r40-map-z17.png` });
});

await case_r('R2', 'z18 注记放大兜底可用（maxNativeZoom=17 后无空瓦片断层）', async () => {
    const zoomIn = page.locator('.leaflet-control-zoom-in');
    for (let i = 0; i < 2; i++) { await zoomIn.click(); await page.waitForTimeout(900); }
    const { stable, imgs } = await wait_tiles_stable();
    assert(imgs.length > 0, 'z18 未见注记瓦片');
    // maxNativeZoom=17 生效的标志：所有注记 URL 的 z 均为 17（z18 scl=2 是空瓦片，Leaflet 不应请求）
    assert(imgs.every((i) => i.z === '17'), `出现非 z17 注记请求（断层）: ${JSON.stringify(imgs.filter((i) => i.z !== '17'))}`);
    assert(imgs.every((i) => i.w === 512), `z18 注记瓦片加载失败: ${JSON.stringify(imgs.filter((i) => i.w !== 512))}`);
    assert(stable, 'z18 瓦片 12 轮采样未稳定');
    await page.screenshot({ path: `${OUT}\\r40-map-z18.png` });
});

await case_r('R3', '/ai 模型设置卡渲染 + 展开表单 + 状态徽标（迁移自个人中心）', async () => {
    await page.goto(`${BASE}/ai`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('.cfg-card', { timeout: 8000 });
    const state = await page.locator('.cfg-state').textContent();
    assert(state.includes('模式') || state.includes('自配'), `状态徽标=${state}`);
    await page.locator('.cfg-head').click();
    await page.waitForSelector('.cfg-body .el-form', { timeout: 4000 });
    const fields = await page.locator('.cfg-body .el-form-item').count();
    assert(fields === 3, `表单项数=${fields}（期望 接口地址/模型/API Key）`);
    // me-view 不再残留 AI 设置入口
    await page.goto(`${BASE}/me`, { waitUntil: 'networkidle', timeout: 30000 });
    const ops = await page.locator('.head-ops').textContent();
    assert(!ops.includes('AI 设置'), '个人中心仍残留 AI 设置入口');
    assert(ops.includes('AI 助手'), '个人中心缺 AI 助手跳转');
    await page.screenshot({ path: `${OUT}\\r40-ai-cfg.png` });
});

await browser.close();

console.log('---');
console.log(`结果: ${pass} passed, ${fail} failed, 共 ${pass + fail} 例`);
console.log(`截图目录: ${OUT}`);
fs.writeFileSync(`${OUT}\\walkthrough-r40-result.json`, JSON.stringify(results, null, 2));
if (fail > 0) process.exit(1);
