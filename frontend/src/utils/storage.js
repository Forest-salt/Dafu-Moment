/**
 * localStorage 的 JSON 读写（前端唯一出口）
 * 设计依据：§6.4（状态与存储）；本文件的存在，是为了让业务数据迁后端时只有一个改点
 */

/**
 * 读一个 JSON 值；键不存在或解析失败都返回 fallback
 * @param {string} key 存储键
 * @param {*} fallback 默认值
 * @returns {*} 解析结果或默认值
 */
export function load_json(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

/**
 * 写一个 JSON 值
 * @param {string} key 存储键
 * @param {*} val 任意可 JSON 序列化的值
 * @returns {void}
 */
export function save_json(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
}

/**
 * 删一个键
 * @param {string} key 存储键
 * @returns {void}
 */
export function remove_key(key) {
    localStorage.removeItem(key);
}
