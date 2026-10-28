/**
 * 隐私数据服务（T-16）：个人数据 JSON 导出 / 按范围真删除
 * 仅处理账号内容数据，不删除评价与账号本身；可选表未落库时按空数据/跳过处理
 */
const { query, query_one, get_conn } = require('../db/pool');
const { err } = require('../utils/api-error');
const { assert } = require('../utils/validate');
const { has_table } = require('../utils/schema');

/** 导出/删除范围白名单：checkin → check_in，taste → taste_profile，ai → ai_conversation */
const SCOPES = ['journal', 'checkin', 'taste', 'ai', 'favorite', 'notification'];

/** 各范围候选表（设计文档原名优先） */
const SCOPE_TABLES = {
    journal: ['journal'],
    checkin: ['check_in', 'checkin'],
    taste: ['taste_profile'],
    ai: ['ai_conversation'],
    favorite: ['favorite'],
    notification: ['notification'],
};

/** 删除结果字段名 */
const SCOPE_RESULT_KEY = {
    journal: 'journal',
    checkin: 'checkIn',
    taste: 'taste',
    ai: 'ai',
    favorite: 'favorite',
    notification: 'notification',
};

/**
 * 取候选表中第一个已存在的表名
 * @param {string} scope
 * @returns {Promise<string|null>}
 */
async function resolve_table(scope) {
    for (const name of SCOPE_TABLES[scope] || []) {
        if (await has_table(name)) return name;
    }
    return null;
}

/**
 * 解析导出范围：缺省/空/all → 全部；逗号分隔列表需全部命中白名单
 * @param {*} raw - query.scope
 * @returns {Promise<Set<string>>}
 */
function parse_scopes(raw) {
    if (raw === undefined || raw === null || raw === '') return new Set(SCOPES);
    const list = (Array.isArray(raw) ? raw.join(',') : String(raw))
        .split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length === 0 || list.includes('all')) return new Set(SCOPES);
    const set = new Set();
    for (const s of list) {
        assert(SCOPES.includes(s), `scope 取值不合法：${s}`);
        set.add(s);
    }
    return set;
}

/**
 * 导出用户数据（不含密码、AI 密钥等凭据）
 * @param {number} userId
 * @param {*} rawScope - all / 逗号分隔范围
 * @returns {Promise<Object>}
 */
async function export_data(userId, rawScope) {
    const scopes = parse_scopes(rawScope);
    const u = await query_one(
        `SELECT id, username, nickname, email, avatar, avatar_object_key,
                fzu_uid, fzu_name, fzu_verified, role, status, created_at, last_login_at
         FROM \`user\` WHERE id = ?`,
        [userId]
    );
    if (!u) throw err.not_found('用户不存在');

    // 评价与饮食档案属账号核心数据，始终随导出返回
    const reviews = await query(
        'SELECT * FROM review WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
    );
    const dietTable = (await has_table('dietary_profile'))
        ? 'dietary_profile'
        : ((await has_table('diet_profile')) ? 'diet_profile' : null);
    const dietProfile = dietTable
        ? await query_one(`SELECT * FROM \`${dietTable}\` WHERE user_id = ?`, [userId])
        : null;

    let favorites = [];
    let journals = [];
    let checkIns = [];
    let tasteProfile = null;
    let aiConversations = [];
    let notifications = [];

    if (scopes.has('favorite')) {
        favorites = await query('SELECT * FROM favorite WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    }
    if (scopes.has('journal')) {
        journals = await query('SELECT * FROM journal WHERE user_id = ? ORDER BY date DESC, id DESC', [userId]);
    }
    if (scopes.has('checkin')) {
        const t = await resolve_table('checkin');
        if (t) checkIns = await query(`SELECT * FROM \`${t}\` WHERE user_id = ? ORDER BY id DESC`, [userId]);
    }
    if (scopes.has('taste')) {
        const t = await resolve_table('taste');
        if (t) tasteProfile = await query_one(`SELECT * FROM \`${t}\` WHERE user_id = ?`, [userId]);
    }
    if (scopes.has('ai')) {
        aiConversations = await query(
            'SELECT * FROM ai_conversation WHERE user_id = ? ORDER BY id DESC',
            [userId]
        );
    }
    if (scopes.has('notification')) {
        notifications = await query(
            'SELECT * FROM notification WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
    }

    return {
        exportedAt: new Date().toISOString(),
        user: { ...u, fzu_verified: Number(u.fzu_verified) === 1 },
        reviews,
        favorites,
        journals,
        checkIns,
        dietProfile,
        tasteProfile,
        aiConversations,
        notifications,
    };
}

/**
 * 按范围删除个人数据（单事务；可选表不存在则跳过并计 0）
 * @param {number} userId
 * @param {Object} input - {scopes: string[], confirm: true}
 * @returns {Promise<{deleted: Object}>}
 */
async function delete_data(userId, input) {
    const raw = input && input.scopes;
    assert(Array.isArray(raw) && raw.length > 0, '请选择要删除的数据范围');
    assert(input.confirm === true, '删除操作需明确确认');
    const scopes = [...new Set(raw.map((s) => String(s).trim()))];
    for (const s of scopes) assert(SCOPES.includes(s), `scope 取值不合法：${s}`);

    const deleted = { journal: 0, checkIn: 0, taste: 0, ai: 0, favorite: 0, notification: 0 };
    const targets = [];
    for (const scope of scopes) {
        const table = await resolve_table(scope);
        if (table) targets.push({ table, key: SCOPE_RESULT_KEY[scope] });
    }

    const conn = await get_conn();
    try {
        await conn.beginTransaction();
        for (const { table, key } of targets) {
            const [r] = await conn.query(`DELETE FROM \`${table}\` WHERE user_id = ?`, [userId]);
            deleted[key] += r.affectedRows;
        }
        await conn.commit();
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
    return { deleted };
}

module.exports = { export_data, delete_data };
