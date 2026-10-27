/**
 * 用户数据服务：收藏（仅「想吃」语义）、举报、我的上报记录、点位提交
 */
const { query, query_one } = require('../db/pool');
const { err } = require('../utils/api-error');
const { assert } = require('../utils/validate');

/**
 * 设置/取消收藏（v2.0 仅「想吃」一种语义：listType 0 想吃 / null 取消）
 * @param {number} userId
 * @param {Object} input - {subjectType, subjectId, listType}
 */
async function set_favorite(userId, input) {
    const { subjectType, subjectId, listType } = input;
    assert([0, 1, 2].includes(subjectType), 'subjectType 不合法');
    if (listType === null || listType === undefined) {
        await query(
            'DELETE FROM favorite WHERE user_id = ? AND subject_type = ? AND subject_id = ?',
            [userId, subjectType, subjectId]
        );
        return { listType: null };
    }
    assert(Number(listType) === 0, 'listType 仅支持 0（想吃）');
    // 一对象一条（UNIQUE 约束）：REPLACE 覆盖
    await query(
        `INSERT INTO favorite (user_id, subject_type, subject_id, list_type) VALUES (?, ?, ?, 0)
         ON DUPLICATE KEY UPDATE list_type = 0`,
        [userId, subjectType, subjectId]
    );
    return { listType: 0 };
}

/**
 * 我的收藏列表（带对象名与均分）
 * @param {number} userId
 */
async function my_favorites(userId) {
    const rows = await query(
        `SELECT f.*,
            CASE f.subject_type WHEN 0 THEN (SELECT name FROM dish WHERE id = f.subject_id)
                                WHEN 1 THEN (SELECT name FROM station WHERE id = f.subject_id)
                                ELSE (SELECT name FROM canteen WHERE id = f.subject_id) END AS subject_name,
            sm.rating_avg, sm.review_count
         FROM favorite f
         LEFT JOIN review_summary sm ON sm.subject_type = f.subject_type AND sm.subject_id = f.subject_id
         WHERE f.user_id = ? ORDER BY f.created_at DESC`,
        [userId]
    );
    return rows;
}

/**
 * 校验收藏目标存在且未下架（与评价对象口径一致：0 菜品 / 1 档口 / 2 点位）
 * @param {number} subjectType
 * @param {number} subjectId
 * @returns {Promise<void>} 不存在抛 404
 */
async function assert_favorite_target(subjectType, subjectId) {
    let row = null;
    if (subjectType === 0) {
        row = await query_one('SELECT id FROM dish WHERE id = ? AND status = 0', [subjectId]);
        if (!row) throw err.not_found('菜品不存在或已下架');
    } else if (subjectType === 1) {
        row = await query_one('SELECT id FROM station WHERE id = ? AND status < 2', [subjectId]);
        if (!row) throw err.not_found('档口不存在或已下架');
    } else {
        row = await query_one('SELECT id FROM canteen WHERE id = ? AND enabled = 1', [subjectId]);
        if (!row) throw err.not_found('点位不存在或已下架');
    }
}

/**
 * 查询是否已收藏（03 §5.5）：GET /favorites/status
 * @param {number} userId
 * @param {Object} input - {subjectType, subjectId}
 * @returns {Promise<{favored: boolean}>}
 */
async function favorite_status(userId, input) {
    const subjectType = Number(input.subjectType);
    const subjectId = Number(input.subjectId);
    assert([0, 1, 2].includes(subjectType), 'targetType 不合法');
    assert(Number.isInteger(subjectId) && subjectId > 0, 'targetId 不合法');
    const row = await query_one(
        'SELECT 1 AS favored FROM favorite WHERE user_id = ? AND subject_type = ? AND subject_id = ?',
        [userId, subjectType, subjectId]
    );
    return { favored: !!row };
}

/**
 * 显式取消收藏（03 §5.5）：DELETE /favorites/:targetType/:targetId
 * 目标不存在或未收藏均 404
 * @param {number} userId
 * @param {number} subjectType - 路径参数 targetType（0/1/2，与 set_favorite 值域一致）
 * @param {number} subjectId - 路径参数 targetId
 * @returns {Promise<{favored: boolean}>}
 */
async function unset_favorite(userId, subjectType, subjectId) {
    subjectType = Number(subjectType);
    subjectId = Number(subjectId);
    assert([0, 1, 2].includes(subjectType), 'targetType 不合法');
    assert(Number.isInteger(subjectId) && subjectId > 0, 'targetId 不合法');
    await assert_favorite_target(subjectType, subjectId);
    const r = await query(
        'DELETE FROM favorite WHERE user_id = ? AND subject_type = ? AND subject_id = ?',
        [userId, subjectType, subjectId]
    );
    if (!r.affectedRows) throw err.not_found('未收藏该对象');
    return { favored: false };
}

/**
 * 点位提交（用户报新点位/档口/菜品，payload JSON 留痕，进后台审核）
 * @param {number} userId
 * @param {Object} input - {submitType: 0点位/1档口/2菜品, targetId, payload}
 * @returns {Promise<{id: number}>}
 */
async function create_point_submit(userId, input) {
    const submitType = Number(input.submitType);
    assert([0, 1, 2].includes(submitType), 'submitType 不合法');
    const raw = input.payload && typeof input.payload === 'object' ? input.payload : {};
    const targetId = input.targetId === undefined || input.targetId === null || input.targetId === ''
        ? null : Number(input.targetId);
    let payload;
    if (submitType === 0) {
        // 新点位：名称必填，类型/位置/人均可选
        const name = String(raw.name || '').trim();
        assert(name.length >= 1 && name.length <= 64, '点位名称需 1-64 字');
        const type = raw.type === undefined || raw.type === null || raw.type === '' ? 0 : Number(raw.type);
        assert([0, 1, 2, 3].includes(type), '点位类型不合法');
        const location = raw.location === undefined || raw.location === null ? '' : String(raw.location);
        assert(location.length <= 128, '位置描述不能超过 128 字');
        let avgPrice = null;
        if (raw.avgPrice !== undefined && raw.avgPrice !== null && raw.avgPrice !== '') {
            avgPrice = Number(raw.avgPrice);
            assert(Number.isFinite(avgPrice) && avgPrice >= 0 && avgPrice <= 999, '人均消费需为 0-999 的数字');
        }
        payload = { name, type, location: location.slice(0, 128), avgPrice };
    } else if (submitType === 1) {
        // 新档口：必须挂靠在架点位；名称必填，品类可选
        assert(Number.isInteger(targetId) && targetId > 0, '缺少挂靠点位');
        const canteen = await query_one('SELECT id FROM canteen WHERE id = ? AND enabled = 1', [targetId]);
        if (!canteen) throw err.not_found('挂靠点位不存在或已下架');
        const name = String(raw.name || '').trim();
        assert(name.length >= 1 && name.length <= 64, '档口名称需 1-64 字');
        const category = String(raw.category || '').trim().slice(0, 32);
        payload = { name, category };
    } else {
        // 新菜品：必须挂靠未下架档口；名称必填，价格/口味/忌口可选
        assert(Number.isInteger(targetId) && targetId > 0, '缺少挂靠档口');
        const station = await query_one('SELECT id FROM station WHERE id = ? AND status < 2', [targetId]);
        if (!station) throw err.not_found('挂靠档口不存在或已下架');
        const name = String(raw.name || '').trim();
        assert(name.length >= 1 && name.length <= 64, '菜品名称需 1-64 字');
        let price = null;
        if (raw.price !== undefined && raw.price !== null && raw.price !== '') {
            price = Number(raw.price);
            assert(Number.isFinite(price) && price >= 0, '价格需为不小于 0 的数字');
        }
        const tasteTags = String(raw.tasteTags || '').slice(0, 128);
        const tabooTags = String(raw.tabooTags || '').slice(0, 128);
        payload = { name, price, tasteTags, tabooTags };
    }
    // payload 列为 JSON 类型，必须 stringify 后传参
    const r = await query(
        'INSERT INTO point_submit (submitter_id, submit_type, target_id, payload) VALUES (?, ?, ?, ?)',
        [userId, submitType, targetId, JSON.stringify(payload)]
    );
    return { id: r.insertId };
}

/**
 * 提交举报（同对象同人去重）
 * @param {number} userId
 * @param {Object} input - {subjectType, subjectId, reason, detail}
 */
async function create_report(userId, input) {
    const { subjectType, subjectId, reason, detail = '' } = input;
    assert([0, 1, 2].includes(subjectType), 'subjectType 不合法');
    assert(Number.isInteger(reason) && reason >= 1 && reason <= 5, '请选择举报理由');
    const dup = await query_one(
        `SELECT id FROM report WHERE reporter_id = ? AND subject_type = ? AND subject_id = ? AND status = 'open'`,
        [userId, subjectType, subjectId]
    );
    if (dup) throw err.conflict('该内容已在处理中，请勿重复举报');
    await query(
        'INSERT INTO report (reporter_id, subject_type, subject_id, reason, detail) VALUES (?, ?, ?, ?, ?)',
        [userId, subjectType, subjectId, reason, String(detail).slice(0, 300)]
    );
}

/**
 * 申诉：已下架（2）评价重新进入人工复审队列（状态机 已下架→待人工→申诉成立→已发布）
 * @param {number} userId
 * @param {number} reviewId
 */
async function appeal_review(userId, reviewId) {
    const review = await query_one(
        'SELECT id, status, status_reason FROM review WHERE id = ? AND user_id = ?',
        [reviewId, userId]
    );
    if (!review) throw err.not_found('评价不存在');
    if (review.status !== 2) throw err.invalid('仅被下架的评价可申诉');
    await query(
        "UPDATE review SET status = 1, status_reason = '申诉复审中', updated_at = NOW() WHERE id = ?",
        [reviewId]
    );
    return { status: 1, reason: '申诉复审中' };
}

module.exports = {
    set_favorite, my_favorites, favorite_status, unset_favorite,
    create_point_submit, create_report, appeal_review,
};
