/**
 * Redis 客户端（ioredis）+ 降级包装：Redis 挂掉时核心浏览可用（NFR-4）
 */
const Redis = require('ioredis');
const config = require('../config');

const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    retryStrategy: (times) => Math.min(times * 200, 3000),
    maxRetriesPerRequest: 1,
    lazyConnect: false,
});

/**
 * 降级安全执行：Redis 异常时返回兜底值，不阻断主流程
 * @param {Function} fn - Redis 操作
 * @param {*} fallback - 兜底返回值
 * @returns {Promise<*>}
 */
async function redis_safe(fn, fallback = null) {
    try {
        return await fn();
    } catch (err) {
        console.warn('[redis] 降级:', err.message);
        return fallback;
    }
}

/**
 * 固定窗口计数（频控核心）：INCR + 首次 EXPIRE
 * @param {string} key - 频控键
 * @param {number} window_sec - 窗口秒数
 * @returns {Promise<number>} 当前计数
 */
async function incr_with_ttl(key, window_sec) {
    return redis_safe(async () => {
        const n = await redis.incr(key);
        if (n === 1) await redis.expire(key, window_sec);
        return n;
    }, 0);
}

module.exports = { redis, redis_safe, incr_with_ttl };
