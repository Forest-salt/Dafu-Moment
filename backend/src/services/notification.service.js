/**
 * 通知服务：处置/申诉/回应/点赞通知（同类型 24h 合并展示）
 */
const config = require('../config');
const { query, query_one } = require('../db/pool');
const settings = require('./settings.service');

/** 通知类型 → 隐私开关列（privacy_setting 表落库后生效；表/列缺失时默认允许） */
const PRIVACY_COLUMNS = {
    like: 'notify_like',
    reply: 'notify_reply',
    report: 'notify_report',
    audit: 'notify_audit',
    mute: 'notify_audit',
    ban: 'notify_audit',
    appeal: 'notify_audit',
};

/**
 * 该用户是否允许接收某类通知（总开关 + 分类型开关，缺省允许）
 * @param {number} userId
 * @param {string} type
 * @returns {Promise<boolean>}
 */
async function privacy_allowed(userId, type) {
    try {
        if (!(await settings.allowed(userId, 'notification_enabled'))) return false;
        const col = PRIVACY_COLUMNS[type];
        if (!col) return true;
        return settings.allowed(userId, col);
    } catch {
        // 可选表在探测后被移除等异常场景不阻断通知主链路
        return true;
    }
}

/**
 * 创建通知（隐私开关关闭时静默跳过）
 * @param {number} userId
 * @param {string} type - audit/mute/ban/report/reply/appeal/like/interaction
 * @param {string} title
 * @param {string} content
 * @param {string|null} refType
 * @param {number|null} refId
 */
async function create(userId, type, title, content, refType = null, refId = null) {
    if (!(await privacy_allowed(userId, type))) return;
    await query(
        'INSERT INTO notification (user_id, type, title, content, ref_type, ref_id) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, type, title, content, refType, refId]
    );
}

/**
 * 我的通知（未读在前）：同类型通知在 NOTIFY_MERGE_HOURS 窗口内合并为一条，
 * 保留最新一条的标题/内容/引用，mergedCount 记录合并条数
 * @param {number} userId
 * @returns {Promise<{list: Array, unread: number}>}
 */
async function list_mine(userId) {
    const rows = await query(
        'SELECT id, type, title, content, ref_type, ref_id, read_at, created_at FROM notification WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
        [userId]
    );
    const mergeMs = config.numbers.NOTIFY_MERGE_HOURS * 3600 * 1000;
    const list = [];
    const latestByType = new Map();
    for (const row of rows) {
        const at = new Date(row.created_at).getTime();
        const group = latestByType.get(row.type);
        if (group && at >= group.at - mergeMs) {
            group.item.mergedCount += 1;
            continue;
        }
        const item = { ...row, mergedCount: 1 };
        latestByType.set(row.type, { at, item });
        list.push(item);
    }
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
