/**
 * 草稿箱服务（T-17）：点评 / 动态 / 长帖 / 手账转帖草稿的增删改查
 * 表 draft（设计文档 §4）：draft_type 1-4 + payload JSON 整体快照
 * 表未落库时列表返回空，写入明确报不可用
 */
const config = require('../config');
const { query, query_one } = require('../db/pool');
const { err } = require('../utils/api-error');
const { assert } = require('../utils/validate');
const { has_table, has_column } = require('../utils/schema');

const N = config.numbers;

/** 草稿类型 → 前端卡片分类（点评 / 帖子） */
const KIND_OF = { 1: 'review', 2: 'post', 3: 'post', 4: 'post' };
const TYPE_NAME = { 1: '点评', 2: '动态', 3: '长帖', 4: '手账转帖' };

/**
 * draft 表是否可用
 * @returns {Promise<boolean>}
 */
async function table_ready() {
    return has_table('draft');
}

/**
 * JSON 列兼容解析
 * @param {*} raw
 * @returns {Object}
 */
function parse_payload(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return {}; }
}

/**
 * 图片对象键 → 代理 URL（已带 /img/ 或 http 的原样保留）
 * @param {*} raw
 * @returns {string[]}
 */
function to_urls(raw) {
    const list = Array.isArray(raw) ? raw : [];
    return list.slice(0, 9).map((v) => {
        const s = String(v || '');
        if (!s) return '';
        if (s.startsWith('/img/') || /^https?:\/\//.test(s)) return s;
        return `/img/${s}`;
    }).filter(Boolean);
}

/**
 * 草稿行 → 列表卡片（摘要 / 缩略图 / 类型）
 * @param {Object} row
 * @returns {Object}
 */
function shape(row) {
    const payload = parse_payload(row.payload);
    const summaryRaw = payload.summary || payload.content || payload.text || payload.title || '';
    const summary = String(summaryRaw).replace(/\s+/g, ' ').trim().slice(0, N.DRAFT_SUMMARY_LEN);
    const thumbs = to_urls(payload.images || payload.imageKeys || payload.thumbs);
    return {
        id: Number(row.id),
        draft_type: Number(row.draft_type),
        draft_type_name: TYPE_NAME[Number(row.draft_type)] || '草稿',
        kind: KIND_OF[Number(row.draft_type)] || 'review',
        summary,
        thumbs,
        payload,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

/**
 * 校验并归一 payload（对象 / JSON 字符串；超限拒绝）
 * @param {*} raw
 * @returns {Object}
 */
function normalize_payload(raw) {
    let payload = raw;
    if (typeof raw === 'string') {
        try { payload = JSON.parse(raw); } catch { throw err.invalid('payload 需为 JSON 对象'); }
    }
    assert(payload && typeof payload === 'object' && !Array.isArray(payload), 'payload 需为 JSON 对象');
    assert(Buffer.byteLength(JSON.stringify(payload), 'utf8') <= N.DRAFT_PAYLOAD_MAX_BYTES,
        `草稿内容不能超过 ${Math.round(N.DRAFT_PAYLOAD_MAX_BYTES / 1024)}KB`);
    return payload;
}

/**
 * 草稿有效行条件
 * @returns {Promise<string>}
 */
async function active_cond() {
    return (await has_column('draft', 'deleted_at')) ? ' AND deleted_at IS NULL' : '';
}

/**
 * 我的草稿列表（最近更新在前）
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function list(userId) {
    if (!(await table_ready())) {
        return { available: false, list: [], total: 0, max: N.DRAFT_MAX };
    }
    const rows = await query(
        `SELECT id, draft_type, payload, created_at, updated_at FROM draft
         WHERE user_id = ?${await active_cond()}
         ORDER BY updated_at DESC, id DESC LIMIT ?`,
        [userId, N.DRAFT_MAX]
    );
    return { available: true, list: rows.map(shape), total: rows.length, max: N.DRAFT_MAX };
}

/**
 * 草稿详情（归属校验）
 * @param {number} userId
 * @param {number} id
 * @returns {Promise<Object>}
 */
async function get(userId, id) {
    assert(Number.isInteger(id) && id > 0, '草稿 ID 不合法');
    if (!(await table_ready())) throw err.unavailable('草稿箱暂未开放（数据表待建）');
    const row = await query_one(
        `SELECT id, draft_type, payload, created_at, updated_at FROM draft
         WHERE id = ? AND user_id = ?${await active_cond()}`,
        [id, userId]
    );
    if (!row) throw err.not_found('草稿不存在');
    return shape(row);
}

/**
 * 新建草稿（每用户上限 DRAFT_MAX）
 * @param {number} userId
 * @param {Object} input - {draftType, payload}
 * @returns {Promise<{id: number}>}
 */
async function create(userId, input) {
    if (!(await table_ready())) throw err.unavailable('草稿箱暂未开放（数据表待建）');
    const draftType = Number(input.draftType);
    assert([1, 2, 3, 4].includes(draftType), 'draftType 不合法');
    const payload = normalize_payload(input.payload);
    const row = await query_one(
        `SELECT COUNT(*) c FROM draft WHERE user_id = ?${await active_cond()}`,
        [userId]
    );
    if (Number(row.c) >= N.DRAFT_MAX) throw err.conflict(`草稿箱最多保存 ${N.DRAFT_MAX} 条，请先删除旧草稿`);
    const r = await query(
        'INSERT INTO draft (user_id, draft_type, payload) VALUES (?, ?, ?)',
        [userId, draftType, JSON.stringify(payload)]
    );
    return { id: r.insertId };
}

/**
 * 更新草稿（归属校验；draftType / payload 均可选）
 * @param {number} userId
 * @param {number} id
 * @param {Object} input
 * @returns {Promise<{id: number, updated_at: Date}>}
 */
async function update(userId, id, input) {
    assert(Number.isInteger(id) && id > 0, '草稿 ID 不合法');
    if (!(await table_ready())) throw err.unavailable('草稿箱暂未开放（数据表待建）');
    const row = await query_one(
        `SELECT id, draft_type, payload FROM draft WHERE id = ? AND user_id = ?${await active_cond()}`,
        [id, userId]
    );
    if (!row) throw err.not_found('草稿不存在');
    let draftType = Number(row.draft_type);
    if (input.draftType !== undefined) {
        draftType = Number(input.draftType);
        assert([1, 2, 3, 4].includes(draftType), 'draftType 不合法');
    }
    let payload = row.payload;
    if (input.payload !== undefined) payload = JSON.stringify(normalize_payload(input.payload));
    await query(
        'UPDATE draft SET draft_type = ?, payload = ?, updated_at = NOW() WHERE id = ?',
        [draftType, payload, id]
    );
    const saved = await query_one('SELECT updated_at FROM draft WHERE id = ?', [id]);
    return { id, updated_at: saved ? saved.updated_at : null };
}

/**
 * 删除草稿（软删除优先）
 * @param {number} userId
 * @param {number} id
 * @returns {Promise<{id: number}>}
 */
async function remove(userId, id) {
    assert(Number.isInteger(id) && id > 0, '草稿 ID 不合法');
    if (!(await table_ready())) throw err.unavailable('草稿箱暂未开放（数据表待建）');
    let r;
    if (await has_column('draft', 'deleted_at')) {
        r = await query(
            'UPDATE draft SET deleted_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            [id, userId]
        );
    } else {
        r = await query('DELETE FROM draft WHERE id = ? AND user_id = ?', [id, userId]);
    }
    if (!r.affectedRows) throw err.not_found('草稿不存在');
    return { id };
}

module.exports = { list, get, create, update, remove, TYPE_NAME, KIND_OF };
