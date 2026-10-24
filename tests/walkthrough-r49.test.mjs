/**
 * r49 走查：模型快切 chip（发送旁 popover 切换/删除/管理入口）+ 重选钮贴纸化 + 顶部提示精简
 * 运行：node tests/walkthrough-r49.test.mjs
 * 前置：docker compose up -d --build frontend（前端 8095 / 后端 3000）
 *
 * 用例：
 * - U1 空态：chip 显示「规则推荐」→ 快切面板空态提示 →「管理」打开模型设置弹窗（顶部提示为精简后文案）
 * - U2 添加模型：重选钮为贴纸小钮（原生 button，淡橙 hover 语言）→ 选 DeepSeek 进表单 → 保存 → chip 显示新模型名
 * - U3 快切面板：面板列出模型 + 使用中徽标 → 添加第二个模型后切换 → chip 更新 → 面板内删除（确认）→ chip 回落
 * - 收尾：删除走查残留模型（幂等）
 * 截图：r49-input-chip.png / r49-picker.png / r49-dialog-tip.png
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:8095';
const EXE = 'C:\\Users\\Zviolin\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const OUT = 'C:\\Users\\Zviolin\\AppData\\Local\\Temp\\lb-e2e';

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

/* 幂等准备：清走查残留模型（按展示名/模型 ID 识别） */
async function cleanup_models() {
    const d = await (await fetch(`${BASE}/api/ai/models`, { headers: user.H })).json();
    for (const m of (d.data && d.data.list) || []) {
        if (m.modelId === 'r49-test-model' || (m.displayName || '').startsWith('r49')) {
            await fetch(`${BASE}/api/ai/models/${m.id}`, { method: 'DELETE', headers: user.H });
        }
    }
}
await cleanup_models();

const browser = await chromium.launch({ headless: true, executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

/**
 * 关闭模型设置弹窗（footer「取消」语义是回列表态不关弹窗，须点右上 X）并等 overlay 隐藏
 */
async function close_dialog() {
    await page.locator('.el-dialog:visible .el-dialog__headerbtn').click();
    await page.waitForSelector('.el-overlay', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
}

/**
 * 登录：API 拿 token（DEBUG 验证码通道）后注入 localStorage（auth store 键 fk_token/fk_user），绕开 UI 验证码
 */
async function ui_login() {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(([tok, usr]) => {
        localStorage.setItem('fk_token', tok);
        localStorage.setItem('fk_user', JSON.stringify(usr));
    }, [user.token, user.user]);
    await page.goto(`${BASE}/ai`, { waitUntil: 'domcontentloaded' });
}

console.log('=== r49 走查（模型快切 chip + 重选钮 + 提示精简） ===');
await ui_login();
await page.waitForSelector('.input-bar .model-chip', { timeout: 8000 });

await case_r('U1', '空态：chip「规则推荐」→ 快切面板空态提示 →「管理」开设置弹窗且顶部提示已精简', async () => {
    const chip = page.locator('.input-bar .model-chip');
    assert((await chip.innerText()).includes('规则推荐'), 'chip 应显示「规则推荐」');
    await chip.click();
    await page.waitForTimeout(400);
    assert(await page.locator('.mp-empty').isVisible(), '快切面板空态提示未显示');
    await page.screenshot({ path: `${OUT}\\r49-picker.png` });
    await page.locator('.mp-manage').click();
    await page.waitForTimeout(600);
    const dlg = page.locator('.el-dialog:visible');
    const tip = await dlg.locator('.ai-tip').innerText();
    assert(tip.includes('选供应商自动带出接口地址'), `提示应已精简: ${tip.slice(0, 40)}`);
    assert(tip.length < 80, `提示仍过长: ${tip.length} 字`);
    await page.screenshot({ path: `${OUT}\\r49-dialog-tip.png` });
    await close_dialog();
});

await case_r('U2', '添加模型：重选钮贴纸化 → DeepSeek 表单（地址自动填）→ 保存 → chip 更新为模型名', async () => {
    const chip = page.locator('.input-bar .model-chip');
    // 探针：chip 中心点命中的实际元素（诊断透明遮挡）
    const probe = await chip.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        const overlays = [...document.querySelectorAll('.el-overlay')].map((o) => ({ disp: getComputedStyle(o).display, pe: getComputedStyle(o).pointerEvents }));
        const popper = el.closest('.input-bar').querySelector('.el-popper');
        return { hit: hit ? `${hit.tagName}.${hit.className}`.slice(0, 80) : 'null', overlays, popperVisible: popper ? getComputedStyle(popper).display : 'none' };
    });
    console.log('  [探针]', JSON.stringify(probe));
    await chip.click();
    await page.waitForTimeout(300);
    await page.locator('.mp-manage').click();
    await page.waitForTimeout(600);
    const dlg = page.locator('.el-dialog:visible');
    // 空态下 open_cfg 自动进入 pick 供应商网格（无 add-model-btn），直接选 DeepSeek
    await dlg.locator('.prov-item:has-text("DeepSeek")').click();
    await page.waitForTimeout(300);
    // r49：重选钮改为原生贴纸小钮（不再是 el-button text）
    const repick = dlg.locator('.prov-repick');
    assert(await repick.isVisible(), '重选钮未显示');
    assert(await repick.evaluate((el) => el.tagName === 'BUTTON'), '重选钮应为原生 button');
    const inputs = dlg.locator('.el-form-item .el-input__inner');
    assert((await inputs.nth(0).inputValue()) === 'https://api.deepseek.com', '接口地址未自动填');
    await inputs.nth(1).fill('r49-test-model');
    await inputs.nth(2).fill('r49测试模型');
    await inputs.nth(3).fill('sk-r49-test');
    await dlg.locator('.cfg-ops .el-button:has-text("添加模型")').click();
    await page.waitForTimeout(600);
    // 保存语义 = 回列表态（弹窗仍开），先关弹窗再验 chip
    await close_dialog();
    assert((await chip.innerText()).includes('r49测试模型'), 'chip 应显示新模型展示名');
    assert(await chip.evaluate((el) => el.classList.contains('on')), 'chip 应有 on 态（橙点）');
    await page.screenshot({ path: `${OUT}\\r49-input-chip.png` });
});

await case_r('U3', '快切面板：切换第二个模型 → chip 更新 → 面板内删除（确认）→ chip 回落', async () => {
    // 弹窗里再添加一个自定义模型（两个模型才好验切换）
    const chip = page.locator('.input-bar .model-chip');
    await chip.click();
    await page.waitForTimeout(300);
    await page.locator('.mp-manage').click();
    await page.waitForTimeout(600);
    let dlg = page.locator('.el-dialog:visible');
    await dlg.locator('.add-model-btn').click();
    await page.waitForTimeout(300);
    await dlg.locator('.prov-item:has-text("自定义")').click();
    await page.waitForTimeout(300);
    const inputs = dlg.locator('.el-form-item .el-input__inner');
    await inputs.nth(0).fill('http://host.docker.internal:17541/v1');
    await inputs.nth(1).fill('r49-test-model');
    await inputs.nth(2).fill('r49第二模型');
    await inputs.nth(3).fill('sk-r49-test2');
    await dlg.locator('.cfg-ops .el-button:has-text("添加模型")').click();
    await page.waitForTimeout(600);
    await close_dialog();
    // 从快切面板切换
    await chip.click();
    await page.waitForTimeout(400);
    const items = page.locator('.mp-list .mp-item');
    assert((await items.count()) === 2, `面板应列 2 个模型: ${await items.count()}`);
    assert(await items.nth(0).locator('.mp-using').isVisible(), '第一项应有使用中徽标');
    await page.screenshot({ path: `${OUT}\\r49-picker-2models.png` });
    // 注意：列表按 is_selected DESC, id DESC 排序，切换后选中项排到首位——定位必须按模型名文本，勿用位置索引
    await page.locator('.mp-list .mp-item:has-text("r49第二模型")').click(); // 切到第二模型
    await page.waitForTimeout(600);
    assert((await chip.innerText()).includes('r49第二模型'), '切换后 chip 应更新');
    // 面板内删除使用中模型（确认弹窗）
    await chip.click();
    await page.waitForTimeout(300);
    await page.locator('.mp-list .mp-item:has-text("r49第二模型") .mp-del').click();
    await page.waitForTimeout(500);
    const mbox = page.locator('.el-message-box:visible');
    assert(await mbox.isVisible(), '删除确认弹窗未弹出');
    // 确认弹窗文案应指向待删的第二模型（防错删）
    assert((await mbox.innerText()).includes('r49第二模型'), `确认弹窗对象错误: ${(await mbox.innerText()).slice(0, 60)}`);
    await mbox.locator('button:has-text("删除")').click();
    await page.waitForTimeout(800);
    console.log('  [探针] 删除后 chip:', await chip.innerText());
    console.log('  [探针] 删除后面板项数:', await items.count());
    assert((await chip.innerText()).includes('r49测试模型'), '删除后 chip 应回落到剩余使用中模型');
    // 关面板收尾
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
});

/* 幂等收尾：清走查残留模型 */
await cleanup_models();

await browser.close();
console.log(`\n=== 结果: ${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail > 0 ? 1 : 0);
