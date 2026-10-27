/** 打卡按数据库3.0写入主表和明细表；唯一键承担幂等，错误不回退到localStorage。 */
const { get_conn, query, query_one } = require('../db/pool');
const { err } = require('../utils/api-error');
const {posts_for_journal}=require('./cascade3');

function date_key(value) {
    const s = String(value || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw err.invalid('就餐日期格式应为YYYY-MM-DD');
    const d = new Date(`${s}T00:00:00Z`);
    if (d.toISOString().slice(0, 10) !== s) throw err.invalid('就餐日期无效');
    return s;
}

async function create(user_id, input) {
    let location_id = Number(input.locationId || input.canteenId);
    const day = date_key(input.checkInDate || input.date);
    if (input.dishIds !== undefined && !Array.isArray(input.dishIds)) throw err.invalid('菜品列表应为数组');
    const conn = await get_conn();
    try {
        await conn.beginTransaction();
        await conn.query('SELECT id FROM user WHERE id=? FOR UPDATE',[user_id]);
        if (input.stationId) {
            const [rows] = await conn.query('SELECT location_id FROM station WHERE id=? AND deleted_at IS NULL AND status=1', [Number(input.stationId)]);
            if (!rows.length) throw err.not_found('档口不存在');
            if (location_id && location_id !== Number(rows[0].location_id)) throw err.invalid('档口与点位不匹配');
            location_id = Number(rows[0].location_id);
        }
        if (!Number.isSafeInteger(location_id) || location_id <= 0) throw err.invalid('请指定点位或档口');
        const [locations] = await conn.query('SELECT id FROM location WHERE id=? AND deleted_at IS NULL', [location_id]);
        if (!locations.length) throw err.not_found('点位不存在');
        const visibility = input.visibility === undefined ? 1 : Number(input.visibility);
        if (![1, 2, 3].includes(visibility)) throw err.invalid('visibility按3.0取1仅记录、2私有、3公开');
        const note = String(input.note || '');
        if ([...note].length > 255) throw err.invalid('随笔不能超过255字');
        const [r] = await conn.query('INSERT INTO check_in(user_id,location_id,check_in_date,visibility,note) VALUES(?,?,?,?,?)', [user_id, location_id, day, visibility, note || null]);
        const id = r.insertId;
        const dishes = [...new Set((input.dishIds || []).map(Number))];
        for (const dish_id of dishes) {
            const [found] = await conn.query('SELECT d.id FROM dish d JOIN station s ON s.id=d.station_id WHERE d.id=? AND s.location_id=? AND d.deleted_at IS NULL AND d.status=1 AND s.deleted_at IS NULL AND s.status=1', [dish_id, location_id]);
            if (!found.length) throw err.invalid('菜品不属于该点位或不可用');
            await conn.query('INSERT INTO check_in_dish(check_in_id,dish_id,quantity) VALUES(?,?,1)', [id, dish_id]);
        }
        const photos = input.photos || input.imageKeys || [];
        if (!Array.isArray(photos) || photos.length > 9 || new Set(photos).size!==photos.length || photos.some(k=>typeof k!=='string')) throw err.invalid('照片列表应为最多9个不重复对象键');
        for (let i = 0; i < photos.length; i++) {
            const key = String(photos[i]);
            if (!key || key.length > 255 || /^https?:/i.test(key)) throw err.invalid('照片应使用已上传的MinIO对象键');
            const [assets] = await conn.query('SELECT id FROM upload_asset WHERE object_key=? AND uploader_id=? FOR UPDATE', [key, user_id]);
            if (!assets.length) throw err.forbidden('照片不属于当前用户或未登记上传');
            await conn.query('INSERT INTO check_in_image(check_in_id,object_key,sort) VALUES(?,?,?)', [id, key, i]);
            await conn.query('UPDATE upload_asset SET ref_count=ref_count+1 WHERE id=?', [assets[0].id]);
        }
        await conn.query('INSERT INTO footprint(user_id,location_id,first_visit_at) VALUES(?,?,NOW()) ON DUPLICATE KEY UPDATE location_id=VALUES(location_id)', [user_id, location_id]);
        await refresh_achievements(conn, user_id);
        await conn.commit();
        return { checkinId: id, locationId: location_id, checkInDate: day };
    } catch (e) {
        await conn.rollback();
        if (e.code === 'ER_DUP_ENTRY') {
            const old = await query_one('SELECT id FROM check_in WHERE user_id=? AND location_id=? AND check_in_date=?', [user_id, location_id, day]);
            const conflict = err.conflict('同一用户在该点位当日已有打卡');
            conflict.data = { checkinId: old ? old.id : null };
            throw conflict;
        }
        throw e;
    } finally { conn.release(); }
}

async function refresh_achievements(conn, user_id) {
    // Progress follows actual normalized rows; reward issuance remains a separate business operation.
    const [rows] = await conn.query(`SELECT
      (SELECT COUNT(*) FROM check_in WHERE user_id=? AND deleted_at IS NULL) checkins,
      (SELECT COUNT(DISTINCT location_id) FROM check_in WHERE user_id=? AND deleted_at IS NULL) places,
      (SELECT COUNT(*) FROM review WHERE user_id=? AND status=0 AND deleted_at IS NULL) reviews,
      (SELECT COUNT(*) FROM review_like l JOIN review r ON l.biz_type=1 AND l.biz_id=r.id WHERE r.user_id=? AND l.deleted_at IS NULL AND r.status=0 AND r.deleted_at IS NULL) likes`, [user_id,user_id,user_id,user_id]);
    const p = rows[0];
    const [defs] = await conn.query('SELECT id,metric_type,target_value FROM achievement');
    for (const d of defs) {
        const value = Number([0,p.checkins,p.places,p.reviews,p.likes][Number(d.metric_type)] || 0);
        await conn.query('INSERT INTO user_achievement(user_id,achievement_id,progress,unlocked) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE progress=VALUES(progress),unlocked=VALUES(unlocked)', [user_id,d.id,value,Number(value >= d.target_value)]);
    }
}

async function list(user_id) {
    return query(`SELECT c.id,c.location_id,c.check_in_date,c.visibility,c.note,c.created_at,l.name location_name
       FROM check_in c JOIN location l ON l.id=c.location_id
       WHERE c.user_id=? AND c.deleted_at IS NULL ORDER BY c.check_in_date DESC,c.id DESC`, [user_id]);
}
async function calendar(user_id, month) {
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw err.invalid('月份格式应为YYYY-MM');
    return query(`SELECT DATE_FORMAT(check_in_date,'%Y-%m-%d') date,COUNT(*) count FROM check_in
      WHERE user_id=? AND deleted_at IS NULL ${month ? "AND DATE_FORMAT(check_in_date,'%Y-%m')=?" : ''}
      GROUP BY check_in_date ORDER BY check_in_date`, month ? [user_id,month] : [user_id]);
}
async function stats(user_id) {
    const r = await query_one('SELECT COUNT(*) total,COUNT(DISTINCT location_id) places FROM check_in WHERE user_id=? AND deleted_at IS NULL', [user_id]);
    const days = await query('SELECT DISTINCT DATE_FORMAT(check_in_date,\'%Y-%m-%d\') day FROM check_in WHERE user_id=? AND deleted_at IS NULL ORDER BY day DESC', [user_id]);
    const today = date_key();
    const yesterday = new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10);
    let streak = 0;
    if (days.length && [today,yesterday].includes(days[0].day)) {
        let previous = Date.parse(days[0].day+'T00:00:00Z');
        for (const d of days) { const current = Date.parse(d.day+'T00:00:00Z'); if (current !== previous) break; streak++; previous -= 86400000; }
    }
    return { total: Number(r.total), places: Number(r.places), streak };
}
async function remove(user_id, id) {
    const conn = await get_conn();
    try {
        await conn.beginTransaction();
        await conn.query('SELECT id FROM user WHERE id=? FOR UPDATE',[user_id]);
        const [rows] = await conn.query('SELECT id,user_id,location_id FROM check_in WHERE id=? AND deleted_at IS NULL FOR UPDATE', [id]);
        if (!rows.length) throw err.not_found('打卡不存在');
        if (Number(rows[0].user_id) !== Number(user_id)) throw err.forbidden('不能删除他人的打卡');
        await conn.query('UPDATE check_in SET deleted_at=NOW() WHERE id=?', [id]);
        await conn.query(`UPDATE upload_asset a JOIN check_in_image i ON i.object_key=a.object_key
          SET a.ref_count=GREATEST(0,a.ref_count-1) WHERE i.check_in_id=? AND i.deleted_at IS NULL`, [id]);
        await conn.query('UPDATE check_in_image SET deleted_at=NOW() WHERE check_in_id=?', [id]);
        const [journals]=await conn.query('SELECT id FROM journal WHERE check_in_id=? AND deleted_at IS NULL FOR UPDATE',[id]);
        for(const j of journals)await posts_for_journal(conn,j.id);
        await conn.query(`UPDATE upload_asset a JOIN journal_image i ON i.object_key=a.object_key JOIN journal j ON j.id=i.journal_id
          SET a.ref_count=GREATEST(0,a.ref_count-1) WHERE j.check_in_id=? AND i.deleted_at IS NULL AND j.deleted_at IS NULL`, [id]);
        await conn.query('UPDATE journal_image i JOIN journal j ON j.id=i.journal_id SET i.deleted_at=NOW() WHERE j.check_in_id=? AND i.deleted_at IS NULL', [id]);
        await conn.query('UPDATE journal SET deleted_at=NOW() WHERE check_in_id=? AND deleted_at IS NULL', [id]);
        // Footprint is historical first visit in3.0; keep it, and recompute active progress.
        await refresh_achievements(conn,user_id);
        await conn.commit();
    } catch (e) { await conn.rollback(); throw e; }
    finally { conn.release(); }
    return { deleted: true };
}
module.exports = { create,list,calendar,stats,remove,refresh_achievements,date_key };
