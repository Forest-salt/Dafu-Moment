/**
 * r44 走查：AI 多供应商接入（参考 Trae 自定义端点）+ 知识库增强 + 推荐卡地图跳转
 * 运行：node tests/walkthrough-r44.test.mjs
 * 前置：docker compose up -d --build backend frontend（前端 8095 / 后端 3000）
 *
 * 验证口径：
 * - A1 OpenAI 兼容协议：用户自配指向本地 mock 端点 → ask 走 /chat/completions，回答带 MOCK 标记、不降级
 * - A2 Anthropic 原生协议：provider=anthropic → ask 走 /messages（x-api-key + anthropic-version 头、
 *   system 独立字段、messages 首条为 user），回答带 MOCK-ANTHROPIC 标记
 * - A3 供应商白名单：非法 provider 保存时回落 openai
 * - U1-U3 UI：供应商下拉（7 项预设）贴纸化面板、选预设自动填端点/模型、保存携带 provider
 * - U4 推荐卡「地图」chip → /map?focus=id 直达弹食区详情卡
 * - 走查结束恢复 zhangwl 原 AI 配置（幂等）
 */
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const BASE = 'http://localhost:8095';
const API = 'http://localhost:3000';
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
        results.push({ id, desc, ok: false, msg: String(e.message || e).slice(0, 300) });
        console.log(`  [FAIL] ${id} ${desc} -> ${String(e.message || e).slice(0, 300)}`);
    }
}

/** 断言 */
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert failed'); }

/* ---------------- 本地 mock LLM 服务器（双协议） ---------------- */
const hits = { openai: [], anthropic: [] };
const mock = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
        try {
            const parsed = body ? JSON.parse(body) : {};
            if (req.url.includes('/chat/completions')) {
                hits.openai.push({ auth: req.headers.authorization, model: parsed.model, msgs: (parsed.messages || []).length });
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({ choices: [{ message: { content: '【MOCK-OPENAI】福宝已连通：OpenAI 兼容协议正常，推荐见下方卡片。' } }] }));
            } else if (req.url.endsWith('/messages')) {
                hits.anthropic.push({
                    xapikey: req.headers['x-api-key'], ver: req.headers['anthropic-version'],
                    hasSystem: !!parsed.system, firstRole: parsed.messages && parsed.messages[0] ? parsed.messages[0].role : null,
                    model: parsed.model, maxTokens: parsed.max_tokens,
                });
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({ content: [{ type: 'text', text: '【MOCK-ANTHROPIC】福宝已连通：Claude 原生 /messages 协议正常，推荐见下方卡片。' }] }));
            } else {
                res.statusCode = 404; res.end('{}');
            }
        } catch (e) {
            res.statusCode = 500; res.end(JSON.stringify({ err: String(e) }));
        }
    });
});
await new Promise((r) => mock.listen(17521, r));
console.log('  mock LLM 服务器已启动 :17521（openai /v1/chat/completions + anthropic /v1/messages）');
const MOCK_BASE = 'http://host.docker.internal:17521/v1'; // 容器内 backend 访问宿主机

/* ---------------- 登录 ---------------- */
const cap = await (await fetch(`${BASE}/api/auth/captcha`)).json();
const login = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'zhangwl', password: '123456', captchaId: cap.data.captchaId, captchaCode: cap.data.debugCode }),
})).json();
assert(login.data && login.data.token, `API 登录失败: ${JSON.stringify(login).slice(0, 120)}`);
const H = { authorization: `Bearer ${login.data.token}`, 'content-type': 'application/json' };

/* 幂等准备：记录原配置 */
const orig_cfg = await (await fetch(`${API}/api/me/ai-config`, { headers: H })).json();
const orig = { provider: orig_cfg.data?.provider || 'openai', baseUrl: orig_cfg.data?.baseUrl || '', model: orig_cfg.data?.model || '' };
console.log(`  原配置：provider=${orig.provider} baseUrl=${orig.baseUrl || '(空)'} model=${orig.model || '(空)'}`);

/**
 * 保存自配（简化封装）
 * @param {Object} body
 */
async function save_cfg(body) {
    const r = await (await fetch(`${API}/api/me/ai-config`, { method: 'PUT', headers: H, body: JSON.stringify(body) })).json();
    assert(r.code === 0, `保存配置失败: ${JSON.stringify(r).slice(0, 120)}`);
    return r.data;
}

/**
 * 提问（简化封装）
 * @param {string} q
 */
async function ask_api(q) {
    const r = await (await fetch(`${API}/api/ai/ask`, { method: 'POST', headers: H, body: JSON.stringify({ question: q }) })).json();
    assert(r.code === 0, `ask 失败: ${JSON.stringify(r).slice(0, 120)}`);
    return r.data;
}

console.log('=== r44 走查（AI 多供应商 + 知识库 + 地图跳转） ===');

/* ---- API 层：双协议确定性验证 ---- */

await case_r('A1', 'OpenAI 兼容协议：自配 mock 端点 → /chat/completions 命中、不降级、rec 带 canteenId', async () => {
    await save_cfg({ provider: 'openai', baseUrl: MOCK_BASE, model: 'mock-chat-model', apiKey: 'sk-mock-key-1234567890' });
    const data = await ask_api('推荐一个好吃的菜');
    assert(data.degraded === false, `不应降级: degraded=${data.degraded} answer=${String(data.answer).slice(0, 80)}`);
    assert(String(data.answer).includes('MOCK-OPENAI'), `回答未命中 mock: ${String(data.answer).slice(0, 80)}`);
    assert(hits.openai.length > 0 && hits.openai[hits.openai.length - 1].auth === 'Bearer sk-mock-key-1234567890', 'Authorization 头未带 Bearer key');
    assert(hits.openai[hits.openai.length - 1].model === 'mock-chat-model', 'model 未透传');
    assert(Array.isArray(data.recommendations) && data.recommendations.length > 0, '推荐卡为空');
    for (const r of data.recommendations) assert(r.canteenId > 0, `推荐卡缺 canteenId: ${JSON.stringify(r).slice(0, 100)}`);
});

await case_r('A2', 'Anthropic 原生协议：/messages 命中（x-api-key + 版本头 + system 独立 + user 首条）', async () => {
    await save_cfg({ provider: 'anthropic', baseUrl: MOCK_BASE, model: 'mock-claude-model', apiKey: 'sk-ant-mock-key-1234' });
    const data = await ask_api('有什么不辣的推荐');
    assert(data.degraded === false, `不应降级: degraded=${data.degraded}`);
    assert(String(data.answer).includes('MOCK-ANTHROPIC'), `回答未命中 mock: ${String(data.answer).slice(0, 80)}`);
    const h = hits.anthropic[hits.anthropic.length - 1];
    assert(h && h.xapikey === 'sk-ant-mock-key-1234', 'x-api-key 头缺失/不符');
    assert(h.ver === '2023-06-01', `anthropic-version 头异常: ${h.ver}`);
    assert(h.hasSystem === true, 'system 未独立成字段');
    assert(h.firstRole === 'user', `messages 首条应为 user: ${h.firstRole}`);
    assert(h.model === 'mock-claude-model' && h.maxTokens === 600, 'model/max_tokens 未透传');
});

await case_r('A3', '供应商白名单：非法 provider 保存回落 openai', async () => {
    const data = await save_cfg({ provider: 'not-a-provider', baseUrl: MOCK_BASE, model: 'm', apiKey: 'k' });
    assert(data.provider === 'openai', `非法 provider 应回落 openai: ${data.provider}`);
});

/* ---- UI 层 ---- */
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript(([t, u]) => {
    localStorage.setItem('fk_token', t);
    localStorage.setItem('fk_user', JSON.stringify(u));
}, [login.data.token, login.data.user]);

/* 先恢复 openai + mock 配置供 U4 提问使用 */
await save_cfg({ provider: 'openai', baseUrl: MOCK_BASE, model: 'mock-chat-model', apiKey: 'sk-mock-key-1234567890' });

await page.goto(`${BASE}/ai`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ai-head', { timeout: 15000 });

await case_r('U1', '供应商下拉：7 项预设、贴纸化面板、默认 OpenAI 兼容 · 自定义', async () => {
    await page.click('.ai-head .cfg-btn');
    const dlg = page.locator('.el-dialog:visible');
    await dlg.waitFor({ state: 'visible', timeout: 5000 });
    const sel = dlg.locator('.provider-select');
    assert(await sel.count() === 1, '供应商下拉框缺失');
    // EP 新版 el-select 选中值渲染在 .el-select__placeholder 内（无 is-transparent）
    const cur = await sel.innerText();
    assert(cur.includes('OpenAI'), `默认选中异常: ${cur}`);
    await sel.click();
    const panel = page.locator('.el-select-dropdown:visible');
    await panel.waitFor({ state: 'visible', timeout: 5000 });
    const labels = await panel.locator('.el-select-dropdown__item').allInnerTexts();
    assert(labels.length === 7, `预设项应 7 个: ${labels.length} -> ${labels}`);
    assert(labels.join().includes('DeepSeek') && labels.join().includes('Anthropic') && labels.join().includes('智谱'), `预设缺失: ${labels}`);
    await page.screenshot({ path: `${OUT}\\r44-provider-dropdown.png` });
});

await case_r('U2', '选 Anthropic 预设：自动填官方端点与推荐模型 + 原生协议提示', async () => {
    await page.locator('.el-select-dropdown:visible .el-select-dropdown__item:has-text("Anthropic")').click();
    await page.waitForTimeout(300);
    const dlg = page.locator('.el-dialog:visible');
    // el-select 不产生 .el-input__inner，表单输入依次为：baseUrl(0) / model(1) / apiKey(2)
    const inputs = dlg.locator('.el-form-item .el-input__inner');
    const baseVal = await inputs.nth(0).inputValue();
    const modelVal = await inputs.nth(1).inputValue();
    assert(baseVal === 'https://api.anthropic.com/v1', `端点未自动填: ${baseVal}`);
    assert(modelVal === 'claude-sonnet-4-5', `推荐模型未自动填: ${modelVal}`);
    const tip = await dlg.locator('.provider-tip').innerText();
    assert(tip.includes('Claude 原生'), `协议提示缺失: ${tip}`);
    await page.screenshot({ path: `${OUT}\\r44-provider-anthropic.png` });
});

await case_r('U3', '保存设置：PUT 携带 provider=anthropic，回显掩码', async () => {
    const dlg = page.locator('.el-dialog:visible');
    const inputs = dlg.locator('.el-form-item .el-input__inner');
    await inputs.nth(2).fill('sk-ant-ui-test-key-0001'); // API Key
    const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/me/ai-config') && r.request().method() === 'PUT', { timeout: 8000 }),
        dlg.locator('.cfg-ops button:has-text("保存设置")').click(),
    ]);
    const body = await resp.json();
    assert(resp.status() === 200 && body.code === 0, `保存失败: ${JSON.stringify(body).slice(0, 120)}`);
    const saved = body.data || {};
    assert(saved.provider === 'anthropic' && saved.baseUrl === 'https://api.anthropic.com/v1', `保存值异常: ${JSON.stringify(saved).slice(0, 120)}`);
    assert(saved.hasKey === true && String(saved.apiKeyMasked || '').includes('****'), '掩码未回显');
    // 关闭弹窗
    await page.locator('.el-dialog:visible .el-dialog__headerbtn').click();
    await page.waitForTimeout(400);
});

await case_r('U4', 'AI 提问端到端：回答+推荐卡渲染，「地图」chip 跳 /map?focus= 弹食区详情卡', async () => {
    // 切回 openai + mock（U3 已存 anthropic）
    await save_cfg({ provider: 'openai', baseUrl: MOCK_BASE, model: 'mock-chat-model', apiKey: 'sk-mock-key-1234567890' });
    await page.fill('.input-bar .el-input__inner', '推荐一个好吃的');
    await page.click('.input-bar button:has-text("发送")');
    // 等回答气泡 + 推荐卡（mock 即回）
    await page.locator('.msg.ai .recs .rec-card').first().waitFor({ state: 'visible', timeout: 20000 });
    const chip = page.locator('.msg.ai .recs .rec-map').first();
    assert(await chip.count() >= 0, ''); // chip 可能随 rec 顺序存在
    const chipCount = await page.locator('.msg.ai .recs .rec-map').count();
    assert(chipCount > 0, '推荐卡无「地图」chip');
    await page.screenshot({ path: `${OUT}\\r44-rec-map-chip.png` });
    // 点击 chip → /map?focus=id → 食区详情卡弹出
    await Promise.all([
        page.waitForURL(/\/map\?focus=\d+/, { timeout: 15000 }),
        chip.click(),
    ]);
    await page.locator('.pin-card').waitFor({ state: 'visible', timeout: 20000 });
    const focusId = Number(new URL(page.url()).searchParams.get('focus'));
    const cardName = await page.locator('.pin-card .pc-title').innerText();
    assert(focusId > 0 && cardName.length > 0, `focus 直达异常: url=${page.url()} card=${cardName}`);
    await page.waitForTimeout(2500); // 等矢量底图出图（SwiftShader 首帧慢，测量噪声规避）
    await page.screenshot({ path: `${OUT}\\r44-map-focus.png` });
});

/* ---- 收尾：恢复原配置 ---- */
try {
    await save_cfg({ provider: orig.provider, baseUrl: orig.baseUrl, model: orig.model, apiKey: '' });
    console.log('  已恢复原 AI 配置');
} catch { /* 恢复失败不影响走查结论 */ }

await browser.close();
mock.close();
console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail ? 1 : 0);
