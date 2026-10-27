/**
 * MySQL 连接池（mysql2/promise，手写 SQL 为唯一真相源）
 */
const mysql = require('mysql2/promise');
const config = require('../config');

const pool = mysql.createPool({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4_general_ci',
    timezone: '+08:00',
    dateStrings: false,
    decimalNumbers: true, // DECIMAL 返回 number（默认字符串会导致前端 .toFixed 崩溃）
});

/**
 * 执行查询，返回行数组
 * @param {string} sql - 参数化 SQL（? 占位）
 * @param {Array} params - 参数列表
 * @returns {Promise<Array>}
 */
async function query(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
}

/**
 * 执行单行查询，无结果返回 null
 * @param {string} sql - 参数化 SQL
 * @param {Array} params - 参数列表
 * @returns {Promise<Object|null>}
 */
async function query_one(sql, params = []) {
    const rows = await query(sql, params);
    return rows.length ? rows[0] : null;
}

/**
 * 获取独立连接（事务用）
 * @returns {Promise<import('mysql2/promise').PoolConnection>}
 */
async function get_conn() {
    return pool.getConnection();
}

module.exports = { pool, query, query_one, get_conn };
