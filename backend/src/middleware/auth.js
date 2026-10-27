/**
 * 鉴权中间件：JWT 校验 + 账号状态机（ACTIVE/MUTED/BANNED）
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { query_one } = require('../db/pool');
const { err } = require('../utils/api-error');

/**
 * 解析 Bearer Token 并加载用户（公开接口可跳过）
 * @param {import('express').Request} req
 * @returns {Promise<Object|null>} 用户行（不含密码）
 */
async function load_user(req) {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return null;
    let payload;
    try {
        payload = jwt.verify(auth.slice(7), config.jwt_secret);
    } catch {
        return null;
    }
    const user = await query_one(
        'SELECT id, username, nickname, email, avatar, avatar_object_key, fzu_uid, fzu_name, fzu_verified, role, status, muted_until, created_at FROM `user` WHERE id = ?',
        [payload.uid]
    );
    return user || null;
}

/**
 * 可选登录：有 token 就挂 req.user，没有也放行
 * @returns {Function} express 中间件
 */
function auth_optional() {
    return async (req, _res, next) => {
        req.user = await load_user(req);
        next();
    };
}

/**
 * 必须登录
 * @returns {Function} express 中间件
 */
function auth_required() {
    return async (req, _res, next) => {
        req.user = await load_user(req);
        if (!req.user) return next(err.unauthorized());
        next();
    };
}

/**
 * 写操作守卫：禁言/封禁不可写（禁言到期懒恢复）
 * @returns {Function} express 中间件
 */
function write_required() {
    return async (req, _res, next) => {
        req.user = await load_user(req);
        if (!req.user) return next(err.unauthorized());
        // 封禁/禁言 → 业务码 40302（账号状态不可发布）
        if (req.user.status === 2) return next(err.banned('账号已被封禁（只读模式）'));
        if (req.user.status === 1) {
            if (req.user.muted_until && new Date(req.user.muted_until) > new Date()) {
                return next(err.banned('账号禁言中，暂不能发布内容'));
            }
            // 禁言到期：懒恢复为正常
            await query_one('UPDATE `user` SET status = 0, muted_until = NULL WHERE id = ?', [req.user.id]);
            req.user.status = 0;
        }
        next();
    };
}

/**
 * 管理员守卫（role=1）
 * @returns {Function} express 中间件
 */
function admin_required() {
    return async (req, _res, next) => {
        req.user = await load_user(req);
        if (!req.user) return next(err.unauthorized());
        if (req.user.role !== 1) return next(err.forbidden('需要管理员权限'));
        next();
    };
}

module.exports = { auth_optional, auth_required, write_required, admin_required };
