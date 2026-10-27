/**
 * 通知服务：处置/申诉/回应结果通知
 */
const { query, query_one } = require('../db/pool');

/**
 * 创建通知
 * @param {number} userId
 * @param {string} type - audit/mute/ban/report/reply/appeal
 * @param {string} title
 * @param {string} content
 * @param {string|null} refType
 * @param {number|null} refId
 */
async function create(userId, type, title, content, refType = null, refId = null) {
    await query(
        'INSERT INTO notification (user_id, type, title, content, ref_type, ref_id) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, type, title, content, refType, refId]
    );
}

/**
 * 我的通知（未读在前）
 * @param {number} userId
 * @returns {Promise<{list: Array, unread: number}>}
 */
async function list_mine(userId) {
    const list = await query(
        'SELECT id, type, title, content, ref_type, ref_id, read_at, created_at FROM notification WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
        [userId]
    );
    const unread = await query_one(
        'SELECT COUNT(*) c FROM notification WHERE user_id = ? AND read_at IS NULL',
        [userId]
    );
    return { list, unread: Number(unread.c) };
}

/**
 * 全部标记已读
 * @param {number} userId
 */
async function mark_read(userId) {
    await query('UPDATE notification SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL', [userId]);
}

module.exports = { create, list_mine, mark_read };
