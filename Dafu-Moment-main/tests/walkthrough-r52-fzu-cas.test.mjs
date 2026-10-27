/**
 * r52 走查：福大 CAS 真实模式（r51 双模式）全链路 · 本地模拟 CAS 服务器
 * 本脚本自带一个「CAS 3.0 子集」模拟服务器（/cas/login 发票 302、/cas/serviceValidate 一次性验票），
 * 后端以 real 模式运行（FZU_CAS_BASE_URL=http://host.docker.internal:3210）时：
 *   R1 mode 探测 → real + loginUrl
 *   R2 /auth/fzu/cas/login → 302 跳模拟 CAS 登录页且 service 参数=回调地址
 *   R3 模拟校方登录成功 → 302 回 service 并携带一次性 ticket
 *   R4 ticket 换会话 → JWT + 福大认证身份（uid/姓名来自 CAS XML attributes）
 *   R5 同 ticket 重放 → 校方验票失败（一次性）→ 后端 422 拒绝
 * 幂等：SSO 自动建号按 uid 幂等（同学号重复登录=同人登录），无残留增量
 *
 * 运行前提（real 模式）：
 *   $env:DEBUG='true'; $env:FZU_CAS_BASE_URL='http://host.docker.internal:3210'
 *   $env:FZU_CAS_SERVICE='http://localhost:8095/auth/fzu/callback'
 *   docker compose up -d backend; node tests/walkthrough-r52-fzu-cas.test.mjs
 *   （跑完 Remove-Item Env:FZU_CAS_BASE_URL,Env:FZU_CAS_SERVICE,Env:DEBUG 后 docker compose up -d backend 还原 demo 模式）
 */
import http from 'node:http';

const BASE = 'http://localhost:3000/api';
const ORIGIN = 'http://localhost:3000'; // loginUrl 自带 /api 前缀，跳转类请求拼 origin 而非 BASE
const CAS_PORT = 3210;
const SERVICE = process.env.FZU_CAS_SERVICE || 'http://localhost:8095/auth/fzu/callback';
const MOCK_UID = '99000001';
const MOCK_NAME = '陈测试';
let passed = 0, failed = 0;

function assert(cond, name, extra = '') {
    cond ? passed++ : failed++;
    console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);
}

/* ---------- 模拟 CAS：/cas/login 发票（一次性 Map），/cas/serviceValidate 验票 ---------- */
const TICKETS = new Map(); // ticket -> service
const cas = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://cas.mock');
    if (u.pathname === '/cas/login') {
        const service = u.searchParams.get('service');
        if (!service) { res.writeHead(400); return res.end('service required'); }
        const st = `ST-mock-${Math.random().toString(36).slice(2, 10)}`;
        TICKETS.set(st, service);
        res.writeHead(302, { Location: `${service}?ticket=${st}` });
        return res.end();
    }
    if (u.pathname === '/cas/serviceValidate') {
        const ticket = u.searchParams.get('ticket');
        const service = u.searchParams.get('service');
        const valid = ticket && TICKETS.get(ticket) === service;
        if (valid) TICKETS.delete(ticket); // CAS 票据一次性
        const xml = valid
            ? `<cas:serviceResponse><cas:authenticationSuccess><cas:user>${MOCK_UID}</cas:user>`
              + `<cas:attributes><cas:cn>${MOCK_NAME}</cas:cn></cas:attributes>`
              + '</cas:authenticationSuccess></cas:serviceResponse>'
            : '<cas:serviceResponse><cas:authenticationFailure code="INVALID_TICKET">Ticket not recognized</cas:authenticationFailure></cas:serviceResponse>';
        res.writeHead(200, { 'Content-Type': 'text/xml; charset=utf-8' });
        return res.end(xml);
    }
    res.writeHead(404); res.end();
});
await new Promise((r) => cas.listen(CAS_PORT, r));

/* ---------- R1 mode 探测 ---------- */
const mode = await (await fetch(`${BASE}/auth/fzu/cas/mode`)).json();
assert(mode.code === 0 && mode.data.mode === 'real' && mode.data.loginUrl === '/api/auth/fzu/cas/login',
    'R1 mode 探测 → real + loginUrl', JSON.stringify(mode.data));

/* ---------- R2 跳板 302 到校方登录页（node:http 直取，undici fetch manual 是 opaqueredirect 不暴露头） ---------- */
/** GET 但不跟随重定向：返回 {status, location} */
function get_no_redirect(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => resolve({ status: res.statusCode, location: res.headers.location })).on('error', reject);
    });
}
const jump = await get_no_redirect(`${ORIGIN}${mode.data.loginUrl}`);
const loc = jump.location || '';
assert(jump.status === 302 && loc.startsWith(`http://host.docker.internal:${CAS_PORT}/cas/login?service=`),
    'R2 跳板 302 → 模拟 CAS 登录页', `status=${jump.status} loc=${loc}`);
assert(decodeURIComponent(loc.split('service=')[1] || '') === SERVICE,
    'R2b service 参数 = 配置的回调地址', decodeURIComponent(loc.split('service=')[1] || ''));

/* ---------- R3 模拟校方登录成功 → 302 回 service 带 ticket ---------- */
// 宿主机侧访问模拟 CAS 用 localhost（host.docker.internal 仅容器内可解析，宿主侧直连会被重置）
const after = await get_no_redirect(loc.replace('host.docker.internal', 'localhost'));
const back = after.location || '';
const ticket = back.split('ticket=')[1] || '';
assert(after.status === 302 && back.startsWith(`${SERVICE}?ticket=ST-mock-`) && ticket.length > 8,
    'R3 校方登录 → 302 回 service 带 ticket', back);

/* ---------- R4 ticket 换会话：JWT + 福大认证身份 ---------- */
const sso = await (await fetch(`${BASE}/auth/fzu/sso`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ticket }),
})).json();
assert(sso.code === 0 && !!sso.data.token, 'R4 ticket 换 JWT 成功', sso.msg || '');
assert(sso.data.user?.fzu_uid === MOCK_UID && sso.data.user?.fzu_name === MOCK_NAME && sso.data.user?.fzu_verified === true,
    'R4b 身份来自 CAS XML（uid/姓名/已认证）', JSON.stringify(sso.data.user));

/* ---------- R5 同 ticket 重放 → 校方验票失败 → 422 ---------- */
const replay = await (await fetch(`${BASE}/auth/fzu/sso`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ticket }),
})).json();
assert(replay.code !== 0 && /统一身份认证校验失败|票据已过期/.test(replay.msg || ''),
    'R5 同 ticket 重放被拒（CAS 票据一次性）', replay.msg || '');

cas.close();
console.log(`\n结果: ${passed} passed, ${failed} failed, 共 ${passed + failed} 例`);
process.exit(failed > 0 ? 1 : 0);
