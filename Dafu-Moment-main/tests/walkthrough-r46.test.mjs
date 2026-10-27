/**
 * r46 走查：AI 模型列表（Trae CN 式多配置）+ 密钥 AES-GCM 加密落库
 * 运行：node tests/walkthrough-r46.test.mjs
 * 前置：docker compose up -d --build backend frontend（前端 8095 / 后端 3000）
 *
 * 用例：
 * - A1 列表空态：GET /api/ai/models 返回 {list:[], selectedId:null}
 * - A2 新增 openai 兼容模型（首个自动选中）→ ask 命中 mock（Bearer 头实锤）
 * - A3 密文落库实锤：库内 api_key_cipher 无明文 sk- 前缀、user.ai_config 已退役
 * - A4 anthropic 接口类型快照：新增第二个模型 → 切换使用 → ask 走 /messages；编辑展示名称不覆盖密钥
 * - A5 校验：未知供应商 / 缺模型 ID → 422
 * - U1 弹窗：列表两行 + 协议小签 + 添加表单（选供应商自动带接口类型与地址、模型 ID 空、文档链接）
 * - U2 切换使用 + 删除（确认弹窗）后列表收缩、状态徽标同步
 * - 收尾：删除全部走查模型配置（幂等）
 */
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';
import { execSync } from 'child_process';

const BASE = 'http://localhost:8095';
const API = 'http://localhost:3000';
const EXE = 'C:\\Users\\Zviolin\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const OUT = 'C:\\Users\\Zviolin\\AppData\\Local\\Temp\\lb-e2e';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
let pass = 0, fail = 0;

/**
 * 登记一个走查用例
 * @param {string} id - A-x / U-x
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

/* ---------------- 本地 mock 双协议端点（openai :17531 / anthropic :17532） ---------------- */
const hits_openai = [];
const hits_ant = [];
const mock_openai = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
        if (req.url.endsWith('/chat/completions')) {
            hits_openai.push({ auth: req.headers['authorization'] });
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ choices: [{ message: { content: '【MOCK-OPENAI-R46】模型列表链路连通。' } }] }));
        } else { res.statusCode = 404; res.end('{}'); }
    });
});
const mock_ant = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
        if (req.url.endsWith('/messages')) {
            hits_ant.push({ ver: req.headers['anthropic-version'], xapikey: req.headers['x-api-key'] });
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ content: [{ type: 'text', text: '【MOCK-ANTHROPIC-R46】接口类型快照连通。' }] }));
        } else { res.statusCode = 404; res.end('{}'); }
    });
});
await new Promise((r) => mock_openai.listen(17531, r));
await new Promise((r) => mock_ant.listen(17532, r));
console.log('  mock 端点已启动 :17531(openai) / :17532(anthropic)');

/* ---------------- 登录 ---------------- */
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
    assert(r.data && r.data.token, `${username} 登录失败: ${JSON.stringify(r).slice(0, 100)}`);
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

console.log('=== r46 走查（AI 模型列表 + 密钥加密落库） ===');

await case_r('A1', '列表空态：GET /api/ai/models 返回 {list:[], selectedId:null}', async () => {
    const r = await (await fetch(`${API}/api/ai/models`, { headers: user.H })).json();
    assert(r.code === 0 && Array.isArray(r.data.list) && r.data.list.length === 0, `列表异常: ${JSON.stringify(r).slice(0, 140)}`);
    assert(r.data.selectedId === null, `selectedId 应为 null: ${JSON.stringify(r.data.selectedId)}`);
});

await case_r('A2', '新增 openai 兼容模型（首个自动选中）→ ask 命中 mock（Bearer 头实锤）', async () => {
    const r = await (await fetch(`${API}/api/ai/models`, {
        method: 'POST', headers: user.H,
        body: JSON.stringify({
            provider: 'openai', protocol: 'openai',
            baseUrl: 'http://host.docker.internal:17531/v1',
            modelId: 'mock-r46-chat', displayName: '本地试验',
            apiKey: 'sk-r46-openai-1234567890',
        }),
    })).json();
    assert(r.code === 0, `新增失败: ${JSON.stringify(r).slice(0, 140)}`);
    const lst = await (await fetch(`${API}/api/ai/models`, { headers: user.H })).json();
    assert(lst.data.selectedId === r.data.id, '首个新增应自动选中');
    assert(lst.data.list[0].apiKeyMasked === 'sk-r****7890', `掩码异常: ${lst.data.list[0].apiKeyMasked}`);
    // ask → mock 命中
    const ask = await (await fetch(`${API}/api/ai/ask`, { method: 'POST', headers: user.H, body: JSON.stringify({ question: '推荐一个好吃的' }) })).json();
    assert(ask.code === 0 && ask.data.degraded === false, `ask 异常: ${JSON.stringify(ask).slice(0, 140)}`);
    assert(String(ask.data.answer).includes('MOCK-OPENAI-R46'), `回答未命中 mock: ${String(ask.data.answer).slice(0, 80)}`);
    assert(hits_openai.length > 0 && hits_openai[hits_openai.length - 1].auth === 'Bearer sk-r46-openai-1234567890', 'Bearer 密钥头不符');
});

await case_r('A3', '密文落库实锤：api_key_cipher 无明文 sk- 前缀；user.ai_config 已退役为 NULL', async () => {
    const cipher = execSync(
        'docker exec dafu-mysql mysql -uroot -pdafu_root_2026 dafu -N -e "SELECT api_key_cipher FROM ai_model WHERE user_id=2 ORDER BY id DESC LIMIT 1"',
        { encoding: 'utf8' }
    ).trim();
    assert(cipher.length > 60, `密文过短: ${cipher.slice(0, 40)}`);
    assert(!cipher.includes('sk-r46'), '库内出现明文密钥！');
    const legacy = execSync(
        'docker exec dafu-mysql mysql -uroot -pdafu_root_2026 dafu -N -e "SELECT COUNT(*) FROM user WHERE ai_config IS NOT NULL AND ai_config <> \'\'"',
        { encoding: 'utf8' }
    ).trim();
    assert(legacy === '0', `user.ai_config 应全空: ${legacy}`);
});

await case_r('A4', 'anthropic 接口类型快照：新增第二个模型 → 切换使用 → ask 走 /messages；编辑不覆盖密钥', async () => {
    const r = await (await fetch(`${API}/api/ai/models`, {
        method: 'POST', headers: user.H,
        body: JSON.stringify({
            provider: 'anthropic', protocol: 'anthropic',
            baseUrl: 'http://host.docker.internal:17532/v1',
            modelId: 'claude-mock-r46', displayName: '',
            apiKey: 'sk-r46-anthropic-key-0001',
        }),
    })).json();
    assert(r.code === 0, `新增失败: ${JSON.stringify(r).slice(0, 140)}`);
    const ant_id = r.data.id;
    assert(ant_id, '缺 id');
    // 新增不应抢占使用中（仍为首个 openai 模型）
    const before = await (await fetch(`${API}/api/ai/models`, { headers: user.H })).json();
    assert(before.data.selectedId !== ant_id, '后续新增不应自动选中');
    // 切换使用 → ask 走 anthropic
    const sel = await fetch(`${API}/api/ai/models/${ant_id}/select`, { method: 'PUT', headers: user.H });
    assert(sel.status === 200, `切换失败: ${sel.status}`);
    const ask = await (await fetch(`${API}/api/ai/ask`, { method: 'POST', headers: user.H, body: JSON.stringify({ question: '有什么辣的' }) })).json();
    assert(ask.code === 0 && String(ask.data.answer).includes('MOCK-ANTHROPIC-R46'), `anthropic ask 异常: ${JSON.stringify(ask).slice(0, 140)}`);
    assert(hits_ant.length > 0 && hits_ant[hits_ant.length - 1].ver === '2023-06-01', 'anthropic-version 头缺失');
    // 编辑：改展示名称、不传 apiKey → 密钥保留（掩码仍在）
    const up = await (await fetch(`${API}/api/ai/models/${ant_id}`, {
        method: 'PUT', headers: user.H,
        body: JSON.stringify({
            provider: 'anthropic', protocol: 'anthropic',
            baseUrl: 'http://host.docker.internal:17532/v1',
            modelId: 'claude-mock-r46', displayName: 'Claude 试验',
        }),
    })).json();
    assert(up.code === 0, `编辑失败: ${JSON.stringify(up).slice(0, 140)}`);
    const after = await (await fetch(`${API}/api/ai/models`, { headers: user.H })).json();
    const row = after.data.list.find((m) => m.id === ant_id);
    assert(row.displayName === 'Claude 试验' && row.apiKeyMasked === 'sk-r****0001', `编辑回显异常: ${JSON.stringify(row)}`);
});

await case_r('A5', '校验：未知供应商 / 缺模型 ID → 422', async () => {
    const r1 = await fetch(`${API}/api/ai/models`, {
        method: 'POST', headers: user.H,
        body: JSON.stringify({ provider: 'ghost', baseUrl: 'https://x.com/v1', modelId: 'm', apiKey: 'k' }),
    });
    assert(r1.status === 422, `未知供应商应 422: ${r1.status}`);
    const r2 = await fetch(`${API}/api/ai/models`, {
        method: 'POST', headers: user.H,
        body: JSON.stringify({ provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', modelId: '', apiKey: 'k' }),
    });
    const j2 = await r2.json();
    assert(r2.status === 422 && String(j2.msg).includes('模型 ID'), `缺模型 ID 应 422: ${r2.status} ${j2.msg}`);
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

await case_r('U1', '弹窗：列表两行（协议小签/使用中高亮）+ 添加表单（供应商联动接口类型与地址、模型 ID 空、文档链接）', async () => {
    await page.click('.ai-head .cfg-btn');
    const dlg = page.locator('.el-dialog:visible');
    await dlg.waitFor({ state: 'visible', timeout: 5000 });
    await dlg.locator('.model-item').first().waitFor({ state: 'visible', timeout: 5000 });
    // 列表两行：使用中徽标 + 协议小签
    assert(await dlg.locator('.model-item').count() === 2, '列表应 2 行');
    assert(await dlg.locator('.model-item.sel').count() === 1, '应恰一行使用中');
    assert(await dlg.locator('.model-item.sel .mi-using').innerText() === '使用中', '使用中徽标缺失');
    assert((await dlg.locator('.mi-proto.ant').count()) === 1, 'anthropic 协议小签缺失');
    await page.waitForTimeout(500); // 等弹窗淡入过渡完成，避免截图半透明
    await page.screenshot({ path: `${OUT}\\r46-dialog-list.png` });
    // 打开添加表单：默认第一个供应商（OpenAI 兼容·自定义，地址空）
    await dlg.locator('.add-model-btn').click();
    await dlg.locator('.el-form').waitFor({ state: 'visible', timeout: 5000 });
    // 切到 DeepSeek：接口类型自动带出 + 接口地址自动填；模型 ID 保持空
    await dlg.locator('.provider-select').first().click();
    await page.locator('.el-select-dropdown:visible .el-select-dropdown__item:has-text("DeepSeek")').click();
    await page.waitForTimeout(300);
    const inputs = dlg.locator('.el-form-item .el-input__inner');
    assert(await inputs.nth(0).inputValue() === 'https://api.deepseek.com/v1', '接口地址未随供应商自动更新');
    assert(await inputs.nth(1).inputValue() === '', '模型 ID 应保持空');
    // 接口类型可手动改 → 协议 chip 变 Anthropic
    await dlg.locator('.provider-select').nth(1).click();
    await page.locator('.el-select-dropdown:visible .el-select-dropdown__item:has-text("Anthropic Messages 格式")').click();
    await page.waitForTimeout(300);
    assert((await dlg.locator('.proto-chip').innerText()).includes('Anthropic 原生'), '协议 chip 未随手改接口类型切换');
    const hrefs = await dlg.locator('.doc-link').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    assert(hrefs.some((h) => h && h.includes('deepseek')), `文档链接应仍是 DeepSeek（随供应商）: ${hrefs}`);
    // 填模型 ID / 展示名称 / 密钥 → 保存 → 列表 3 行
    await inputs.nth(1).fill('mock-r46-ui');
    await inputs.nth(2).fill('试验 GPT');
    await inputs.nth(3).fill('sk-r46-ui-987654321');
    await page.waitForTimeout(400); // 等下拉浮层淡出后再截图
    await page.screenshot({ path: `${OUT}\\r46-dialog-addform.png` });
    await dlg.locator('.el-dialog__footer button:has-text("添加模型")').click();
    await dlg.locator('.model-item').nth(2).waitFor({ state: 'visible', timeout: 5000 });
    assert(await dlg.locator('.model-item').count() === 3, '保存后列表应 3 行');
    assert((await dlg.locator('.model-item:has-text("试验 GPT")').count()) === 1, '新模型行缺失');
});

await case_r('U2', '切换使用 + 删除（确认弹窗）：状态徽标同步、列表收缩', async () => {
    const dlg = page.locator('.el-dialog:visible');
    // 切换使用「试验 GPT」
    await dlg.locator('.model-item:has-text("试验 GPT") .mi-use').click();
    await page.waitForTimeout(600);
    assert((await dlg.locator('.model-item:has-text("试验 GPT")').getAttribute('class')).includes('sel'), '试验 GPT 应为使用中');
    assert((await dlg.locator('.cfg-state').innerText()).includes('试验 GPT'), '状态徽标未同步');
    await page.waitForTimeout(500); // 等 toast 出现与过渡稳定
    await page.screenshot({ path: `${OUT}\\r46-after-switch.png` });
    // 删除 anthropic 行（Claude 试验）：图标 → 确认弹窗 → 删除
    await dlg.locator('.model-item:has-text("Claude 试验") .mi-op.danger').click();
    const confirm = page.locator('.el-message-box:visible');
    await confirm.waitFor({ state: 'visible', timeout: 5000 });
    await confirm.locator('button:has-text("删除")').click();
    await page.waitForTimeout(600);
    assert(await dlg.locator('.model-item').count() === 2, '删除后列表应 2 行');
    assert((await dlg.locator('.model-item:has-text("Claude 试验")').count()) === 0, 'Claude 试验应已删除');
    // 关闭弹窗
    await page.locator('.el-dialog:visible .el-dialog__headerbtn').click();
    await page.waitForTimeout(400);
});

/* ---- 收尾：清空走查产生的模型配置 ---- */
try {
    const lst = await (await fetch(`${API}/api/ai/models`, { headers: user.H })).json();
    for (const m of (lst.data?.list || [])) {
        await fetch(`${API}/api/ai/models/${m.id}`, { method: 'DELETE', headers: user.H });
    }
    console.log('  已清空走查模型配置（幂等收尾）');
} catch { /* 收尾失败不影响走查结论 */ }

await browser.close();
mock_openai.close();
mock_ant.close();
console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail ? 1 : 0);
