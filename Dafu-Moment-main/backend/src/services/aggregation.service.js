/**
 * 聚合服务：review_summary 全量重算（03 §2.13 v2.0）
 * 口径：对已发布评价做普通平均（无 WR 贝叶斯、无时间衰减、无图片加权）
 *       overall_score 已在写入时按维度权重算好，此处只做 AVG 与分项求和
 */
const { query } = require('../db/pool');

/**
 * 重算某对象的聚合摘要（评价发布/修改/删除/审核处置后调用）
 * @param {number} subject_type - 0 菜品 / 1 档口 / 2 点位
 * @param {number} subject_id
 * @returns {Promise<void>}
 */
async function recalc(subject_type, subject_id) {
    const rows = await query(
        `SELECT overall_score, dimension_scores FROM review
         WHERE subject_type = ? AND subject_id = ? AND status = 0`,
        [subject_type, subject_id]
    );
    let count = rows.length;
    let sum = 0;
    const hist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const dimSums = {};
    for (const r of rows) {
        const score = Number(r.overall_score);
        sum += score;
        const bucket = Math.min(5, Math.max(1, Math.round(score)));
        hist[bucket] += 1;
        // 分项求和（JSON 键随维度配置开放结构）
        let dims = r.dimension_scores;
        if (typeof dims === 'string') {
            try { dims = JSON.parse(dims); } catch { dims = {}; }
        }
        for (const [k, v] of Object.entries(dims || {})) {
            dimSums[k] = (dimSums[k] || 0) + Number(v);
        }
    }
    const avg = count > 0 ? Number((sum / count).toFixed(2)) : 0;
    await query(
        `INSERT INTO review_summary
            (subject_type, subject_id, review_count, sum_score, rating_avg, dim_sums,
             hist_1, hist_2, hist_3, hist_4, hist_5, recalc_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
            review_count = VALUES(review_count), sum_score = VALUES(sum_score),
            rating_avg = VALUES(rating_avg), dim_sums = VALUES(dim_sums),
            hist_1 = VALUES(hist_1), hist_2 = VALUES(hist_2), hist_3 = VALUES(hist_3),
            hist_4 = VALUES(hist_4), hist_5 = VALUES(hist_5), recalc_at = NOW()`,
        [subject_type, subject_id, count, Number(sum.toFixed(2)), avg,
            JSON.stringify(dimSums), hist[1], hist[2], hist[3], hist[4], hist[5]]
    );
}

/**
 * 全量兜底重算（每日任务 / 运维维护用）
 * @returns {Promise<{recalculated: number}>}
 */
async function recalc_all() {
    const rows = await query(
        'SELECT DISTINCT subject_type, subject_id FROM review'
    );
    for (const r of rows) {
        await recalc(Number(r.subject_type), Number(r.subject_id));
    }
    return { recalculated: rows.length };
}

module.exports = { recalc, recalc_all };
