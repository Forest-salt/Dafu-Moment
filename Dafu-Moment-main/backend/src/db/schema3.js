/** 数据库设计3.0为结构基线；拒绝在旧22表库上自动重建或覆盖数据。 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');

function split_sql(text) {
    const result = [];
    let buf = '', quote = null, comment = null;
    for (let i = 0; i < text.length; i++) {
        const c = text[i], pair = text.slice(i, i + 2);
        if (comment === 'line') { if (c === '\n') { comment = null; buf += '\n'; } }
        else if (comment === 'block') { if (pair === '*/') { comment = null; i++; } }
        else if (quote) {
            buf += c;
            if (c === '\\' && i + 1 < text.length) buf += text[++i];
            else if (c === quote) { if (text[i + 1] === quote) buf += text[++i]; else quote = null; }
        } else if (pair === '--' || c === '#') comment = 'line';
        else if (pair === '/*') { comment = 'block'; i++; }
        else if (['\'', '"', '`'].includes(c)) { quote = c; buf += c; }
        else if (c === ';') { if (buf.trim()) result.push(buf.trim()); buf = ''; }
        else buf += c;
    }
    if (buf.trim()) result.push(buf.trim());
    return result;
}

async function ensure_schema() {
    const name = config.mysql.database;
    const root = path.resolve(__dirname, '../../..');
    const ddl = fs.readFileSync(path.join(root, 'data/db3/sql/00_create_tables.sql'),'utf8');
    if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error('DB_NAME must contain only letters, digits and underscores');
    const conn = await mysql.createConnection({ ...config.mysql, database: undefined, charset: 'utf8mb4_general_ci' });
    try {
        const [tables] = await conn.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = \'BASE TABLE\'', [name]);
        if (tables.length) {
            const [columns] = await conn.query('SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?', [name]);
            const present = new Set(columns.map((r) => `${r.TABLE_NAME}.${r.COLUMN_NAME}`));
            for (const key of ['user.password_hash', 'location.scene_category_id', 'station.location_id', 'rating_detail.dimension_id', 'check_in.location_id', 'favorite.biz_type']) {
                if (!present.has(key)) throw new Error(`数据库不是设计3.0结构（缺少${key}）；已停止启动，不会自动删表或覆盖旧数据。请在独立3.0库完成迁移核对后再切换DB_NAME。`);
            }
            if (tables.length !== 78) throw new Error(`3.0库应有78张业务表，实际${tables.length}；请先核对结构，程序不会自动补建到未知现有库。`);
            const normalize=s=>s.toLowerCase().replace(/\b(bigint|int|tinyint|smallint)\(\d+\)/g,'$1').replace(/\s+/g,' ').trim();
            let expected=0;
            for(const table of ddl.matchAll(/CREATE TABLE IF NOT EXISTS `([^`]+)` \(([\s\S]*?)\n\) ENGINE/g)) {
                for(const col of table[2].matchAll(/^\s*`([^`]+)` ([A-Z]+(?:\([^)]*\))?(?: UNSIGNED)?)([^\n]*)/gm)) {
                    expected++;
                    const actual=columns.find(c=>c.TABLE_NAME===table[1]&&c.COLUMN_NAME===col[1]);
                    if(!actual||normalize(actual.COLUMN_TYPE)!==normalize(col[2])) throw new Error(`数据库3.0列定义不一致：${table[1]}.${col[1]}；已停止启动，不会自动覆盖现有库。`);
                    const nullable=/\bNOT NULL\b/i.test(col[3].split('COMMENT')[0])?'NO':'YES';
                    if(actual.IS_NULLABLE!==nullable)throw new Error(`数据库3.0可空性不一致：${table[1]}.${col[1]}；已停止启动。`);
                }
            }
            if(expected!==545||columns.length!==expected) throw new Error('数据库3.0应有545列，检测到额外列或缺失列；已停止启动。');
            const [fk]=await conn.query("SELECT COUNT(*) n FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? AND CONSTRAINT_TYPE='FOREIGN KEY'",[name]);
            if(Number(fk[0].n)!==106) throw new Error('数据库3.0应有106条外键；已停止启动，请先核对迁移。');
            return;
        }
        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
        await conn.changeUser({ database: name });
        for (const file of ['00_create_tables.sql', '01_add_foreign_keys.sql', '02_dictionary_seed.sql']) {
            const sql = fs.readFileSync(path.join(root, 'data/db3/sql', file), 'utf8');
            for (const stmt of split_sql(sql)) {
                if (/^(CREATE DATABASE|USE )/i.test(stmt)) continue;
                await conn.query(stmt);
            }
        }
    } finally { await conn.end(); }
}

module.exports = { ensure_schema, split_sql };
