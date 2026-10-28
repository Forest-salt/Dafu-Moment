/**
 * 隐私设置服务（T-15）：授权开关与通知偏好落库
 * 表 privacy_setting（设计文档 §4）：behavior_analysis_allowed / notification_enabled /
 * matching_allowed / diet_authorized；表未落库时读取返回缺省值，写入明确报不可用
 */
const { query, query_one } = require('../db/pool');
const { err } = require('../utils/api-error');
const { assert } = require('../utils/validate');
const { has_table, has_column } = require('../utils/schema');

/** 缺省值：饭搭子匹配首版默认关闭，其余开关默认开启 */
const DEFAULTS = {
    behavior_analysis_allowed: 1,
    notification_enabled: 1,
    matching_allowed: 0,
    diet_authorized: 1,
};

const FIELDS = Object.keys(DEFAULTS);

/**
 * privacy_setting 表是否可用于读写
 * @returns {Promise<boolean>}
 */
async function table_ready() {
    return has_table('privacy_setting');
}

/**
 * 软删除条件（表含 deleted_at 时只取有效行）
 * @returns {Promise<string>}
 */
async function active_cond() {
    return (await has_column('privacy_setting', 'deleted_at')) ? ' AND deleted_at IS NULL' : '';
}

/**
 * 读取用户隐私设置（无记录返回缺省值）
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function get_privacy(userId) {
    const result = { ...DEFAULTS, available: false, persisted: false };
    if (!(await table_ready())) return result;
    result.available = true;
    const row = await query_one(`SELECT * FROM privacy_setting WHERE user_id = ?${await active_cond()}`, [userId]);
    if (!row) return result;
    for (const key of FIELDS) {
        if (row[key] !== undefined && row[key] !== null) result[key] = Number(row[key]) === 1 ? 1 : 0;
    }
    result.persisted = true;
    return result;
}

/**
 * 更新隐私设置（部分字段；未落库的字段保持原值）
 * @param {number} userId
 * @param {Object} input - 请求体（布尔或 0/1）
 * @returns {Promise<Object>}
 */
async function update_privacy(userId, input) {
    if (!(await table_ready())) throw err.unavailable('隐私设置暂未开放（数据表待建）');
    const updates = {};
    for (const key of FIELDS) {
        if (input[key] === undefined) continue;
        const v = input[key];
        assert(v === true || v === false || v === 0 || v === 1, `${key} 需为布尔值`);
        updates[key] = v === true || Number(v) === 1 ? 1 : 0;
    }
    assert(Object.keys(updates).length > 0, '请至少提交一项隐私设置');

    const row = await query_one(`SELECT * FROM privacy_setting WHERE user_id = ?${await active_cond()}`, [userId]);
    // 软删除后重新保存：优先复活原行，避免撞 user_id 唯一键
    const hasDeleted = await has_column('privacy_setting', 'deleted_at');
    const existing = row || (hasDeleted
        ? await query_one('SELECT * FROM privacy_setting WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId])
        : null);
    const cols = [];
    for (const key of Object.keys(updates)) {
        if (await has_column('privacy_setting', key)) cols.push(key);
    }
    assert(cols.length > 0, '当前数据表未包含可更新的隐私字段');

    if (existing) {
        const sets = cols.map((c) => `${c} = ?`);
        if (hasDeleted) sets.push('deleted_at = NULL');
        await query(
            `UPDATE privacy_setting SET ${sets.join(', ')} WHERE id = ?`,
            [...cols.map((c) => updates[c]), existing.id]
        );
    } else {
        const names = ['user_id', ...cols];
        const holes = names.map(() => '?').join(', ');
        await query(
            `INSERT INTO privacy_setting (${names.join(', ')}) VALUES (${holes})`,
            [userId, ...cols.map((c) => updates[c])]
        );
    }
    return get_privacy(userId);
}

/**
 * 内部授权判定：表/列缺失时按允许处理（保证未落库环境主链路不中断）
 * @param {number} userId
 * @param {string} key - privacy_setting 列名
 * @returns {Promise<boolean>}
 */
async function allowed(userId, key) {
    if (!(await table_ready()) || !(await has_column('privacy_setting', key))) return true;
    try {
        const row = await query_one(
            `SELECT ${key} AS v FROM privacy_setting WHERE user_id = ?${await active_cond()}`,
            [userId]
        );
        return !row || Number(row.v) === 1;
    } catch {
        return true;
    }
}

module.exports = { get_privacy, update_privacy, allowed, DEFAULTS, FIELDS };
