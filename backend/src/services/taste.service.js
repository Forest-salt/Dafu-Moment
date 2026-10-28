/**
 * 口味画像服务（T-12）：由已发布评价、收藏与打卡（可选表）聚合五维画像
 * 五维：辣度接受度 / 口味风格 / 消费倾向 / 常去场所 / 排队接受度；饭 MBTI 编码可另存
 * 数据样本 < TASTE_MIN_SAMPLES 时只返回提示，不强行生成画像
 */
const config = require('../config');
const { query, query_one } = require('../db/pool');
const { assert } = require('../utils/validate');
const { has_table, has_column } = require('../utils/schema');
const settings = require('./settings.service');

const N = config.numbers;

/** 点位类型 → 常去场所文案 */
const CANTEEN_TYPE_LABEL = { 0: '校内食堂', 1: '永嘉天地', 2: '学生街', 3: '周边其他' };

/** 口味风格规则：按标签命中优先级判定（先命中先归类） */
const STYLE_RULES = [
    { style: '无辣不欢', re: /辣/ },
    { style: '清淡本味', re: /清淡|少油|爽口|素食|轻食/ },
    { style: '清甜挂', re: /甜|酸甜|果茶/ },
    { style: '家常下饭', re: /咸鲜|浓郁|下饭|家常/ },
    { style: '猎奇混搭', re: /猎奇|混搭|脑洞|新品/ },
];

/**
 * JSON 列兼容解析（mysql2 可能返回对象或字符串）
 * @param {*} raw
 * @returns {Object}
 */
function parse_json(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return {}; }
}

/**
 * IN 查询的空集合保护
 * @param {Set<number>} set
 * @returns {number[]}
 */
function ids_of(set) {
    return [...set].filter((n) => Number.isInteger(n) && n > 0);
}

/**
 * 菜肴对象 → 画像属性
 * @param {number[]} ids
 * @returns {Promise<Map<number, Object>>}
 */
async function load_dish_map(ids) {
    const map = new Map();
    if (ids.length === 0) return map;
    const rows = await query(
        `SELECT d.id, d.price, d.taste_tags,
                s.id AS station_id, s.category AS station_category,
                c.id AS canteen_id, c.type AS canteen_type, c.name AS canteen_name,
                c.avg_price AS canteen_price
         FROM dish d
         JOIN station s ON s.id = d.station_id
         JOIN canteen c ON c.id = s.canteen_id
         WHERE d.id IN (?)`,
        [ids]
    );
    for (const r of rows) {
        map.set(Number(r.id), {
            price: Number(r.price) || null,
            tasteText: r.taste_tags || '',
            canteenType: Number(r.canteen_type),
            canteenName: r.canteen_name || '',
        });
    }
    return map;
}

/**
 * 档口对象 → 画像属性
 * @param {number[]} ids
 * @returns {Promise<Map<number, Object>>}
 */
async function load_station_map(ids) {
    const map = new Map();
    if (ids.length === 0) return map;
    const rows = await query(
        `SELECT s.id, s.category,
                c.id AS canteen_id, c.type AS canteen_type, c.name AS canteen_name,
                c.avg_price AS canteen_price
         FROM station s JOIN canteen c ON c.id = s.canteen_id
         WHERE s.id IN (?)`,
        [ids]
    );
    for (const r of rows) {
        map.set(Number(r.id), {
            price: Number(r.canteen_price) || null,
            tasteText: r.category || '',
            canteenType: Number(r.canteen_type),
            canteenName: r.canteen_name || '',
        });
    }
    return map;
}

/**
 * 点位对象 → 画像属性
 * @param {number[]} ids
 * @returns {Promise<Map<number, Object>>}
 */
async function load_canteen_map(ids) {
    const map = new Map();
    if (ids.length === 0) return map;
    const rows = await query(
        'SELECT id, name, type, avg_price FROM canteen WHERE id IN (?)',
        [ids]
    );
    for (const r of rows) {
        map.set(Number(r.id), {
            price: Number(r.avg_price) || null,
            tasteText: '',
            canteenType: Number(r.type),
            canteenName: r.name || '',
        });
    }
    return map;
}

/**
 * 读取行为样本：已发布评价 + 收藏（打卡仅计入样本量）
 * @param {number} userId
 * @returns {Promise<{samples: Array, checkInCount: number}>}
 */
async function load_samples(userId) {
    const reviews = await query(
        `SELECT subject_type, subject_id, dimension_scores, tags
         FROM review WHERE user_id = ? AND status = 0
         ORDER BY created_at DESC LIMIT ?`,
        [userId, N.TASTE_MAX_SAMPLES]
    );
    const favorites = await query(
        'SELECT subject_type, subject_id FROM favorite WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
        [userId, N.TASTE_MAX_SAMPLES]
    );

    const dishIds = new Set();
    const stationIds = new Set();
    const canteenIds = new Set();
    for (const row of [...reviews, ...favorites]) {
        const type = Number(row.subject_type);
        const id = Number(row.subject_id);
        if (type === 0) dishIds.add(id);
        else if (type === 1) stationIds.add(id);
        else if (type === 2) canteenIds.add(id);
    }
    const [dishMap, stationMap, canteenMap] = await Promise.all([
        load_dish_map(ids_of(dishIds)),
        load_station_map(ids_of(stationIds)),
        load_canteen_map(ids_of(canteenIds)),
    ]);

    /**
     * 取对象属性；对象已删除时返回空属性（样本仍保留）
     * @param {number} type
     * @param {number} id
     * @returns {Object}
     */
    const attrs_of = (type, id) => {
        if (type === 0) return dishMap.get(id) || {};
        if (type === 1) return stationMap.get(id) || {};
        return canteenMap.get(id) || {};
    };

    const samples = [];
    for (const row of reviews) {
        const attrs = attrs_of(Number(row.subject_type), Number(row.subject_id));
        samples.push({
            ...attrs,
            tasteText: `${attrs.tasteText || ''} ${row.tags || ''}`.trim(),
            dims: parse_json(row.dimension_scores),
        });
    }
    for (const row of favorites) {
        const attrs = attrs_of(Number(row.subject_type), Number(row.subject_id));
        samples.push({ ...attrs, tasteText: attrs.tasteText || '', dims: {} });
    }

    // 打卡表由 D 择期落库：仅计入样本量，没有打卡表时按 0 处理
    let checkInCount = 0;
    if (await has_table('check_in')) {
        const deleted = (await has_column('check_in', 'deleted_at')) ? ' AND deleted_at IS NULL' : '';
        const row = await query_one(`SELECT COUNT(*) c FROM check_in WHERE user_id = ?${deleted}`, [userId]);
        checkInCount = Number(row.c) || 0;
    }
    return { samples, checkInCount };
}

/**
 * 取出现次数最多的键
 * @param {Object<string, number>} tally
 * @returns {string|null}
 */
function top_key(tally) {
    let best = null;
    let bestCount = 0;
    for (const [key, count] of Object.entries(tally)) {
        if (count > bestCount) { best = key; bestCount = count; }
    }
    return best;
}

/**
 * 数值平均（无有效值返回 null）
 * @param {number[]} values
 * @returns {number|null}
 */
function average(values) {
    const valid = values.filter((v) => Number.isFinite(v));
    if (valid.length === 0) return null;
    return valid.reduce((s, v) => s + v, 0) / valid.length;
}

/**
 * 五维聚合（纯函数，便于单测）
 * @param {Array} samples
 * @returns {Object}
 */
function aggregate(samples) {
    const styleTally = {};
    const sceneTally = {};
    const prices = [];
    const queueScores = [];
    let spicyCount = 0;

    for (const s of samples) {
        if (/辣/.test(s.tasteText || '')) spicyCount += 1;
        const rule = STYLE_RULES.find((r) => r.re.test(s.tasteText || ''));
        if (rule) styleTally[rule.style] = (styleTally[rule.style] || 0) + 1;
        const scene = CANTEEN_TYPE_LABEL[Number(s.canteenType)];
        if (scene) sceneTally[scene] = (sceneTally[scene] || 0) + 1;
        if (Number.isFinite(Number(s.price)) && Number(s.price) > 0) prices.push(Number(s.price));
        const q = Number((s.dims || {}).queue);
        if (Number.isFinite(q) && q >= 1 && q <= 5) queueScores.push(q);
    }

    const total = samples.length;
    const spicyRatio = total > 0 ? spicyCount / total : 0;
    // 辣度 1-5：按“带辣样本占比”分段
    let spiceLevel = 1;
    if (spicyRatio >= 0.6) spiceLevel = 5;
    else if (spicyRatio >= 0.4) spiceLevel = 4;
    else if (spicyRatio >= 0.2) spiceLevel = 3;
    else if (spicyRatio > 0) spiceLevel = 2;

    const avgPrice = average(prices);
    let spendTendency = '均衡消费';
    if (avgPrice !== null) {
        if (avgPrice <= 10) spendTendency = '¥10 内精打细算';
        else if (avgPrice <= 15) spendTendency = '¥15 左右刚刚好';
        else if (avgPrice <= 22) spendTendency = '¥20 想吃点好的';
        else spendTendency = '遇到好吃的价格不限';
    }

    const queueAvg = average(queueScores);
    let queueTolerance = '待积累';
    if (queueAvg !== null) {
        if (queueAvg >= 4.2) queueTolerance = '不愿排队';
        else if (queueAvg >= 3.2) queueTolerance = '10 分钟内可以等';
        else if (queueAvg >= 2.2) queueTolerance = '30 分钟看情况';
        else queueTolerance = '愿意久等';
    }

    return {
        spice_level: spiceLevel,
        taste_style: top_key(styleTally) || '均衡多元',
        spend_tendency: spendTendency,
        common_scene: top_key(sceneTally) || '待积累',
        queue_tolerance: queueTolerance,
        avg_price: avgPrice === null ? null : Math.round(avgPrice * 10) / 10,
        spicy_ratio: total > 0 ? Math.round((spicyCount / total) * 100) / 100 : 0,
    };
}

/**
 * 五维展示数组（前端画像卡直接渲染）
 * @param {Object} profile
 * @returns {Array}
 */
function dimensions_of(profile) {
    return [
        { key: 'spice_level', label: '辣度偏好', value: profile.spice_level, text: ['完全不辣', '微辣刚好', '中辣过瘾', '重辣才爽', '无辣不欢'][profile.spice_level - 1] },
        { key: 'taste_style', label: '口味风格', value: profile.taste_style, text: profile.taste_style },
        { key: 'spend_tendency', label: '消费倾向', value: profile.spend_tendency, text: profile.spend_tendency },
        { key: 'common_scene', label: '常见场景', value: profile.common_scene, text: profile.common_scene },
        { key: 'queue_tolerance', label: '排队接受度', value: profile.queue_tolerance, text: profile.queue_tolerance },
    ];
}

/**
 * 读取已落库画像（表未建返回 null）
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
async function stored_profile(userId) {
    if (!(await has_table('taste_profile'))) return null;
    const deleted = (await has_column('taste_profile', 'deleted_at')) ? ' AND deleted_at IS NULL' : '';
    return query_one(`SELECT * FROM taste_profile WHERE user_id = ?${deleted} ORDER BY id DESC LIMIT 1`, [userId]);
}

/**
 * 画像缺口提示
 * @param {number} sampleCount
 * @returns {string}
 */
function lack_hint(sampleCount) {
    return `口味画像数据还不够（已积累 ${sampleCount}/${N.TASTE_MIN_SAMPLES} 条行为），多点评或收藏几道菜后再来看看~`;
}

/**
 * 查询我的口味画像（实时聚合；未授权行为分析时不读取行为数据）
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function get_profile(userId) {
    if (!(await settings.allowed(userId, 'behavior_analysis_allowed'))) {
        return {
            authorized: false,
            enough: false,
            sample_count: 0,
            min_samples: N.TASTE_MIN_SAMPLES,
            message: '未授权行为分析，开启「行为数据授权」后可生成口味画像',
            profile: null,
            dimensions: [],
        };
    }
    const { samples, checkInCount } = await load_samples(userId);
    const sampleCount = samples.length + checkInCount;
    const stored = await stored_profile(userId);
    const base = {
        authorized: true,
        enough: sampleCount >= N.TASTE_MIN_SAMPLES,
        sample_count: sampleCount,
        min_samples: N.TASTE_MIN_SAMPLES,
        persisted: !!stored,
    };
    if (!base.enough) {
        return { ...base, message: lack_hint(sampleCount), profile: null, dimensions: [] };
    }
    const profile = aggregate(samples);
    profile.sample_count = sampleCount;
    profile.mbti_code = stored && stored.mbti_code ? stored.mbti_code : null;
    profile.updated_at = stored && stored.updated_at ? stored.updated_at : null;
    return { ...base, profile, dimensions: dimensions_of(profile) };
}

/**
 * 重新生成画像（可选保存饭 MBTI 编码；表未落库时仅返回计算结果）
 * @param {number} userId
 * @param {{mbtiCode?: string}} input
 * @returns {Promise<Object>}
 */
async function refresh_profile(userId, input) {
    const result = await get_profile(userId);
    if (!result.authorized || !result.enough) return result;
    const mbti = input && input.mbtiCode ? String(input.mbtiCode).trim().toUpperCase() : null;
    if (mbti) assert(/^[A-Z]{4}$/.test(mbti), 'MBTI 编码需为 4 位字母');
    if (!(await has_table('taste_profile'))) {
        return { ...result, persisted: false, message: '画像已生成（画像表待建，暂不落库）' };
    }

    const p = result.profile;
    // 软删除后重新生成：优先复活原行，避免撞 user_id 唯一键
    const hasDeleted = await has_column('taste_profile', 'deleted_at');
    const existing = await query_one(
        'SELECT * FROM taste_profile WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        [userId]
    );
    const row = {
        spice_level: p.spice_level,
        taste_style: p.taste_style,
        spend_tendency: p.spend_tendency,
        common_scene: p.common_scene,
        queue_tolerance: p.queue_tolerance,
        mbti_code: mbti || (existing && existing.mbti_code) || null,
    };
    const cols = [];
    for (const key of Object.keys(row)) {
        if (await has_column('taste_profile', key)) cols.push(key);
    }
    if (existing) {
        const sets = cols.map((c) => `${c} = ?`);
        if (hasDeleted) sets.push('deleted_at = NULL');
        await query(
            `UPDATE taste_profile SET ${sets.join(', ')} WHERE id = ?`,
            [...cols.map((c) => row[c]), existing.id]
        );
    } else {
        const names = ['user_id', ...cols];
        await query(
            `INSERT INTO taste_profile (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
            [userId, ...cols.map((c) => row[c])]
        );
    }
    return {
        ...result,
        persisted: true,
        profile: { ...p, mbti_code: row.mbti_code, updated_at: new Date().toISOString() },
    };
}

/**
 * 删除画像（软删除优先；表未落库时返回 0）
 * @param {number} userId
 * @returns {Promise<{deleted: number, persisted: boolean}>}
 */
async function delete_profile(userId) {
    if (!(await has_table('taste_profile'))) return { deleted: 0, persisted: false };
    let r;
    if (await has_column('taste_profile', 'deleted_at')) {
        r = await query(
            'UPDATE taste_profile SET deleted_at = NOW() WHERE user_id = ? AND deleted_at IS NULL',
            [userId]
        );
    } else {
        r = await query('DELETE FROM taste_profile WHERE user_id = ?', [userId]);
    }
    return { deleted: r.affectedRows || 0, persisted: true };
}

module.exports = { get_profile, refresh_profile, delete_profile, aggregate };
