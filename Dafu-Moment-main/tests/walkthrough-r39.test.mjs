/**
 * r39 文档补齐功能 Playwright 走查（W 编号用例，node 直跑）
 * 运行：node tests/walkthrough-r39.test.mjs
 * 前置：docker compose up -d --build（前端 http://localhost:8095）
 * 覆盖：验证码登录 UI / 首页 tags chips + 维度排序胶囊 / 个人主页（直跳 + 评价卡昵称跳转）/
 *       点赞 toggle / 推荐角标 + 档口推荐小节 / 收藏初始态与取消
 * 幂等：推荐标记走查后 SQL 恢复；收藏结束复位；点赞断言按相对值（±1）；zhangwl 仅登录一次避开登录限流
 */
import { chromium } from 'playwright-core';
import { execSync } from 'child_process';
import fs from 'fs';

const BASE = 'http://localhost:8095';
const EXE = 'C:\\Users\\Zviolin\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const OUT = 'C:\\Users\\Zviolin\\AppData\\Local\\Temp\\lb-e2e';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
let pass = 0, fail = 0;

/**
 * 登记一个走查用例
 * @param {string} id - W-xx
 * @param {string} desc
 * @param {Function} fn
 */
async function case_w(id, desc, fn) {
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

/**
 * 执行容器内 SQL（仅限无中文语句；SQL 用单引号内层避免 PowerShell 转义）
 * @param {string} q
 */
function sql(q) {
    execSync(`docker exec dafu-mysql mysql -uroot -pdafu_root_2026 dafu -e "${q}"`, { stdio: 'pipe' });
}

/** 走查样本：档口 52 正新鸡排·美岐店（5 菜，推荐走查用）；菜品 1 拌粉（含评价流，作者跳转用）；user 9（主页 41 条评价，点赞用） */
const STATION_ID = 52;
const DISH_ID = 1;
const AUTHOR_ID = 9;
/** 种子学生（id=2 昵称 旗山干饭王，密码 123456） */
const SEED_USER = 'zhangwl';
const SEED_PWD = '123456';

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 120)));

/** 拦截验证码响应：DEBUG=true 时回显明文 debugCode（UI 走查专用通道） */
let debugCode = '';
page.on('response', async (res) => {
    if (res.url().includes('/api/auth/captcha') && res.status() === 200) {
        try {
            const j = await res.json();
            if (j.data && j.data.debugCode) debugCode = j.data.debugCode;
        } catch { /* 响应体非 JSON 时忽略 */ }
    }
});

console.log('=== r39 新功能走查（chromium 1280x800） ===');

console.log('[分组] 验证码登录');
await case_w('W1', '登录页验证码行渲染 + debugCode 填入 + zhangwl 登录成功', async () => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('.captcha-img', { timeout: 8000 });
    // 等拦截器拿到明文验证码（DEBUG=true 回显，轮询至多为 2s）
    for (let i = 0; i < 20 && !debugCode; i++) await page.waitForTimeout(100);
    assert(debugCode.length > 0, '未拦截到 /api/auth/captcha 的 debugCode（后端需 DEBUG=true）');
    // 登录表单三要素：精确 placeholder 匹配避开注册表单（el-tab-pane 非懒渲染 DOM 常驻）
    await page.fill('input[placeholder="用户名"]', SEED_USER);
    await page.fill('input[placeholder="密码"]', SEED_PWD);
    await page.fill('input[placeholder="验证码"]', debugCode); // first() 即登录 tab 的验证码框
    await page.press('input[placeholder="验证码"]', 'Enter'); // @keyup.enter=do_login
    await page.waitForFunction(() => !!localStorage.getItem('fk_token'), undefined, { timeout: 8000 });
    assert(true, '登录成功');
});

console.log('[分组] 首页 tags 与维度排序');
await case_w('W2', '首页点位卡 tags chips 渲染 + 八维排序胶囊点击发起 sort=queue 请求', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('.ptag', { timeout: 8000 });
    const tagCnt = await page.locator('.ptag').count();
    assert(tagCnt > 0, `tags chips 数=${tagCnt}`);
    const chips = page.locator('.sort-chips .chip');
    assert(await chips.count() === 8, `排序胶囊数=${await chips.count()}（期望 8）`);
    // 先挂请求等待再点击，实锤点击触发 sort=queue 拉新列表
    const reqPromise = page.waitForRequest((r) => r.url().includes('/api/canteens') && r.url().includes('sort=queue'), { timeout: 6000 });
    await chips.filter({ hasText: '排队时间' }).click();
    await reqPromise;
    const active = await page.locator('.sort-chips .chip.active').textContent();
    assert(active.includes('排队时间'), `active 胶囊=${active}`);
});

console.log('[分组] 个人主页');
await case_w('W3', '/user/:id 直跳渲染他人主页（昵称 + 点评流容器）', async () => {
    await page.goto(`${BASE}/user/2`, { waitUntil: 'networkidle', timeout: 30000 });
    const body = await page.locator('body').textContent();
    assert(body.includes('旗山干饭王'), '主页缺昵称 旗山干饭王');
    assert(body.includes('TA 的点评'), '主页缺点评流标题');
    await page.screenshot({ path: `${OUT}\\w3-user-profile.png` });
});

await case_w('W4', '菜品详情评价卡点作者昵称跳转 /user/:id', async () => {
    await page.goto(`${BASE}/dish/${DISH_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('.author-link', { timeout: 8000 });
    await page.locator('.author-link').first().click();
    await page.waitForURL(/\/user\/\d+/, { timeout: 8000 });
});

console.log('[分组] 点赞与收藏');
await case_w('W5', '评价卡点赞 toggle（likeCount ±1，服务端回写）', async () => {
    // 落在 user9 个人主页评价流：操作人 zhangwl ≠ 作者 9，不受自赞限制影响
    await page.goto(`${BASE}/user/${AUTHOR_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
    const btn = page.locator('.like-btn').first();
    await btn.waitFor({ timeout: 8000 });
    const numEl = btn.locator('.score-num');
    const before = Number(await numEl.textContent());
    // 首赞：等 /reviews/:id/like 响应后再断言（相对值 ±1，幂等可重跑）
    const likeRes = page.waitForResponse((r) => /\/api\/reviews\/\d+\/like$/.test(r.url()), { timeout: 6000 });
    await btn.click();
    const r1 = await likeRes;
    assert(r1.status() === 200, `点赞接口 HTTP ${r1.status()}`);
    // 等 UI 回写（服务端成功后才回写 liked/likeCount）
    await page.waitForFunction(
        ({ el, want }) => Number(el.textContent) === want,
        { el: await numEl.elementHandle(), want: before + 1 }, { timeout: 6000 },
    );
    const after1 = Number(await numEl.textContent());
    assert(after1 === before + 1, `首赞后 likeCount=${after1}（期望 ${before + 1}）`);
    assert((await btn.getAttribute('class')).includes('on'), '首赞后按钮缺 on 态');
    // 再点取消
    const unlikeRes = page.waitForResponse((r) => /\/api\/reviews\/\d+\/like$/.test(r.url()), { timeout: 6000 });
    await btn.click();
    await unlikeRes;
    const after2 = Number(await numEl.textContent());
    assert(after2 === before, `取消后 likeCount=${after2}（期望复位 ${before}）`);
});

await case_w('W6', '推荐角标 + 档口推荐小节（临时标记 3 菜，走查后 SQL 恢复）', async () => {
    sql(`UPDATE dish SET is_recommended = 1 WHERE station_id = ${STATION_ID} AND status = 0 ORDER BY id LIMIT 3`);
    try {
        await page.goto(`${BASE}/station/${STATION_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForSelector('.reco-zone', { timeout: 8000 });
        const badgeCnt = await page.locator('.reco-badge').count();
        assert(badgeCnt === 3, `推荐角标数=${badgeCnt}（期望 3）`);
        const title = await page.locator('.reco-title').textContent();
        assert(title.includes('档口推荐'), `小节标题=${title}`);
        await page.screenshot({ path: `${OUT}\\w6-reco-badge.png` });
    } finally {
        sql(`UPDATE dish SET is_recommended = 0 WHERE station_id = ${STATION_ID}`);
    }
});

await case_w('W7', '想吃收藏：初始态接口化 + 加入/刷新保持/取消全链路', async () => {
    await page.goto(`${BASE}/station/${STATION_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
    const btn = page.locator('.act-col button', { hasText: '想吃' }).first();
    await btn.waitFor({ timeout: 8000 });
    const token = await page.evaluate(() => localStorage.getItem('fk_token'));
    assert(token, '登录态缺失');
    // 幂等复位：若已收藏先显式取消（DELETE /favorites/1/:id）
    const st = await (await fetch(`${BASE}/api/favorites/status?targetType=1&targetId=${STATION_ID}`, {
        headers: { authorization: `Bearer ${token}` },
    })).json();
    if (st.data && st.data.favored) {
        await fetch(`${BASE}/api/favorites/1/${STATION_ID}`, {
            method: 'DELETE', headers: { authorization: `Bearer ${token}` },
        });
        await page.reload({ waitUntil: 'networkidle' });
    }
    assert(!(await btn.getAttribute('class')).includes('el-button--warning'), '复位后仍显示已收藏');
    // 加入：POST /favorites（listType: 0）→ 按钮变 warning 实底
    const addRes = page.waitForResponse((r) => r.url().endsWith('/api/favorites') && r.request().method() === 'POST', { timeout: 6000 });
    await btn.click();
    const r1 = await addRes;
    assert(r1.status() === 200, `收藏接口 HTTP ${r1.status()}`);
    // 等 UI 回写按钮态：.act-col 内第二个按钮（想吃）带 el-button--warning 即已收藏实底
    await page.waitForFunction(
        () => (document.querySelector('.act-col button:nth-of-type(2)') || { className: '' }).className.includes('el-button--warning'),
        undefined, { timeout: 6000 },
    );
    assert((await btn.getAttribute('class')).includes('el-button--warning'), '加入后按钮未变已收藏态');
    // 刷新保持（初始态走 status 接口而非整表比对）
    await page.reload({ waitUntil: 'networkidle' });
    const btn2 = page.locator('.act-col button', { hasText: '想吃' }).first();
    await btn2.waitFor({ timeout: 8000 });
    assert((await btn2.getAttribute('class')).includes('el-button--warning'), '刷新后收藏态丢失');
    // 取消：DELETE /favorites/:type/:id
    const delRes = page.waitForResponse((r) => new RegExp(`/api/favorites/1/${STATION_ID}$`).test(r.url()), { timeout: 6000 });
    await btn2.click();
    const r2 = await delRes;
    assert(r2.status() === 200, `取消接口 HTTP ${r2.status()}`);
    assert(!(await btn2.getAttribute('class')).includes('el-button--warning'), '取消后按钮仍为已收藏态');
});

await browser.close();

// 全局 JS 报错兜底断言（不计独立用例）
if (pageErrors.length) {
    console.log(`(走查期间 pageerror ${pageErrors.length} 条: ${JSON.stringify(pageErrors.slice(0, 3))})`);
}

// 汇总
console.log('---');
console.log(`结果: ${pass} passed, ${fail} failed, 共 ${pass + fail} 例`);
console.log(`截图目录: ${OUT}`);
fs.writeFileSync(`${OUT}\\walkthrough-r39-result.json`, JSON.stringify(results, null, 2));
if (fail > 0) process.exit(1);
