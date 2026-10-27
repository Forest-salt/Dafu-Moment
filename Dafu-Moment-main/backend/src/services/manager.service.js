/**
 * 窗口负责人服务：本窗口概览 / 动态公告 / 公开回应差评（P1）
 */
const { query, query_one } = require('../db/pool');
const notification = require('./notification.service');
const { err } = require('../utils/api-error');

/**
 * 校验当前用户是该窗口负责人
 * @param {number} userId
 * @param {number} stationId
 */
async function assert_manager(userId, stationId) {
    const s = await query_one('SELECT manager_user_id FROM station WHERE id = ?', [stationId]);
    if (!s || Number(s.manager_user_id) !== Number(userId)) {
        throw err.forbidden('你不是该窗口的负责人');
    }
}

/**
 * 本窗口概览：评分 / 评价 / 近期点评 / 公告
 * @param {number} stationId
 */
async function station_summary(stationId) {
    const station = await query_one(
        `SELECT s.id, s.name, s.category, s.status, c.name AS canteen_name
         FROM station s JOIN canteen c ON c.id = s.canteen_id WHERE s.id = ?`,
        [stationId]
    );
    if (!station) throw err.not_found('窗口不存在');
    const summary = await query_one(
        'SELECT review_count, rating_avg FROM review_summary WHERE subject_type = 1 AND subject_id = ?',
        [stationId]
    );
    const recent = await query(
        `SELECT r.overall_score, r.content, r.created_at, u.nickname
         FROM review r JOIN user u ON u.id = r.user_id
         WHERE r.subject_type = 1 AND r.subject_id = ? AND r.status = 0
         ORDER BY r.created_at DESC LIMIT 10`,
        [stationId]
    );
    const posts = await query(
        'SELECT id, type, content, starts_at, ends_at, created_at FROM station_post WHERE station_id = ? ORDER BY created_at DESC LIMIT 20',
        [stationId]
    );
    return { station, summary, recentReviews: recent, posts };
}

/**
 * 发布动态公告
 * @param {number} userId
 * @param {number} stationId
 * @param {Object} input - {type, content, days}
 */
async function create_post(userId, stationId, input) {
    await assert_manager(userId, stationId);
    const { type, content, days = 3 } = input;
    if (!['new_dish', 'menu_change', 'away', 'promo'].includes(type)) {
        throw err.invalid('公告类型不合法');
    }
    await query(
        'INSERT INTO station_post (station_id, author_id, type, content, starts_at, ends_at) VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY))',
        [stationId, userId, type, String(content).slice(0, 200), Number(days) || 3]
    );
}

/**
 * 公开回应差评（P1）：负责人对评价公开回复
 * @param {number} userId
 * @param {number} reviewId
 * @param {string} content
 */
async function reply_review(userId, reviewId, content) {
    const review = await query_one('SELECT * FROM review WHERE id = ?', [reviewId]);
    if (!review) throw err.not_found('评价不存在');
    // 评价挂在窗口（subject_type=1）或菜品（subject_type=0 → 查其窗口）
    let stationId = null;
    if (review.subject_type === 1) stationId = review.subject_id;
    else if (review.subject_type === 0) {
        const d = await query_one('SELECT station_id FROM dish WHERE id = ?', [review.subject_id]);
        stationId = d ? d.station_id : null;
    }
    if (!stationId) throw err.invalid('该评价不支持窗口回应');
    await assert_manager(userId, stationId);
    const dup = await query_one('SELECT id FROM review_reply WHERE review_id = ?', [reviewId]);
    if (dup) throw err.conflict('该评价已有公开回应');
    await query(
        'INSERT INTO review_reply (review_id, user_id, content) VALUES (?, ?, ?)',
        [reviewId, userId, String(content).slice(0, 500)]
    );
    await notification.create(review.user_id, 'reply', '窗口负责人回应了你的点评',
        String(content).slice(0, 200), 'review', reviewId);
}

module.exports = { assert_manager, station_summary, create_post, reply_review };
