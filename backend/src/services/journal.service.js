/**
 * 美食手账服务（r52 手账编辑器）
 * 手账 = 日期 + 标题 + 随笔 + 画布排版（layout JSON：贴纸/文字块的 x/y/w/rot 等）
 * 归属校验贯穿读写，防止越权改他人手账
 */
const crypto = require('crypto');
const { query, query_one } = require('../db/pool');
const { minioClient } = require('../db/minio');
const config = require('../config');
const { err } = require('../utils/api-error');

/** 画布逻辑尺寸（前端编辑器与导出 PNG 同口径） */
const CANVAS = { w: 750, h: 1000 };

/**
 * 自定义背景 URL 白名单化：仅收 /img/ 代理路径，bg=3 才生效
 * @param {{bg, bg_src}} body
 * @returns {string|null}
 */
function bg_src_of(body) {
    if ((Number(body.bg) || 0) !== 3 || !body.bg_src) return null;
    const s = String(body.bg_src);
    return s.startsWith('/img/') ? s.slice(0, 255) : null;
}

/**
 * 上传自定义纸面背景图 → MinIO（journal-bg/{yyyymm}/{uuid}.png）
 * @param {Buffer} buf 原图字节
 * @returns {Promise<{url: string}>}
 */
async function save_bg(buf) {
    if (!buf || buf.length < 100) throw err.invalid('图片无效');
    if (buf.length > 8 * 1024 * 1024) throw err.invalid('背景图不能超过 8MB');
    const d = new Date();
    const key = `journal-bg/${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.png`;
    await minioClient.putObject(config.minio.bucket, key, buf, buf.length, { 'Content-Type': 'image/png' });
    return { url: `/img/${key}` };
}

/**
 * 新建手账
 * @param {number} userId
 * @param {{title, date, text, bg, layout, cover}} body
 * @returns {Promise<{id: number}>}
 */
async function create(userId, body) {
    const layout = safe_layout(body.layout);
    const r = await query(
        'INSERT INTO journal (user_id, title, date, text, bg, bg_src, layout, cover) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
            userId,
            String(body.title || '').slice(0, 64) || '美食手账',
            String(body.date || '').slice(0, 10),
            String(body.text || '').slice(0, 2000),
            Number(body.bg) || 0,
            bg_src_of(body),
            JSON.stringify(layout),
            body.cover ? String(body.cover).slice(0, 255) : null,
        ]
    );
    return { id: r.insertId };
}

/**
 * 更新手账（归属校验）
 * @param {number} userId
 * @param {number} id
 * @param {{title, text, bg, layout, cover}} body
 */
async function update(userId, id, body) {
    const row = await query_one('SELECT id FROM journal WHERE id = ? AND user_id = ?', [id, userId]);
    if (!row) throw err.not_found('手账不存在');
    await query(
        'UPDATE journal SET title = ?, text = ?, bg = ?, bg_src = ?, layout = ?, cover = ? WHERE id = ?',
        [
            String(body.title || '').slice(0, 64) || '美食手账',
            String(body.text || '').slice(0, 2000),
            Number(body.bg) || 0,
            bg_src_of(body),
            JSON.stringify(safe_layout(body.layout)),
            body.cover ? String(body.cover).slice(0, 255) : null,
            id,
        ]
    );
    return { id };
}

/**
 * 归一化 layout：仅保留白名单字段与数值范围，防注入任意字段
 * @param {*} raw
 * @returns {Array}
 */
function safe_layout(raw) {
    let arr = raw;
    if (typeof raw === 'string') {
        try { arr = JSON.parse(raw); } catch { return []; }
    }
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 60).map((b) => ({
        kind: b.kind === 'text' ? 'text' : 'sticker',
        sticker: Number(b.sticker) || 0,
        src: String(b.src || '').slice(0, 300),
        x: Math.max(-100, Math.min(Number(b.x) || 0, CANVAS.w)),
        y: Math.max(-100, Math.min(Number(b.y) || 0, CANVAS.h)),
        w: Math.max(24, Math.min(Number(b.w) || 120, 480)),
        rot: Math.max(-180, Math.min(Number(b.rot) || 0, 180)),
        z: Math.max(0, Math.min(Number(b.z) || 1, 60)),
        text: String(b.text || '').slice(0, 120),
        color: /^[0-9a-fA-F]{3,8}$/.test(String(b.color || '')) ? b.color : '3a2e1a',
        size: Math.max(12, Math.min(Number(b.size) || 24, 72)),
    }));
}

/**
 * 我的手账列表（最近 100 篇，倒序）
 * @param {number} userId
 */
async function list(userId) {
    const rows = await query(
        `SELECT id, title, DATE_FORMAT(date, '%Y-%m-%d') AS date, text, bg, bg_src, layout, cover, created_at
         FROM journal WHERE user_id = ? ORDER BY id DESC LIMIT 100`,
        [userId]
    );
    return rows.map(parse_layout);
}

/**
 * 单篇手账（归属校验）
 * @param {number} userId
 * @param {number} id
 */
async function get(userId, id) {
    const row = await query_one(
        `SELECT id, user_id, title, DATE_FORMAT(date, '%Y-%m-%d') AS date, text, bg, bg_src, layout, cover, created_at
         FROM journal WHERE id = ? AND user_id = ?`,
        [id, userId]
    );
    if (!row) throw err.not_found('手账不存在');
    return parse_layout(row);
}

/**
 * 删除手账（归属校验）
 * @param {number} userId
 * @param {number} id
 */
async function remove(userId, id) {
    const r = await query('DELETE FROM journal WHERE id = ? AND user_id = ?', [id, userId]);
    if (!r.affectedRows) throw err.not_found('手账不存在');
}

/**
 * layout → 数组：JSON 列 mysql2 可能返回对象或字符串，双形态兼容
 */
function parse_layout(row) {
    let layout = [];
    if (Array.isArray(row.layout)) layout = row.layout;
    else if (typeof row.layout === 'string') {
        try { layout = JSON.parse(row.layout || '[]'); } catch { layout = []; }
    }
    return { ...row, layout };
}

module.exports = { create, update, get, list, remove, save_bg, CANVAS };
