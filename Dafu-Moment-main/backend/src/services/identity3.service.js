/** 数据库3.0身份：9位学号或加密手机号；注册不等于校园身份认证。 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, query_one, get_conn } = require('../db/pool');
const { err } = require('../utils/api-error');

function identity(input) {
    const student = String(input.studentNo || '').trim();
    const phone = String(input.phone || '').trim();
    if (!!student === !!phone) throw err.invalid('请只填写学号或手机号其中一种');
    if (student) {
        if (!/^\d{9}$/.test(student)) throw err.invalid('学号应为9位数字');
        return { column: 'student_no', value: student, student };
    }
    if (!/^1\d{10}$/.test(phone)) throw err.invalid('手机号应为11位数字');
    const salt = process.env.PHONE_HASH_SALT;
    const key = process.env.PHONE_ENCRYPTION_KEY;
    if (!salt || salt.length < 16 || !/^[a-f0-9]{64}$/i.test(key || '')) throw err.unavailable('手机号加密配置尚未完成');
    const value = crypto.createHash('sha256').update(salt + ':' + phone).digest('hex');
    return { column: 'phone_hash', value, phone, key: Buffer.from(key, 'hex') };
}
function encrypt_phone(id) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', id.key, iv);
    const data = Buffer.concat([cipher.update(id.phone, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}
function check_password(p) {
    if (typeof p !== 'string' || p.length < 8 || Buffer.byteLength(p) > 72) throw err.invalid('密码至少8字符，UTF-8编码不超过72字节');
}
async function public_user(id) {
    const u = await query_one('SELECT id,nickname,avatar,student_no,verified_status,status,mute_until,created_at FROM user WHERE id=? AND deleted_at IS NULL AND status<>3', [id]);
    if (!u) return null;
    u.roles = (await query('SELECT r.role_code FROM user_role ur JOIN role r ON r.id=ur.role_id WHERE ur.user_id=?', [id])).map(r => r.role_code);
    return u;
}
async function register(input) {
    const id = identity(input);
    check_password(input.password);
    const nickname = String(input.nickname || '新同学').trim();
    if (!nickname || [...nickname].length > 64) throw err.invalid('昵称应为1至64字');
    const hash = await bcrypt.hash(input.password, 10);
    const conn=await get_conn();let uid;
    try {
        await conn.beginTransaction();
        const [r]=await conn.query('INSERT INTO user(nickname,student_no,phone,phone_hash,password_hash) VALUES(?,?,?,?,?)', [nickname,id.student || null,id.phone ? encrypt_phone(id) : null,id.phone ? id.value : null,hash]);
        uid=r.insertId;
        await conn.query("INSERT INTO user_role(user_id,role_id) SELECT ?,id FROM role WHERE role_code='user'",[uid]);
        await conn.commit();
    } catch(e) {await conn.rollback();throw e;} finally {conn.release();}
    return public_user(uid);
}
async function login(input) {
    const id = identity(input);
    const u = await query_one(`SELECT id,password_hash,status,deleted_at FROM user WHERE ${id.column}=?`, [id.value]);
    if (!u || !u.password_hash || !await bcrypt.compare(String(input.password || ''),u.password_hash)) throw err.unauthorized('身份或密码错误');
    if (u.deleted_at || u.status === 3) throw err.unauthorized('账号已注销');
    if (u.status === 2) throw err.banned('账号已封禁');
    await query('UPDATE user SET last_login_at=NOW() WHERE id=?', [u.id]);
    return public_user(u.id);
}
module.exports = { register,login,public_user,identity };
