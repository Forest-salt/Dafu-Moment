/** 3.0手账：一个打卡对应至多一篇；不把画布JSON塞入文字列。 */
const { query,query_one,get_conn } = require('../db/pool');
const { err } = require('../utils/api-error');
const {posts_for_journal}=require('./cascade3');
function validate(body) {
    for (const key of ['layout','bg','bg_src','cover','title','date']) {
        if (Object.hasOwn(body,key)) throw err.invalid(`数据库3.0手账不接受旧字段${key}`);
    }
    if (body.template !== undefined && body.template !== null) throw err.invalid('模板取值QC-20尚未确认，请留空');
    const note = String(body.note || '');
    if (Buffer.byteLength(note) > 60000) throw err.invalid('手账文字过长');
    if (body.isPrivate !== undefined && typeof body.isPrivate !== 'boolean') throw err.invalid('isPrivate应为布尔值');
    const images = body.imageKeys || [];
    if (!Array.isArray(images) || images.length>9 || new Set(images).size !== images.length || images.some(k=> typeof k!=='string' || !k || k.length>255 || /^https?:/i.test(k))) throw err.invalid('图片应为最多9个不重复的上传对象键');
    return { note, images };
}
async function images(conn,id,user,keys) {
    await conn.query(`UPDATE upload_asset a JOIN journal_image i ON i.object_key=a.object_key
      SET a.ref_count=GREATEST(0,a.ref_count-1) WHERE i.journal_id=? AND i.deleted_at IS NULL`, [id]);
    await conn.query('UPDATE journal_image SET deleted_at=NOW() WHERE journal_id=? AND deleted_at IS NULL',[id]);
    for (let i=0;i<keys.length;i++) {
        const [assets] = await conn.query('SELECT id FROM upload_asset WHERE object_key=? AND uploader_id=? FOR UPDATE',[keys[i],user]);
        if (!assets.length) throw err.forbidden('图片不属于当前用户或未登记上传');
        await conn.query('INSERT INTO journal_image(journal_id,object_key,sort) VALUES(?,?,?) ON DUPLICATE KEY UPDATE sort=VALUES(sort),deleted_at=NULL',[id,keys[i],i]);
        await conn.query('UPDATE upload_asset SET ref_count=ref_count+1 WHERE id=?',[assets[0].id]);
    }
}
async function save(user,id,body) {
    const v=validate(body), conn=await get_conn();
    try {
        await conn.beginTransaction();
        let row;
        if (id) {
            const [rs]=await conn.query('SELECT j.*,c.user_id FROM journal j JOIN check_in c ON c.id=j.check_in_id WHERE j.id=? AND j.deleted_at IS NULL AND c.deleted_at IS NULL FOR UPDATE',[id]);
            row=rs[0];
            if (!row || Number(row.user_id)!==Number(user)) throw err.not_found('手账不存在');
            if (body.checkInId && Number(body.checkInId)!==Number(row.check_in_id)) throw err.invalid('手账不可更换关联打卡');
        } else {
            const [rs]=await conn.query('SELECT id,user_id FROM check_in WHERE id=? AND deleted_at IS NULL FOR UPDATE',[Number(body.checkInId)||0]);
            if (!rs.length || Number(rs[0].user_id)!==Number(user)) throw err.not_found('打卡不存在');
            const [created]=await conn.query('INSERT INTO journal(check_in_id,note,is_private) VALUES(?,?,?)',[rs[0].id,v.note,body.isPrivate===false?0:1]);
            id=created.insertId;
        }
        if (row) await conn.query('UPDATE journal SET note=?,is_private=? WHERE id=?',[v.note,body.isPrivate===undefined?row.is_private:Number(body.isPrivate),id]);
        await images(conn,id,user,v.images);
        await conn.commit();
        return { id };
    } catch(e) { await conn.rollback(); throw e; } finally { conn.release(); }
}
async function get(user,id) {
    const r=await query_one(`SELECT j.*,c.user_id,c.location_id,DATE_FORMAT(c.check_in_date,'%Y-%m-%d') check_in_date FROM journal j JOIN check_in c ON c.id=j.check_in_id
      WHERE j.id=? AND j.deleted_at IS NULL AND c.deleted_at IS NULL AND (c.user_id=? OR j.is_private=0)`,[id,user||0]);
    if (!r) throw err.not_found('手账不存在');
    r.images=await query('SELECT object_key,sort FROM journal_image WHERE journal_id=? AND deleted_at IS NULL ORDER BY sort,id',[id]);
    return r;
}
async function list(user) { return query(`SELECT j.id,j.check_in_id,j.note,j.is_private,c.location_id,DATE_FORMAT(c.check_in_date,'%Y-%m-%d') check_in_date
    FROM journal j JOIN check_in c ON c.id=j.check_in_id WHERE c.user_id=? AND j.deleted_at IS NULL AND c.deleted_at IS NULL ORDER BY j.id DESC LIMIT 100`,[user]); }
async function remove(user,id) {
    const conn=await get_conn();
    try {
        await conn.beginTransaction();
        const [rs]=await conn.query('SELECT j.id FROM journal j JOIN check_in c ON c.id=j.check_in_id WHERE j.id=? AND c.user_id=? AND j.deleted_at IS NULL FOR UPDATE',[id,user]);
        if (!rs.length) throw err.not_found('手账不存在');
        await images(conn,id,user,[]);
        await conn.query('UPDATE journal SET deleted_at=NOW() WHERE id=?',[id]);
        await posts_for_journal(conn,id);
        await conn.commit();
        return { deleted:true };
    } catch(e) { await conn.rollback(); throw e; } finally { conn.release(); }
}
module.exports={create:(user,body)=>save(user,null,body),update:save,get,list,remove};
