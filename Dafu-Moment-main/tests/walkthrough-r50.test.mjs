/**
 * r50 走查（r51c 适配）：福大统一身份认证（SSO）UI 全链路——统一「跳转授权页」形态
 * U1 登录页 SSO 入口 → 授权页（intent=login）→ 全新学号自动建号登录
 *    + 已有学号（数字登录名）账号进授权页自动预填 / 无学号不预填
 *    + 学号 placeholder 仅「学号」，无「如 102400207」示例底字（r51c 用户要求）
 * U2 个人中心「福大认证」→ 授权页（intent=bind）→ 绑定 → 「福大认证」头衔徽章
 * U3 认证信息弹窗 + 解绑 → 徽章消失
 * 幂等：脚本收尾清 SSO 建号残留账号与 zhangwl 认证字段
 *
 * 运行：node tests/walkthrough-r50.test.mjs（需 dafu 全容器运行中，:8095）
 */
import { createRequire } from 'module';
const require = createRequire('C:/WINDOWS/TEMP/27pw/anchor.js');
const { chromium } = require('playwright-core');

const BASE = 'http://localhost:8095';
const EXE = 'C:\\Users\\Zviolin\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
let passed = 0, failed = 0;

/** 断言工具：全绿打勾，失败计数并继续（收尾统一 exit code） */
function assert(cond, name, extra = '') {
    const mark = cond ? 'PASS' : 'FAIL';
    cond ? passed++ : failed++;
    console.log(`${mark} ${name}${extra ? ' | ' + extra : ''}`);
}

/* ---------- 幂等清理：SSO 残留账号 + zhangwl 认证字段 ---------- */
import { execSync } from 'child_process';
function db_exec(sql) {
    return execSync(
        `docker exec dafu-mysql mysql -uroot -pdafu_root_2026 --default-character-set=utf8mb4 -e "${sql}"`,
        { stdio: 'pipe' }
    ).toString();
}
db_exec("DELETE FROM dafu.user WHERE username='2026000001'; UPDATE dafu.user SET fzu_uid=NULL, fzu_name=NULL, fzu_verified=0 WHERE username='zhangwl';");

/* ---------- API 登录基建：token + localStorage 注入 ---------- */
const cap = await (await fetch(`${BASE}/api/auth/captcha`)).json();
const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'zhangwl', password: '123456', captchaId: cap.data.captchaId, captchaCode: cap.data.debugCode }),
})).json();
if (!lr.data || !lr.data.token) { console.error('API 登录失败', lr); process.exit(1); }

/** 注入登录态后打开页面 */
async function open_with_auth(page, path, tok = lr.data.token, usr = JSON.stringify(lr.data.user)) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(([t, u]) => {
        localStorage.setItem('fk_token', t);
        localStorage.setItem('fk_user', u);
    }, [tok, usr]);
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
}

/** 关闭可见弹窗（点 header ×，等遮罩消失） */
async function close_dialog(page) {
    const x = page.locator('.el-dialog:visible .el-dialog__headerbtn');
    if (await x.count()) {
        await x.first().click();
        await page.waitForSelector('.el-overlay:not([style*="display: none"])', { state: 'hidden', timeout: 3000 }).catch(() => {});
    }
}

const browser = await chromium.launch({ headless: true, executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

/* ---------- U1 登录页 SSO 入口 → 授权页登录（demo 模式统一跳授权页） ---------- */
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.sso-btn', { timeout: 8000 });
assert(true, 'U1.1 登录页 SSO 按钮渲染');

// r51c：demo 模式点击 SSO 不再弹窗，而是跳转本站校方风格授权页
await page.click('.sso-btn');
await page.waitForURL('**/auth/fzu/authorize?intent=login*', { timeout: 8000 });
await page.waitForSelector('.authz-head', { timeout: 8000 });
assert(true, 'U1.2 跳转授权页（校方风格，intent=login）');

// 学号 placeholder 仅「学号」，不得再出现「如 102400207」类示例底字（r51c 用户要求）
const sidPh = await page.locator('.authz-card input[placeholder]').first().getAttribute('placeholder');
assert(sidPh === '学号', 'U1.3 学号输入框 placeholder 仅「学号」', `placeholder=${sidPh}`);

// 全新学号：2026000001（CAS 桩姓名确定性映射：李志强）
await page.fill('.authz-card input[placeholder="学号"]', '2026000001');
await page.fill('.authz-card input[type="password"]', 'test123456');
await page.click('.authz-card button:has-text("同意并授权")');
await page.waitForURL(`${BASE}/`, { timeout: 8000 });
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('fk_user') || '{}'));
assert(after.fzu_verified === true && after.fzu_name === '李志强', 'U1.4 SSO 授权登录成功（建号+绑定）', `name=${after.fzu_name}`);

/* ---------- U1.5 已有学号账号（username=2026000001）进授权页 intent=bind 自动预填 ---------- */
const u1tok = await page.evaluate(() => localStorage.getItem('fk_token'));
const u1usr = await page.evaluate(() => localStorage.getItem('fk_user'));
await open_with_auth(page, '/auth/fzu/authorize?intent=bind', u1tok, u1usr);
await page.waitForSelector('.authz-head', { timeout: 8000 });
const prefilled = await page.locator('.authz-card input[placeholder="学号"]').inputValue();
assert(prefilled === '2026000001', 'U1.5 已有学号自动预填', `prefilled=${prefilled || '(空)'}`);

/* ---------- U2 个人中心绑定认证 → 授权页（intent=bind）→ 头衔徽章 ---------- */
// zhangwl（username 非数字、未绑定）进授权页学号不预填
await open_with_auth(page, '/me');
await page.waitForSelector('.profile-head', { timeout: 8000 });
const badgeBefore = await page.locator('.profile-head .fzu-badge').count();
assert(badgeBefore === 0, 'U2.1 zhangwl 未认证时无头衔徽章');

// r51c：未绑定点击「福大认证」→ 跳授权页 intent=bind（不再弹绑定表单弹窗）
await page.click('.head-ops button:has-text("福大认证")');
await page.waitForURL('**/auth/fzu/authorize?intent=bind*', { timeout: 8000 });
await page.waitForSelector('.authz-head', { timeout: 8000 });
const tipText = (await page.locator('.authz-tip').textContent()).trim();
assert(tipText.includes('绑定到当前账号'), 'U2.2 跳转授权页（intent=bind，绑定说明条）');
const sidEmpty = await page.locator('.authz-card input[placeholder="学号"]').inputValue();
assert(sidEmpty === '', 'U2.3 无已有学号的账号不预填', `value=${sidEmpty || '(空)'}`);

await page.fill('.authz-card input[placeholder="学号"]', '102400207');
await page.fill('.authz-card input[type="password"]', 'test123456');
await page.click('.authz-card button:has-text("同意并授权")');
await page.waitForURL('**/me', { timeout: 8000 });
await page.waitForSelector('.profile-head .fzu-badge', { timeout: 8000 });
const badgeText = (await page.locator('.profile-head .fzu-badge').textContent()).trim();
assert(badgeText.includes('福大认证 · 赵志强'), 'U2.4 绑定后头衔徽章出现', badgeText);

/* ---------- U3 认证信息弹窗 + 解绑 ---------- */
await page.click('.head-ops button:has-text("认证信息")');
await page.waitForSelector('.el-dialog:visible .fzu-info', { timeout: 5000 });
const infoText = (await page.locator('.el-dialog:visible .fzu-info').textContent()).trim();
assert(infoText.includes('102400207') && infoText.includes('赵志强'), 'U3.1 认证信息展示（姓名+学号）');

await page.click('.el-dialog:visible button:has-text("解绑认证")');
await page.waitForSelector('.el-message-box:visible', { timeout: 5000 });
await page.click('.el-message-box:visible button:has-text("确定解绑")');
await page.waitForSelector('.profile-head .fzu-badge', { state: 'detached', timeout: 8000 });
assert(true, 'U3.2 解绑后头衔徽章消失');
await close_dialog(page).catch(() => {});

/* ---------- U4 解绑后再点「福大认证」→ 再次跳授权页且学号已清空 ---------- */
await page.click('.head-ops button:has-text("福大认证")');
await page.waitForURL('**/auth/fzu/authorize?intent=bind*', { timeout: 8000 });
await page.waitForSelector('.authz-head', { timeout: 8000 });
const sidAfter = await page.locator('.authz-card input[placeholder="学号"]').inputValue();
assert(sidAfter === '', 'U4.1 解绑后授权页学号不再预填', `value=${sidAfter || '(空)'}`);

await browser.close();

/* ---------- 收尾：清残留（幂等） ---------- */
db_exec("DELETE FROM dafu.user WHERE username='2026000001'; UPDATE dafu.user SET fzu_uid=NULL, fzu_name=NULL, fzu_verified=0 WHERE username='zhangwl';");

console.log(`\n结果：${passed} 通过 / ${failed} 失败`);
process.exit(failed ? 1 : 0);
