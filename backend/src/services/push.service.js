/**
 * 推送算法服务（规格书 §7 通知与触达 · 个性化推送）
 * 全部基于平台真实数据，规则可解释：
 *  - 每日口味灵感（daily）：口味画像（收藏品类 + 评价品类 Top2）× 高分未尝试菜品 → 匹配排序取 Top3
 *  - 每周干饭周报（weekly）：上周评价数 / 获赞 / 新增收藏 / 覆盖档口数，有活动才推
 *  - 去重：同用户同 kind 7 天内不重复推送
 *  - 调度：每 30 分钟检查，北京时间 8 点窗口触发；服务重启当天自动补跑（自愈）
 */
const { query } = require('../db/pool');

/** 每类推送的最小间隔（毫秒）：7 天 */
const DEDUP_MS = 7 * 86400000;

/** 调度内存状态（重启即视为未跑，启动补跑自愈） */
const state = { last_daily: null, last_weekly: null };

/**
 * 本地日期键 YYYY-MM-DD（服务器时区即北京时间）
 * @param {Date} d
 */
function date_key(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * 某日期所在 ISO 周标签（周一起始）YYYY-Wnn
 * @param {Date} d
 */
function week_key(d) {
    const t = new Date(d);
    t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); // 回到本周一
    const onejan = new Date(t.getFullYear(), 0, 1);
    const w = Math.ceil(((t - onejan) / 86400000 + onejan.getDay() + 1) / 7);
    return `${t.getFullYear()}-W${String(w).padStart(2, '0')}`;
}

/**
 * 7 天内是否已推送过同类内容（同用户 + kind 去重）
 * @param {number} userId
 * @param {string} refType digest/report
 */
async function pushed_recently(userId, refType) {
    const rows = await query(
        `SELECT COUNT(*) AS n FROM notification
         WHERE user_id = ? AND type = 'push' AND ref_type = ? AND created_at > NOW() - INTERVAL 7 DAY`,
        [userId, refType]
    );
    return Number(rows[0]?.n || 0) > 0;
}

/**
 * 用户口味画像：收藏品类 + 已评价档口品类，各取 Top2 合并去重
 * @param {number} userId
 * @returns {Promise<string[]>} 品类关键词列表（如 ['麻辣烫','奶茶']）
 */
async function taste_profile(userId) {
    const rows = await query(
        `(SELECT s.category AS c, COUNT(*) AS w
          FROM favorite f JOIN station s ON s.id = f.subject_id
          WHERE f.user_id = ? AND f.subject_type = 1
          GROUP BY s.category)
         UNION ALL
         (SELECT s.category AS c, COUNT(*) AS w
          FROM review r JOIN station s ON s.id = r.subject_id
          WHERE r.user_id = ? AND r.subject_type = 1 AND r.status = 0
          GROUP BY s.category)
         ORDER BY w DESC LIMIT 4`,
        [userId, userId]
    );
    const seen = [];
    for (const r of rows) {
        // 品类字段可能为「麻辣烫/冒菜」复合串，取首段为主关键词
        const k = String(r.c || '').split('/')[0].trim();
        if (k && !seen.includes(k)) seen.push(k);
        if (seen.length >= 2) break;
    }
    return seen;
}

/**
 * 按口味匹配高分未尝试菜品（未收藏 + 未评价），评分与热度加权排序取 Top3
 * @param {number} userId
 * @param {string[]} tastes 口味关键词
 */
async function match_dishes(userId, tastes) {
    const rows = await query(
        `SELECT d.id, d.name, d.price, s.name AS station_name, c.name AS canteen_name,
                sm.rating_avg, sm.review_count
         FROM dish d
         JOIN station s ON s.id = d.station_id
         JOIN canteen c ON c.id = s.canteen_id
         JOIN review_summary sm ON sm.subject_type = 0 AND sm.subject_id = d.id
         WHERE d.status = 0 AND c.enabled = 1 AND sm.review_count > 0 AND sm.rating_avg >= 4.3
           AND d.id NOT IN (SELECT subject_id FROM favorite WHERE user_id = ? AND subject_type = 0)
           AND d.id NOT IN (SELECT subject_id FROM review WHERE user_id = ? AND subject_type = 0 AND status = 0)
         ORDER BY (s.category LIKE ?) DESC, sm.rating_avg DESC, sm.review_count DESC
         LIMIT 3`,
        [userId, userId, tastes.length ? `%${tastes[0]}%` : '%']
    );
    return rows;
}

/**
 * 每日口味灵感推送：对近 30 天活跃用户逐个生成（跳过 7 天内已推 / 无画像无候选的用户）
 * @returns {Promise<{users: number, pushed: number}>}
 */
async function push_daily_digest() {
    const users = await query(
        `SELECT id FROM \`user\`
         WHERE status = 0 AND last_login_at > NOW() - INTERVAL 30 DAY`
    );
    let pushed = 0;
    for (const u of users) {
        if (await pushed_recently(u.id, 'digest')) continue;
        const tastes = await taste_profile(u.id);
        const dishes = await match_dishes(u.id, tastes);
        if (!dishes.length) continue;
        const head = tastes.length ? `按你常吃的「${tastes.join('、')}」` : '按全站口碑';
        const lines = dishes.map((d, i) => `${i + 1}. ${d.name}（${d.station_name} · ${d.canteen_name}）${d.price} 元，评分 ${Number(d.rating_avg).toFixed(1)}`);
        await query(
            'INSERT INTO notification (user_id, type, title, content, ref_type, ref_id) VALUES (?, ?, ?, ?, ?, ?)',
            [u.id, 'push', '今日干饭灵感', `${head}，这几道高分菜你还没试过：\n${lines.join('\n')}`, 'digest', dishes[0].id]
        );
        pushed += 1;
    }
    state.last_daily = date_key(new Date());
    return { users: users.length, pushed };
}

/**
 * 每周干饭周报推送：上周（周一起）有评价 / 收藏活动的用户才推
 * @returns {Promise<{users: number, pushed: number}>}
 */
async function push_weekly_report() {
    const users = await query(
        `SELECT u.id,
                (SELECT COUNT(*) FROM review r WHERE r.user_id = u.id AND r.status = 0
                    AND r.created_at >= CURDATE() - INTERVAL WEEKDAY(CURDATE()) + 7 DAY
                    AND r.created_at < CURDATE() - INTERVAL WEEKDAY(CURDATE()) DAY) AS reviews,
                (SELECT COALESCE(SUM(r.up_count), 0) FROM review r WHERE r.user_id = u.id AND r.status = 0
                    AND r.created_at >= CURDATE() - INTERVAL WEEKDAY(CURDATE()) + 7 DAY
                    AND r.created_at < CURDATE() - INTERVAL WEEKDAY(CURDATE()) DAY) AS ups,
                (SELECT COUNT(*) FROM favorite f WHERE f.user_id = u.id
                    AND f.created_at >= CURDATE() - INTERVAL WEEKDAY(CURDATE()) + 7 DAY
                    AND f.created_at < CURDATE() - INTERVAL WEEKDAY(CURDATE()) DAY) AS favs
         FROM \`user\` u
         WHERE u.status = 0
           AND u.last_login_at > NOW() - INTERVAL 30 DAY`
    );
    let pushed = 0;
    for (const u of users) {
        if (!(Number(u.reviews) || Number(u.ups) || Number(u.favs))) continue;
        if (await pushed_recently(u.id, 'report')) continue;
        const parts = [];
        if (Number(u.reviews)) parts.push(`写了 ${u.reviews} 条评价`);
        if (Number(u.ups)) parts.push(`收获 ${u.ups} 个赞`);
        if (Number(u.favs)) parts.push(`新收藏 ${u.favs} 道菜`);
        await query(
            'INSERT INTO notification (user_id, type, title, content, ref_type) VALUES (?, ?, ?, ?, ?)',
            [u.id, 'push', '上周干饭周报', `上周你${parts.join('、')}，继续保持，期末一起解锁「干饭王」头衔！`, 'report']
        );
        pushed += 1;
    }
    state.last_weekly = week_key(new Date());
    return { users: users.length, pushed };
}

/**
 * 手动触发（管理端 / 测试）
 * @param {'daily'|'weekly'|'both'} kind
 */
async function run_once(kind = 'both') {
    const out = {};
    if (kind === 'daily' || kind === 'both') out.daily = await push_daily_digest();
    if (kind === 'weekly' || kind === 'both') out.weekly = await push_weekly_report();
    return out;
}

/**
 * 调度器：每 30 分钟检查，北京时间 8:00-8:30 窗口触发；
 * 周一再补上周周报；重启后当天窗口已过则立即补跑（自愈）
 */
function start_push_scheduler() {
    const TICK = 30 * 60 * 1000;
    const check = async () => {
        try {
            const now = new Date();
            const today = date_key(now);
            const wk = week_key(now);
            const morning = now.getHours() >= 8;
            // 每日推送：8 点后当天未跑 → 跑（重启后内存为空自动补）
            if (morning && state.last_daily !== today) await push_daily_digest();
            // 每周周报：周一 8 点后本周标签未跑 → 跑
            if (now.getDay() === 1 && morning && state.last_weekly !== wk) await push_weekly_report();
        } catch (e) {
            // 调度失败不影响主服务，仅留痕
            console.error('[push-scheduler]', e.message);
        }
    };
    // 启动即检查一次（覆盖「重启时窗口已过」的场景），之后定时轮询
    setTimeout(check, 15 * 1000);
    setInterval(check, TICK);
}

module.exports = { push_daily_digest, push_weekly_report, run_once, start_push_scheduler };
