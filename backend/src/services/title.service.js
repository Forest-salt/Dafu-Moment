/**
 * 个人统计与头衔服务（T-21）：个人主页贡献分与头衔进度
 * 数据源：已发布评价数 / 获赞数 / 收藏数 / 打卡数（可选表）/ 去过的不同点位数
 * 头衔档位与权重来自 config.numbers.TITLE_TIERS / CONTRIB_WEIGHTS
 */
const config = require('../config');
const { query, query_one } = require('../db/pool');
const { err } = require('../utils/api-error');
const { has_table, has_column } = require('../utils/schema');

const N = config.numbers;

/**
 * 去重后的点位数（评价反推 + 打卡点位）
 * @param {number} userId
 * @returns {Promise<Set<number>>}
 */
async function visited_spots(userId) {
    const rows = await query(
        `SELECT DISTINCT canteen_id FROM (
            SELECT s.canteen_id AS canteen_id
              FROM review r
              JOIN dish d ON d.id = r.subject_id
              JOIN station s ON s.id = d.station_id
             WHERE r.user_id = ? AND r.subject_type = 0 AND r.status = 0
            UNION
            SELECT s.canteen_id AS canteen_id
              FROM review r
              JOIN station s ON s.id = r.subject_id
             WHERE r.user_id = ? AND r.subject_type = 1 AND r.status = 0
            UNION
            SELECT r.subject_id AS canteen_id
              FROM review r
             WHERE r.user_id = ? AND r.subject_type = 2 AND r.status = 0
        ) x WHERE canteen_id IS NOT NULL`,
        [userId, userId, userId]
    );
    const spots = new Set(rows.map((r) => Number(r.canteen_id)).filter((n) => Number.isInteger(n) && n > 0));

    // 打卡表由 D 择期落库：location_id 为已登记映射（对应 canteen.id）
    if (await has_table('check_in') && await has_column('check_in', 'location_id')) {
        const deleted = (await has_column('check_in', 'deleted_at')) ? ' AND deleted_at IS NULL' : '';
        const checkins = await query(
            `SELECT DISTINCT location_id FROM check_in WHERE user_id = ?${deleted}`,
            [userId]
        );
        for (const r of checkins) {
            const id = Number(r.location_id);
            if (Number.isInteger(id) && id > 0) spots.add(id);
        }
    }
    return spots;
}

/**
 * 打卡次数（表未落库按 0）
 * @param {number} userId
 * @returns {Promise<number>}
 */
async function check_in_count(userId) {
    if (!(await has_table('check_in'))) return 0;
    const deleted = (await has_column('check_in', 'deleted_at')) ? ' AND deleted_at IS NULL' : '';
    const row = await query_one(`SELECT COUNT(*) c FROM check_in WHERE user_id = ?${deleted}`, [userId]);
    return Number(row.c) || 0;
}

/**
 * 按贡献分计算头衔档位与下一档进度
 * @param {number} contribution
 * @returns {Object}
 */
function title_of(contribution) {
    const tiers = N.TITLE_TIERS;
    let index = 0;
    for (let i = 0; i < tiers.length; i += 1) {
        if (contribution >= tiers[i].min) index = i;
    }
    const current = tiers[index];
    const next = tiers[index + 1] || null;
    const span = next ? next.min - current.min : 0;
    const progress = next
        ? Math.min(100, Math.max(0, Math.round(((contribution - current.min) / span) * 100)))
        : 100;
    return {
        name: current.name,
        level: index + 1,
        min: current.min,
        next_name: next ? next.name : null,
        next_min: next ? next.min : null,
        progress,
        remaining: next ? Math.max(0, next.min - contribution) : 0,
        is_max: !next,
    };
}

/**
 * 汇总个人统计与头衔进度
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function stats_for(userId) {
    const reviewRow = await query_one(
        'SELECT COUNT(*) c, COALESCE(SUM(like_count), 0) likes FROM review WHERE user_id = ? AND status = 0',
        [userId]
    );
    const favRow = await query_one('SELECT COUNT(*) c FROM favorite WHERE user_id = ?', [userId]);
    const checkInCount = await check_in_count(userId);
    const spots = await visited_spots(userId);

    const reviewCount = Number(reviewRow.c) || 0;
    const likeCount = Number(reviewRow.likes) || 0;
    const favoriteCount = Number(favRow.c) || 0;
    const spotCount = spots.size;
    const w = N.CONTRIB_WEIGHTS;
    const contribution = reviewCount * w.review
        + likeCount * w.like
        + favoriteCount * w.favorite
        + checkInCount * w.checkin
        + spotCount * w.spot;

    return {
        stats: {
            review_count: reviewCount,
            like_count: likeCount,
            favorite_count: favoriteCount,
            check_in_count: checkInCount,
            spot_count: spotCount,
            contribution,
        },
        title: title_of(contribution),
    };
}

/**
 * 公开主页用的统计摘要（先校验用户存在）
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function public_summary(userId) {
    const u = await query_one('SELECT id FROM `user` WHERE id = ?', [userId]);
    if (!u) throw err.not_found('用户不存在');
    return stats_for(userId);
}

module.exports = { stats_for, public_summary, title_of, visited_spots };
