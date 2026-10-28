/**
 * 关注关系服务（T-14）：同一关注对唯一去重，取关软删除，列表含互关标记
 * 表 follow_relation（设计文档 §4）：follower_id / followee_id / valid_flag / deleted_at
 * 表未落库时读取返回空列表，写入明确报不可用
 */
const config = require('../config');
const { query, query_one } = require('../db/pool');
const { err } = require('../utils/api-error');
const { assert } = require('../utils/validate');
const { has_table, has_column } = require('../utils/schema');

const N = config.numbers;

/**
 * follow_relation 是否可用于读写
 * @returns {Promise<boolean>}
 */
async function table_ready() {
    return has_table('follow_relation')
        && has_column('follow_relation', 'follower_id')
        && has_column('follow_relation', 'followee_id');
}

/**
 * 有效行条件（无 deleted_at 列时所有行均视为有效）
 * @param {string} alias - 表别名
 * @returns {Promise<string>}
 */
async function active_cond(alias) {
    return (await has_column('follow_relation', 'deleted_at')) ? ` AND ${alias}.deleted_at IS NULL` : '';
}

/**
 * 关注某人（已关注幂等返回；已取关则复活原关系行）
 * @param {number} userId
 * @param {number} targetId
 * @returns {Promise<{followed: boolean, already: boolean}>}
 */
async function follow(userId, targetId) {
    assert(Number.isInteger(targetId) && targetId > 0, '用户 ID 不合法');
    assert(targetId !== userId, '不能关注自己');
    if (!(await table_ready())) throw err.unavailable('关注功能暂未开放（数据表待建）');
    const target = await query_one('SELECT id FROM `user` WHERE id = ?', [targetId]);
    if (!target) throw err.not_found('用户不存在');

    const hasDeleted = await has_column('follow_relation', 'deleted_at');
    const hasValidFlag = await has_column('follow_relation', 'valid_flag');
    const active = hasDeleted
        ? await query_one(
            'SELECT id FROM follow_relation WHERE follower_id = ? AND followee_id = ? AND deleted_at IS NULL LIMIT 1',
            [userId, targetId]
        )
        : await query_one(
            'SELECT id FROM follow_relation WHERE follower_id = ? AND followee_id = ? LIMIT 1',
            [userId, targetId]
        );
    if (active) return { followed: true, already: true };

    // 取关过的关系行复活，避免同一关注对堆叠多行
    if (hasDeleted) {
        const sets = hasValidFlag ? 'deleted_at = NULL, valid_flag = 1' : 'deleted_at = NULL';
        const revived = await query(
            `UPDATE follow_relation SET ${sets} WHERE follower_id = ? AND followee_id = ? AND deleted_at IS NOT NULL`,
            [userId, targetId]
        );
        if (revived.affectedRows > 0) return { followed: true, already: false };
    }
    const names = ['follower_id', 'followee_id'];
    const values = [userId, targetId];
    if (hasValidFlag) { names.push('valid_flag'); values.push(1); }
    try {
        await query(
            `INSERT INTO follow_relation (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
            values
        );
    } catch (e) {
        // 并发重复关注：唯一键拦截后按已关注处理（不先查后插）
        if (e.code !== 'ER_DUP_ENTRY') throw e;
        return { followed: true, already: true };
    }
    return { followed: true, already: false };
}

/**
 * 取关（未关注按 404 处理；取关即删除关系记录，保留软删除行）
 * @param {number} userId
 * @param {number} targetId
 * @returns {Promise<{followed: boolean}>}
 */
async function unfollow(userId, targetId) {
    assert(Number.isInteger(targetId) && targetId > 0, '用户 ID 不合法');
    if (!(await table_ready())) throw err.unavailable('关注功能暂未开放（数据表待建）');
    const hasDeleted = await has_column('follow_relation', 'deleted_at');
    const hasValidFlag = await has_column('follow_relation', 'valid_flag');
    let r;
    if (hasDeleted) {
        const sets = hasValidFlag ? 'deleted_at = NOW(), valid_flag = NULL' : 'deleted_at = NOW()';
        r = await query(
            `UPDATE follow_relation SET ${sets} WHERE follower_id = ? AND followee_id = ? AND deleted_at IS NULL`,
            [userId, targetId]
        );
    } else {
        r = await query('DELETE FROM follow_relation WHERE follower_id = ? AND followee_id = ?', [userId, targetId]);
    }
    if (!r.affectedRows) throw err.not_found('尚未关注该用户');
    return { followed: false };
}

/**
 * 关注状态（公开主页按钮初始态）
 * @param {number} userId
 * @param {number} targetId
 * @returns {Promise<{followed: boolean, available: boolean}>}
 */
async function follow_status(userId, targetId) {
    assert(Number.isInteger(targetId) && targetId > 0, '用户 ID 不合法');
    if (!(await table_ready())) return { followed: false, available: false };
    const row = await query_one(
        `SELECT id FROM follow_relation WHERE follower_id = ? AND followee_id = ?${await active_cond('follow_relation')} LIMIT 1`,
        [userId, targetId]
    );
    return { followed: !!row, available: true };
}

/**
 * 我的关注 / 粉丝列表（附互关标记）
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function list_mine(userId) {
    if (!(await table_ready())) {
        return {
            available: false, following: [], followers: [],
            following_count: 0, follower_count: 0, mutual_count: 0,
        };
    }
    const condFr = await active_cond('fr');
    const condF2 = await active_cond('f2');
    const following = await query(
        `SELECT fr.followee_id AS user_id, u.nickname, u.avatar, u.avatar_object_key, u.fzu_verified,
                fr.created_at,
                EXISTS(SELECT 1 FROM follow_relation f2
                       WHERE f2.follower_id = fr.followee_id AND f2.followee_id = fr.follower_id${condF2}) AS mutual
         FROM follow_relation fr JOIN \`user\` u ON u.id = fr.followee_id
         WHERE fr.follower_id = ?${condFr}
         ORDER BY fr.created_at DESC LIMIT ?`,
        [userId, N.FOLLOW_LIST_MAX]
    );
    const followers = await query(
        `SELECT fr.follower_id AS user_id, u.nickname, u.avatar, u.avatar_object_key, u.fzu_verified,
                fr.created_at,
                EXISTS(SELECT 1 FROM follow_relation f2
                       WHERE f2.follower_id = fr.follower_id AND f2.followee_id = fr.follower_id${condF2}) AS mutual
         FROM follow_relation fr JOIN \`user\` u ON u.id = fr.follower_id
         WHERE fr.followee_id = ?${condFr}
         ORDER BY fr.created_at DESC LIMIT ?`,
        [userId, N.FOLLOW_LIST_MAX]
    );

    /**
     * 列表行归一（boolean 化 fzu_verified / mutual）
     * @param {Object} r
     * @returns {Object}
     */
    const shape = (r) => ({
        user_id: Number(r.user_id),
        nickname: r.nickname,
        avatar: Number(r.avatar) || 0,
        avatar_object_key: r.avatar_object_key || null,
        fzu_verified: Number(r.fzu_verified) === 1,
        mutual: Number(r.mutual) === 1,
        followed_at: r.created_at,
    });
    const followingList = following.map((r) => ({ ...shape(r), followed: true }));
    const followerList = followers.map(shape);
    const mutualCount = followingList.filter((r) => r.mutual).length;
    return {
        available: true,
        following: followingList,
        followers: followerList,
        following_count: followingList.length,
        follower_count: followerList.length,
        mutual_count: mutualCount,
    };
}

/**
 * 某用户的关注/粉丝计数（他人主页展示；表未落库返回 available=false）
 * @param {number} userId
 * @param {number|null} viewerId
 * @returns {Promise<Object>}
 */
async function counts(userId, viewerId) {
    if (!(await table_ready())) {
        return { available: false, following_count: 0, follower_count: 0, followed: false };
    }
    const cond = await active_cond('fr');
    const following = await query_one(
        `SELECT COUNT(*) c FROM follow_relation fr WHERE fr.follower_id = ?${cond}`,
        [userId]
    );
    const followers = await query_one(
        `SELECT COUNT(*) c FROM follow_relation fr WHERE fr.followee_id = ?${cond}`,
        [userId]
    );
    let followed = false;
    if (viewerId && Number(viewerId) !== Number(userId)) {
        followed = !!(await query_one(
            `SELECT id FROM follow_relation fr WHERE fr.follower_id = ? AND fr.followee_id = ?${cond} LIMIT 1`,
            [viewerId, userId]
        ));
    }
    return {
        available: true,
        following_count: Number(following.c) || 0,
        follower_count: Number(followers.c) || 0,
        followed,
    };
}

module.exports = { follow, unfollow, follow_status, list_mine, counts };
