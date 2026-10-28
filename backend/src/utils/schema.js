/**
 * 数据库元信息探测（表/列是否存在），带内存缓存（60s）
 * 用于兼容尚未落库的可选表（privacy_setting / check_in / dietary_profile 等），
 * 避免对不存在的表发查询导致整条链路失败
 */
const config = require('../config');
const { query } = require('../db/pool');

let cache = null;

/**
 * 读取当前库全部表与列（小写归一）
 * @returns {Promise<Map<string, Set<string>>>}
 */
async function load_schema() {
    if (cache && Date.now() - cache.at < config.numbers.DIM_CACHE_TTL_MS) return cache.tables;
    const rows = await query(
        `SELECT LOWER(TABLE_NAME) AS t, LOWER(COLUMN_NAME) AS c
         FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`
    );
    const tables = new Map();
    for (const r of rows) {
        if (!tables.has(r.t)) tables.set(r.t, new Set());
        tables.get(r.t).add(r.c);
    }
    cache = { at: Date.now(), tables };
    return tables;
}

/**
 * 表是否存在
 * @param {string} name
 * @returns {Promise<boolean>}
 */
async function has_table(name) {
    return (await load_schema()).has(String(name).toLowerCase());
}

/**
 * 表存在且包含指定列
 * @param {string} table
 * @param {string} column
 * @returns {Promise<boolean>}
 */
async function has_column(table, column) {
    const cols = (await load_schema()).get(String(table).toLowerCase());
    return !!cols && cols.has(String(column).toLowerCase());
}

module.exports = { has_table, has_column };
