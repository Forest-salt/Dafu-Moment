/**
 * r47 走查：供应商收敛为国内 8 项 + 添加流程改「供应商选择列表」（Trae CN 式两列按钮网格）
 * 运行：node tests/walkthrough-r47.test.mjs
 * 用例：
 * - A1 注册表收敛：8 项国内供应商、无 anthropic/openai_official、openai 项显示名「自定义」
 * - A2 ask 链路回归：新增 openai 兼容模型（mock）→ ask 命中（协议路由未被收敛破坏）
 * - U1 添加流程：＋添加模型 → 供应商网格（自定义置顶/无国外项）→ 点 DeepSeek 进表单（地址自动填/模型 ID 空/文档链接）→ 保存列表 1 行
 * - U2 重选链路：添加中点「重选」回网格 → 选「自定义」→ 地址为空可手填
 * - 收尾：删除走查模型配置
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
 * @param {string} id
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

/* ---------------- 本地 mock（openai 兼容 :17541） ---------------- */
const hits = [];
const mock = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
        if (req.url.endsWith('/chat/completions')) {
            hits.push({ auth: req.headers['authorization'] });
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ choices: [{ message: { content: '【MOCK-R47】收敛后链路连通。' } }] }));
        } else { res.statusCode = 404; res.end('{}'); }
    });
});
await new Promise((r) => mock.listen(17541, r));

/**
 * API 登录（DEBUG 验证码通道）
 * @param {string} username
 * @param {string} password
 */
async function login_api(username, password) {
    const cap = await (await fetch(`${BASE}/api/auth/captcha`)).json();
    const r = await (await fetch(`${BASE}/api/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password, captchaId: cap.data.captchaId, captchaCode: cap.data.debugCode }),
    })).json();
    assert(r.data && r.data.token, `${username} 登录失败`);
    return { H: { authorization: `Bearer ${r.data.token}`, 'content-type': 'application/json' }, token: r.data.token, user: r.data.user };
}
const user = await login_api('zhangwl', '123456');

/* 幂等前置：清空 zhangwl 全部模型配置 */
{
    const first = await (await fetch(`${API}/api/ai/models`, { headers: user.H })).json();
    for (const m of (first.data?.list || [])) {
        await fetch(`${API}/api/ai/models/${m.id}`, { method: 'DELETE', headers: user.H });
    }
}

console.log('=== r47 走查（供应商国内收敛 + 选择列表） ===');

await case_r('A1', '注册表收敛：10 项国内供应商、无 anthropic/openai_official、openai 项显示名「自定义」', async () => {
    const r = await (await fetch(`${API}/api/ai/providers`, { headers: user.H })).json();
    const keys = (r.data || []).map((p) => p.providerKey);
    assert(keys.length === 10, `应 10 项: ${keys.length} (${keys})`);
    assert(!keys.includes('anthropic') && !keys.includes('openai_official'), `残留国外项: ${keys}`);
    const o = r.data.find((p) => p.providerKey === 'openai');
    assert(o && o.name === '自定义', `openai 项应改名「自定义」: ${o && o.name}`);
    for (const k of ['deepseek', 'qwen', 'kimi', 'zhipu', 'doubao', 'siliconflow', 'hunyuan', 'minimax', 'mimo']) {
        assert(keys.includes(k), `缺国内供应商 ${k}`);
    }
});

await case_r('A2', 'ask 链路回归：新增 openai 兼容模型（mock :17541）→ ask 命中', async () => {
    const r = await (await fetch(`${API}/api/ai/models`, {
        method: 'POST', headers: user.H,
        body: JSON.stringify({
            provider: 'deepseek', protocol: 'openai',
            baseUrl: 'http://host.docker.internal:17541/v1',
            modelId: 'mock-r47', displayName: '收敛试验', apiKey: 'sk-r47-key-1234567890',
        }),
    })).json();
    assert(r.code === 0, `新增失败: ${JSON.stringify(r).slice(0, 140)}`);
    const ask = await (await fetch(`${API}/api/ai/ask`, { method: 'POST', headers: user.H, body: JSON.stringify({ question: '推荐一个吃的' }) })).json();
    assert(ask.code === 0 && ask.data.degraded === false, `ask 异常: ${JSON.stringify(ask).slice(0, 140)}`);
    assert(String(ask.data.answer).includes('MOCK-R47'), `未命中 mock: ${String(ask.data.answer).slice(0, 80)}`);
    assert(hits.length > 0 && hits[hits.length - 1].auth === 'Bearer sk-r47-key-1234567890', 'Bearer 密钥头不符');
});

/* ---- UI 层 ---- */
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript(([t, u]) => {
    localStorage.setItem('fk_token', t);
    localStorage.setItem('fk_user', JSON.stringify(u));
}, [user.token, user.user]);

await page.goto(`${BASE}/ai`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ai-head', { timeout: 15000 });

await case_r('U1', '添加流程：＋添加模型 → 供应商网格（自定义置顶/无国外项）→ DeepSeek 表单（地址自动填/模型 ID 空/文档链接）→ 保存', async () => {
    await page.click('.ai-head .cfg-btn');
    const dlg = page.locator('.el-dialog:visible');
    await dlg.waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(600); // 等淡入完成
    // 列表态：1 行收敛试验 → 点添加
    await dlg.locator('.add-model-btn').click();
    await dlg.locator('.prov-grid').waitFor({ state: 'visible', timeout: 5000 });
    // 网格 10 项、自定义置顶、无国外项
    const names = await dlg.locator('.prov-item .prov-name').allInnerTexts();
    assert(names.length === 10, `网格应 10 项: ${names.length}`);
    assert(names[0] === '自定义', `自定义应置顶: ${names[0]}`);
    assert(!names.some((n) => n.includes('Anthropic') || n.includes('OpenAI 官方')), `网格残留国外项: ${names}`);
    await page.screenshot({ path: `${OUT}\\r47-pick-grid.png` });
    // 点 DeepSeek → 表单
    await dlg.locator('.prov-item:has-text("DeepSeek")').click();
    await dlg.locator('.el-form').waitFor({ state: 'visible', timeout: 5000 });
    assert((await dlg.locator('.prov-fixed').innerText()) === 'DeepSeek', '供应商应只读显示 DeepSeek');
    const inputs = dlg.locator('.el-form-item .el-input__inner');
    assert(await inputs.nth(0).inputValue() === 'https://api.deepseek.com', '接口地址未自动填'); // r48 核实：官方 base_url 不带 /v1
    assert(await inputs.nth(1).inputValue() === '', '模型 ID 应为空');
    const hrefs = await dlg.locator('.doc-link').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    assert(hrefs.some((h) => h && h.includes('deepseek')), `文档链接缺失: ${hrefs}`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}\\r47-form-deepseek.png` });
    // 填写并保存
    await inputs.nth(1).fill('deepseek-chat');
    await inputs.nth(2).fill('官方 DeepSeek');
    await inputs.nth(3).fill('sk-r47-ui-9876543210');
    await dlg.locator('.el-dialog__footer button:has-text("添加模型")').click();
    await page.waitForTimeout(700);
    assert(await dlg.locator('.model-item').count() === 2, '保存后列表应 2 行');
    assert((await dlg.locator('.model-item:has-text("官方 DeepSeek")').count()) === 1, '新模型行缺失');
});

await case_r('U2', '重选链路：添加中点「重选」回网格 → 选「自定义」→ 地址为空可手填', async () => {
    const dlg = page.locator('.el-dialog:visible');
    await dlg.locator('.add-model-btn').click();
    await dlg.locator('.prov-grid').waitFor({ state: 'visible', timeout: 5000 });
    await dlg.locator('.prov-item:has-text("自定义")').first().click();
    await dlg.locator('.el-form').waitFor({ state: 'visible', timeout: 5000 });
    assert((await dlg.locator('.prov-fixed').innerText()) === '自定义', '应选中自定义');
    const inputs = dlg.locator('.el-form-item .el-input__inner');
    assert(await inputs.nth(0).inputValue() === '', '自定义供应商地址应为空（手填）');
    assert((await dlg.locator('.doc-links').count()) === 0, '自定义无文档链接应隐藏');
    // 重选 → 回网格
    await dlg.locator('.prov-repick').click();
    await dlg.locator('.prov-grid').waitFor({ state: 'visible', timeout: 5000 });
    assert(await dlg.locator('.prov-item').count() === 10, '重选后网格应 10 项');
    // 取消回列表态并关弹窗
    await dlg.locator('.el-dialog__footer button:has-text("取消")').click();
    await page.waitForTimeout(400);
    await page.locator('.el-dialog:visible .el-dialog__headerbtn').click();
    await page.waitForTimeout(400);
});

/* ---- 收尾 ---- */
try {
    const lst = await (await fetch(`${API}/api/ai/models`, { headers: user.H })).json();
    for (const m of (lst.data?.list || [])) {
        await fetch(`${API}/api/ai/models/${m.id}`, { method: 'DELETE', headers: user.H });
    }
    console.log('  已清空走查模型配置（幂等收尾）');
} catch { /* 收尾失败不影响结论 */ }

await browser.close();
mock.close();
console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail ? 1 : 0);
