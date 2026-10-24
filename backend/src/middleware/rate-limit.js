/**
 * Redis 固定窗口限流中间件（rl:{action}:{userId}:{bucket}）
 * Redis 不可用时降级放行（NFR-4）
 */
const { incr_with_ttl } = require('../db/redis');
const { err } = require('../utils/api-error');

/**
 * 限流工厂
 * @param {string} action - 动作名（review/vote/upload/ai/point-submit）
 * @param {number} max - 窗口内最大次数
 * @param {number} window_sec - 窗口秒数
 * @returns {Function} express 中间件
 */
function rate_limit(action, max, window_sec) {
    return async (req, _res, next) => {
        const uid = req.user ? req.user.id : (req.ip || 'anon');
        const bucket = Math.floor(Date.now() / 1000 / window_sec);
        const key = `rl:${action}:${uid}:${bucket}`;
        const n = await incr_with_ttl(key, window_sec);
        if (n > max) return next(err.too_many());
        next();
    };
}

module.exports = { rate_limit };
