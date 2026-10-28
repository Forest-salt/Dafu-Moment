/**
 * 成长任务服务（T-20）：每日任务 / 成长任务的进度、领取与金币流水
 * 表：task（任务定义）/ task_claim（领取记录，UK user_id+task_id+claim_date）/
 *     coin_transaction（金币流水，余额按上一行 balance_after 行锁串行）
 * 任务动作完成度按现有业务数据实时判定；表未落库时列表返空、领取明确报不可用
 */
const config = require('../config');
const { query, query_one, get_conn } = require('../db/pool');
const { err } = require('../utils/api-error');
const { has_table, has_column } = require('../utils/schema');

const N = config.numbers;

/** 任务类型 */
const DAILY = 1;
const GROWTH = 2;

/**
 * 任务相关表是否可读
 * @returns {Promise<boolean>}
 */
async function tables_ready() {
    return has_table('task') && has_table('task_claim');
}

/**
 * 任务表名转义（避免与 SQL 关键字冲突）
 */
const TASK_TABLE = '`task`';

/**
 * 单表计数（可选软删除 / 仅今日）
 * @param {string} table
 * @param {number} userId
 * @param {{today: boolean, dateCol?: string, status?: number}} opts
 * @returns {Promise<number>}
 */
async function count_rows(table, userId, opts) {
    if (!(await has_table(table))) return 0;
    const conds = ['user_id = ?'];
    const params = [userId];
    if (await has_column(table, 'deleted_at')) conds.push('deleted_at IS NULL');
    if (opts.status !== undefined && await has_column(table, 'status')) {
        conds.push('status = ?');
        params.push(Number(opts.status));
    }
    if (opts.today) {
        const dateCol = opts.dateCol || 'created_at';
        if (await has_column(table, dateCol)) {
            conds.push(`${dateCol} >= CURDATE() AND ${dateCol} < CURDATE() + INTERVAL 1 DAY`);
        }
    }
    const row = await query_one(`SELECT COUNT(*) c FROM \`${table}\` WHERE ${conds.join(' AND ')}`, params);
    return Number(row.c) || 0;
}

/**
 * 互动数：点过赞 + 发过评论（两者均按可选表累加）
 * @param {number} userId
 * @param {boolean} today
 * @returns {Promise<number>}
 */
async function interaction_count(userId, today) {
    let total = await count_rows('review_like', userId, { today });
    let commentTable = null;
    if (await has_table('post_comment')) commentTable = 'post_comment';
    else if (await has_table('review_reply') && await has_column('review_reply', 'parent_type')) commentTable = 'review_reply';
    if (commentTable) total += await count_rows(commentTable, userId, { today, status: 0 });
    return total;
}

/**
 * 分享数：以本人发布的帖子近似（分享动作无独立流水表）
 * @param {number} userId
 * @param {boolean} today
 * @returns {Promise<number>}
 */
async function share_count(userId, today) {
    if (!(await has_table('post'))) return 0;
    return count_rows('post', userId, { today, status: 0 });
}

/**
 * 某动作类型的完成度（今日 + 累计）
 * @param {number} userId
 * @param {number} actionType - 1 打卡/2 点评/3 喂食/4 收藏/5 互动/6 分享
 * @returns {Promise<{today: number, total: number}>}
 */
async function progress_of(userId, actionType) {
    if (actionType === 1) {
        if (!(await has_table('check_in'))) return { today: 0, total: 0 };
        const deleted = (await has_column('check_in', 'deleted_at')) ? ' AND deleted_at IS NULL' : '';
        const total = await query_one(`SELECT COUNT(*) c FROM check_in WHERE user_id = ?${deleted}`, [userId]);
        const todayCond = (await has_column('check_in', 'check_in_date'))
            ? ' AND check_in_date = CURDATE()'
            : ' AND created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY';
        const todayRow = await query_one(
            `SELECT COUNT(*) c FROM check_in WHERE user_id = ?${deleted}${todayCond}`,
            [userId]
        );
        return { today: Number(todayRow.c) || 0, total: Number(total.c) || 0 };
    }
    if (actionType === 2) {
        const today = await count_rows('review', userId, { today: true, status: 0 });
        const total = await count_rows('review', userId, { today: false, status: 0 });
        return { today, total };
    }
    if (actionType === 3) {
        const today = await count_rows('feed_record', userId, { today: true, dateCol: 'fed_at' });
        const total = await count_rows('feed_record', userId, { today: false });
        return { today, total };
    }
    if (actionType === 4) {
        const today = await count_rows('favorite', userId, { today: true });
        const total = await count_rows('favorite', userId, { today: false });
        return { today, total };
    }
    if (actionType === 5) {
        const today = await interaction_count(userId, true);
        const total = await interaction_count(userId, false);
        return { today, total };
    }
    if (actionType === 6) {
        const today = await share_count(userId, true);
        const total = await share_count(userId, false);
        return { today, total };
    }
    return { today: 0, total: 0 };
}

/**
 * 当前金币余额（无流水按 0）
 * @param {number} userId
 * @returns {Promise<number>}
 */
async function coin_balance(userId) {
    if (!(await has_table('coin_transaction'))) return 0;
    const row = await query_one(
        'SELECT balance_after FROM coin_transaction WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        [userId]
    );
    return row ? Number(row.balance_after) || 0 : 0;
}

/**
 * 任务列表（每日 / 成长分组，附带今日状态与累计进度）
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function list_tasks(userId) {
    if (!(await tables_ready())) {
        return {
            available: false, coin_balance: 0, daily: [], growth: [],
            daily_reward_total: 0, growth_targets: N.GROWTH_TARGETS,
        };
    }
    const tasks = await query(
        `SELECT id, task_type, name, action_type, reward_coins FROM ${TASK_TABLE}
         WHERE enabled = 1 ORDER BY id ASC`
    );
    const claims = await query(
        `SELECT task_id, status, (claim_date = CURDATE()) AS is_today FROM task_claim WHERE user_id = ?`,
        [userId]
    );
    const todayByTask = new Map();
    const claimedEver = new Set();
    for (const c of claims) {
        if (Number(c.is_today) === 1) todayByTask.set(Number(c.task_id), c);
        if (Number(c.status) === 2) claimedEver.add(Number(c.task_id));
    }

    const types = [...new Set(tasks.map((t) => Number(t.action_type)))];
    const progress = new Map();
    for (const type of types) progress.set(type, await progress_of(userId, type));

    const daily = [];
    const growth = [];
    for (const t of tasks) {
        const actionType = Number(t.action_type);
        const p = progress.get(actionType) || { today: 0, total: 0 };
        const row = todayByTask.get(Number(t.id));
        if (Number(t.task_type) === DAILY) {
            const done = p.today >= 1;
            const claimed = row ? Number(row.status) === 2 : false;
            daily.push({
                id: Number(t.id),
                name: t.name,
                action_type: actionType,
                reward_coins: Number(t.reward_coins) || 0,
                current: done ? 1 : 0,
                target: 1,
                status: claimed ? 2 : (done ? 1 : 0),
                claimed,
                claimable: done && !claimed,
            });
        } else {
            const target = N.GROWTH_TARGETS[actionType] || null;
            const current = Math.min(p.total, target || p.total);
            const claimed = claimedEver.has(Number(t.id));
            growth.push({
                id: Number(t.id),
                name: t.name,
                action_type: actionType,
                reward_coins: Number(t.reward_coins) || 0,
                current,
                target,
                status: claimed ? 2 : (target && p.total >= target ? 1 : 0),
                claimed,
                claimable: !!target && p.total >= target && !claimed,
            });
        }
    }

    const balance = await coin_balance(userId);
    return {
        available: true,
        coin_balance: balance,
        daily,
        growth,
        daily_reward_total: daily.reduce((s, t) => s + t.reward_coins, 0),
        growth_targets: N.GROWTH_TARGETS,
    };
}

/**
 * 领取任务奖励（单事务：task_claim + coin_transaction）
 * @param {number} userId
 * @param {number} taskId
 * @returns {Promise<Object>}
 */
async function claim_task(userId, taskId) {
    if (!(await tables_ready()) || !(await has_table('coin_transaction'))) {
        throw err.unavailable('成长任务暂未开放（数据表待建）');
    }
    const t = await query_one(
        `SELECT id, task_type, name, action_type, reward_coins FROM ${TASK_TABLE} WHERE id = ? AND enabled = 1`,
        [taskId]
    );
    if (!t) throw err.not_found('任务不存在或已下架');
    const actionType = Number(t.action_type);
    const p = await progress_of(userId, actionType);
    const isDaily = Number(t.task_type) === DAILY;
    const target = isDaily ? 1 : (N.GROWTH_TARGETS[actionType] || null);
    if (!target) throw err.invalid('该任务未配置成长目标');
    if (p.total < target) {
        throw err.invalid(`任务尚未完成（${Math.min(p.total, target)}/${target}）`);
    }

    if (isDaily) {
        const today = await query_one(
            'SELECT id, status FROM task_claim WHERE user_id = ? AND task_id = ? AND claim_date = CURDATE()',
            [userId, taskId]
        );
        if (today && Number(today.status) === 2) throw err.conflict('今日已领取该任务');
        if (p.today < 1) throw err.invalid('任务尚未完成');
    } else {
        const claimed = await query_one(
            'SELECT id FROM task_claim WHERE user_id = ? AND task_id = ? AND status = 2 LIMIT 1',
            [userId, taskId]
        );
        if (claimed) throw err.conflict('该成长任务已领取');
    }

    const conn = await get_conn();
    try {
        await conn.beginTransaction();
        // 余额串行：锁住该用户最后一条流水后再记新账
        const [rows] = await conn.query(
            'SELECT balance_after FROM coin_transaction WHERE user_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE',
            [userId]
        );
        const balance = rows.length ? Number(rows[0].balance_after) || 0 : 0;
        const reward = Number(t.reward_coins) || 0;
        const nextBalance = balance + reward;

        const [claimRows] = await conn.query(
            'SELECT id, status FROM task_claim WHERE user_id = ? AND task_id = ? AND claim_date = CURDATE()',
            [userId, taskId]
        );
        if (claimRows.length) {
            await conn.query(
                `UPDATE task_claim SET status = 2, completed_at = COALESCE(completed_at, NOW()), claimed_at = NOW()
                 WHERE id = ?`,
                [claimRows[0].id]
            );
        } else {
            await conn.query(
                `INSERT INTO task_claim (user_id, task_id, claim_date, status, completed_at, claimed_at)
                 VALUES (?, ?, CURDATE(), 2, NOW(), NOW())`,
                [userId, taskId]
            );
        }
        await conn.query(
            `INSERT INTO coin_transaction (user_id, change_type, amount, biz_type, biz_id, balance_after)
             VALUES (?, 1, ?, 1, ?, ?)`,
            [userId, reward, taskId, nextBalance]
        );
        await conn.commit();
        return { task_id: taskId, reward_coins: reward, coin_balance: nextBalance, claimed: true };
    } catch (e) {
        await conn.rollback();
        // 并发重复领取：唯一键拦截后统一按冲突返回
        if (e.code === 'ER_DUP_ENTRY') throw err.conflict('今日已领取该任务');
        throw e;
    } finally {
        conn.release();
    }
}

module.exports = { list_tasks, claim_task, progress_of, coin_balance };
