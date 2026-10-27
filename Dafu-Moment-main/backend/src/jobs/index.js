/**
 * 定时任务（node-cron，v2.0）：
 * - 启动时：聚合全量重算兜底（防上次停机后摘要漂移）
 * - 每日 05:00：聚合全量重算兜底
 * - 每小时：禁言到期恢复
 */
const cron = require('node-cron');
const aggregation = require('../services/aggregation.service');
const { query } = require('../db/pool');
const { of } = require('../utils/logger');

const log = of('[jobs]');

/**
 * 每日兜底任务：聚合摘要全量重算
 */
async function daily_job() {
    log.info('[jobs] ===== 每日任务开始 =====');
    await aggregation.recalc_all();
    log.info('[jobs] ===== 每日任务完成 =====');
}

/**
 * 启动定时任务 + 启动兜底重算
 */
async function start_jobs() {
    // 启动兜底：聚合全量重算（与 seed、运维维护同款口径）
    try {
        await aggregation.recalc_all();
    } catch (e) {
        console.warn('[jobs] 启动兜底重算失败（稍后由定时任务兜底）:', e.message);
    }

    cron.schedule('0 5 * * *', () => {
        daily_job().catch((e) => console.warn('[jobs] 每日任务失败:', e.message));
    });
    cron.schedule('0 * * * *', async () => {
        // 禁言到期自动恢复（账号状态机 MUTED→ACTIVE）
        try {
            await query("UPDATE `user` SET status = 0, muted_until = NULL WHERE status = 1 AND muted_until IS NOT NULL AND muted_until < NOW()");
        } catch (e) {
            console.warn('[jobs] 禁言恢复失败:', e.message);
        }
    });
    log.info('[jobs] 定时任务已启动（recalc/05:00, mute-sweep/hourly）');
}

module.exports = { start_jobs, daily_job };
