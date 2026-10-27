/**
 * r43 走查：AI 模型设置「底部折叠卡 → 头卡小按钮 + 弹窗」（参考主流 AI 页布局）
 * 运行：node tests/walkthrough-r43.test.mjs
 * 前置：docker compose up -d --build frontend（前端 http://localhost:8095）
 *
 * 用例口径：
 * - R1 头卡右侧小按钮渲染（不占版面、旧折叠卡 DOM 零残留）
 * - R2 点开弹窗：标题/三表单字段/状态徽标/保存按钮齐全
 * - R3 保存链路：PUT /api/me/ai-config 成功 + toast（幂等：结束时恢复原值）
 * - R4 关闭重开：掩码/状态回显正常
 * - R5 窄屏 390px 弹窗完整可见（≤520px 弹窗 92% 宽口径）
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
        results.push({ id, desc, ok: false, msg: String(e.message || e).slice(0, 260) });
        console.log(`  [FAIL] ${id} ${desc} -> ${String(e.message || e).slice(0, 260)}`);
    }
}

/** 断言 */
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert failed'); }

/* API 登录拿 token（DEBUG 验证码通道），UI 走查用 localStorage 注入免验证码流程 */
const cap = await (await fetch(`${BASE}/api/auth/captcha`)).json();
const login = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'zhangwl', password: '123456', captchaId: cap.data.captchaId, captchaCode: cap.data.debugCode }),
})).json();
assert(login.data && login.data.token, `API 登录失败: ${JSON.stringify(login).slice(0, 120)}`);

/* 幂等准备：记录 zhangwl 原 AI 配置，走查结束后恢复 */
const H = { authorization: `Bearer ${login.data.token}` };
const orig_cfg = await (await fetch(`${BASE}/api/me/ai-config`, { headers: H })).json();
const orig = { baseUrl: orig_cfg.data?.baseUrl || '', model: orig_cfg.data?.model || '' };
console.log(`  原配置：baseUrl=${orig.baseUrl || '(空)'} model=${orig.model || '(空)'}`);

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript(([t, u]) => {
    localStorage.setItem('fk_token', t);
    localStorage.setItem('fk_user', JSON.stringify(u));
}, [login.data.token, login.data.user]);

console.log('=== r43 走查（模型设置 按钮+弹窗） ===');

await page.goto(`${BASE}/ai`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ai-head', { timeout: 15000 });

await case_r('R1', '头卡右侧小按钮：可见 + 文本正确 + 宽度克制 + 旧折叠卡零残留', async () => {
    const btn = page.locator('.ai-head .cfg-btn');
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    const text = (await btn.innerText()).trim();
    assert(text.includes('模型设置'), `按钮文案异常: ${text}`);
    const box = await btn.boundingBox();
    assert(box && box.width <= 150, `按钮过宽: ${box?.width}px（应 ≤150）`);
    // 旧折叠卡 DOM 不应再出现
    assert(await page.locator('.cfg-card').count() === 0, '仍有 .cfg-card 残留');
    assert(await page.locator('.cfg-head').count() === 0, '仍有 .cfg-head 残留');
    await page.screenshot({ path: `${OUT}\\r43-ai-head.png` });
});

await case_r('R2', '点开弹窗：标题/三字段/状态徽标/保存按钮齐全', async () => {
    await page.click('.ai-head .cfg-btn');
    const dlg = page.locator('.el-dialog:visible');
    await dlg.waitFor({ state: 'visible', timeout: 5000 });
    const title = (await dlg.locator('.el-dialog__title').innerText()).trim();
    assert(title === '模型设置', `弹窗标题异常: ${title}`);
    const labels = await dlg.locator('.el-form-item__label').allInnerTexts();
    assert(labels.join().includes('接口地址') && labels.join().includes('模型') && labels.join().includes('API Key'), `表单字段缺失: ${labels}`);
    assert(await dlg.locator('.cfg-state').count() === 1, '状态徽标缺失');
    assert(await dlg.locator('.cfg-ops button:has-text("保存设置")').count() === 1, '保存按钮缺失');
    await page.screenshot({ path: `${OUT}\\r43-ai-dialog.png` });
});

await case_r('R3', '保存链路：PUT /api/me/ai-config 成功 + toast 提示（结束恢复原值）', async () => {
    const dlg = page.locator('.el-dialog:visible');
    const inputs = dlg.locator('.el-form-item .el-input__inner');
    // 填入与原值一致的值（原值为空时填演示值），保证幂等
    const new_base = orig.baseUrl || 'https://api.deepseek.com/v1';
    const new_model = orig.model || 'deepseek-chat';
    await inputs.nth(0).fill(new_base);
    await inputs.nth(1).fill(new_model);
    const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/me/ai-config') && r.request().method() === 'PUT', { timeout: 8000 }),
        dlg.locator('.cfg-ops button:has-text("保存设置")').click(),
    ]);
    const body = await resp.json();
    assert(resp.status() === 200 && body.code === 0, `保存接口异常: ${resp.status()} ${JSON.stringify(body).slice(0, 120)}`);
    await page.waitForSelector('.el-message:visible', { timeout: 5000 });
    const toast = await page.locator('.el-message:visible').first().innerText();
    assert(toast.includes('已保存'), `toast 异常: ${toast}`);
});

await case_r('R4', '关闭重开：弹窗可关、重开后配置回显（掩码占位或状态徽标）', async () => {
    // 关闭（点 X）
    await page.locator('.el-dialog:visible .el-dialog__headerbtn').click();
    await page.waitForSelector('.el-dialog:visible', { state: 'detached', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
    assert(await page.locator('.el-dialog:visible').count() === 0, '弹窗未关闭');
    // 重开：状态徽标应出现（自配生效 或 规则推荐模式）
    await page.click('.ai-head .cfg-btn');
    const dlg = page.locator('.el-dialog:visible');
    await dlg.waitFor({ state: 'visible', timeout: 5000 });
    const state = await dlg.locator('.cfg-state').innerText();
    assert(state.includes('自配生效') || state.includes('规则推荐'), `状态徽标异常: ${state}`);
});

await case_r('R5', '窄屏 390px：弹窗完整可见不溢出（92% 宽口径）', async () => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.waitForTimeout(300);
    const dlg = page.locator('.el-dialog:visible');
    const box = await dlg.boundingBox();
    assert(box, '弹窗未渲染');
    assert(box.width <= 390, `弹窗宽超视口: ${box.width}`);
    assert(box.x >= 0 && box.x + box.width <= 390, `弹窗横向溢出: x=${box.x} w=${box.width}`);
    await page.screenshot({ path: `${OUT}\\r43-ai-dialog-mobile.png` });
});

/* 走查结束：恢复 zhangwl 原 AI 配置（幂等收尾） */
try {
    await fetch(`${BASE}/api/me/ai-config`, {
        method: 'PUT', headers: { ...H, 'content-type': 'application/json' },
        body: JSON.stringify({ baseUrl: orig.baseUrl, model: orig.model }),
    });
    console.log('  已恢复原 AI 配置');
} catch { /* 恢复失败不影响走查结论 */ }

await browser.close();
console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail ? 1 : 0);
