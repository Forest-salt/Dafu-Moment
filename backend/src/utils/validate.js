/**
 * 参数校验工具（422 口径）
 */

/**
 * 断言条件成立，否则抛 422
 * @param {boolean} cond - 条件
 * @param {string} msg - 文案
 */
function assert(cond, msg = '参数不合法') {
    if (!cond) {
        const e = new Error(msg);
        e.status = 422;
        throw e;
    }
}

/**
 * 校验 1-5 星整数
 * @param {*} v - 输入值
 * @param {string} name - 字段名
 * @returns {number}
 */
function assert_star(v, name) {
    const n = Number(v);
    assert(Number.isInteger(n) && n >= 1 && n <= 5, `${name} 需为 1-5 的整数`);
    return n;
}

/**
 * 校验非空字符串
 * @param {*} v - 输入值
 * @param {string} name - 字段名
 * @param {number} max - 最大长度
 * @returns {string}
 */
function assert_str(v, name, max = 200) {
    assert(typeof v === 'string' && v.trim().length > 0, `${name} 不能为空`);
    assert(v.length <= max, `${name} 不能超过 ${max} 字`);
    return v.trim();
}

/**
 * 校验非负整数分页参数
 * @param {*} v - 输入值
 * @param {number} def - 默认值
 * @returns {number}
 */
function page_int(v, def) {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : def;
}

module.exports = { assert, assert_star, assert_str, page_int };
