/** 3.0评价：评分/图片分表，汇总同事务重算，仅统计发布且未删除评价。 */
const { query,get_conn }=require('../db/pool');
const { err }=require('../utils/api-error');
const { refresh_achievements }=require('./checkin.service');
const {replies}=require('./cascade3');
async function dimensions(mode) {
    if (![1,2,3].includes(Number(mode))) throw err.invalid('就餐方式应为1堂食、2打包或3外送');
    return query(`SELECT d.* FROM review_dimension d JOIN review_dimension_meal_mode m ON m.dimension_id=d.id
      WHERE m.meal_mode=? ORDER BY d.sort,d.id`,[mode]);
}
async function recalc(conn,row) {
    for(const [type,column] of [[1,'location_id'],[2,'station_id'],[3,'dish_id']]) {
        if (!row[column]) continue;
        await conn.query('DELETE FROM review_summary WHERE biz_type=? AND biz_id=?',[type,row[column]]);
        await conn.query(`INSERT INTO review_summary(biz_type,biz_id,dimension_id,avg_score,review_count)
          SELECT ?,?,d.dimension_id,ROUND(AVG(d.score),2),COUNT(*) FROM rating_detail d JOIN review r ON r.id=d.review_id
          WHERE r.${column}=? AND r.status=0 AND r.deleted_at IS NULL GROUP BY d.dimension_id`,[type,row[column],row[column]]);
    }
}
async function lock_target(conn,station,dish) {
    const [rs]=await conn.query('SELECT s.id,s.location_id FROM station s JOIN location l ON l.id=s.location_id WHERE s.id=? AND s.deleted_at IS NULL AND l.deleted_at IS NULL AND s.status=1 FOR UPDATE',[station]);
    if (!rs.length) throw err.not_found('档口不存在或已停业');
    // Location lock serializes aggregation across different stations in the same point.
    await conn.query('SELECT id FROM location WHERE id=? FOR UPDATE',[rs[0].location_id]);
    if(dish) {
        const [ds]=await conn.query('SELECT id FROM dish WHERE id=? AND station_id=? AND status=1 AND deleted_at IS NULL',[dish,station]);
        if(!ds.length) throw err.invalid('菜品不属于该档口或未上架');
    }
    return {location_id:rs[0].location_id,station_id:Number(station),dish_id:dish?Number(dish):null};
}
async function save(user,id,b) {
    const mode=Number(b.mealMode||1),dims=await dimensions(mode),scores=b.scores;
    if (!scores||Array.isArray(scores)||typeof scores!=='object') throw err.invalid('scores应为维度编码到分值的对象');
    if (Object.keys(scores).some(k=>!dims.some(d=>d.code===k)) || dims.some(d=>d.is_required && scores[d.code]===undefined)) throw err.invalid('评分缺少必评维度或包含不适用的维度');
    for(const n of Object.values(scores)) if(typeof n!=='number'||!Number.isFinite(n)||n<1||n>5||Math.abs(n*10-Math.round(n*10))>1e-8) throw err.invalid('分值为1至5，最多1位小数');
    let content=String(b.content||'').trim();
    const keys=b.imageKeys||[];
    if (!Array.isArray(keys)||keys.length>9||new Set(keys).size!==keys.length||keys.some(k=>typeof k!=='string'||!k||k.length>255||/^https?:/i.test(k))) throw err.invalid('图片对象键不合法');
    if ((!content&&!keys.length)||[...content].length>2000) throw err.invalid('文字与图片不能同时为空，文字最多2000字');
    const conn=await get_conn();
    try {
        await conn.beginTransaction();
        await conn.query('SELECT id FROM user WHERE id=? FOR UPDATE',[user]);
        const target=await lock_target(conn,Number(b.stationId),b.dishId);
        if (b.locationId && Number(b.locationId)!==Number(target.location_id)) throw err.invalid('点位与档口不一致');
        const [words]=await conn.query('SELECT word,severity,action FROM banned_word WHERE status=1');
        let status=0;
        for(const w of words) if(content.toLowerCase().includes(w.word.toLowerCase())) {
            if(w.severity===2) status=2;
            else if(w.action===2) throw err.invalid('文字含禁止发布的内容');
            else content=content.replace(new RegExp(w.word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'***');
        }
        let old;
        if(id) {
            const [rs]=await conn.query('SELECT * FROM review WHERE id=? AND user_id=? AND deleted_at IS NULL FOR UPDATE',[id,user]);
            if(!rs.length) throw err.not_found('评价不存在');
            old=rs[0];
            if(Number(old.station_id)!==target.station_id || Number(old.dish_id||0)!==Number(target.dish_id||0)) throw err.invalid('编辑评价不可更换评价对象');
            await conn.query('UPDATE review SET content=?,meal_mode=?,status=?,offline_reason=NULL,offline_by=NULL,offline_at=NULL WHERE id=?',[content||null,mode,status,id]);
            await conn.query('DELETE FROM rating_detail WHERE review_id=?',[id]);
            await conn.query(`UPDATE upload_asset a JOIN review_image i ON i.object_key=a.object_key SET a.ref_count=GREATEST(0,a.ref_count-1) WHERE i.review_id=?`,[id]);
            await conn.query('DELETE FROM review_image WHERE review_id=?',[id]);
        } else {
            const [r]=await conn.query('INSERT INTO review(user_id,location_id,station_id,dish_id,content,meal_mode,status) VALUES(?,?,?,?,?,?,?)',[user,target.location_id,target.station_id,target.dish_id,content||null,mode,status]);id=r.insertId;
        }
        for(const d of dims) if(scores[d.code]!==undefined) await conn.query('INSERT INTO rating_detail(review_id,dimension_id,score) VALUES(?,?,?)',[id,d.id,scores[d.code]]);
        for(let i=0;i<keys.length;i++) {
            const [assets]=await conn.query('SELECT id FROM upload_asset WHERE object_key=? AND uploader_id=? FOR UPDATE',[keys[i],user]);
            if(!assets.length) throw err.forbidden('图片不属于当前用户或未登记上传');
            await conn.query('INSERT INTO review_image(review_id,object_key,sort) VALUES(?,?,?)',[id,keys[i],i]);
            await conn.query('UPDATE upload_asset SET ref_count=ref_count+1 WHERE id=?',[assets[0].id]);
        }
        await recalc(conn,target);await refresh_achievements(conn,user);await conn.commit();
        return {id,status};
    } catch(e) {await conn.rollback();throw e;} finally {conn.release();}
}
async function list(filters={}) {
    const where=['r.deleted_at IS NULL','r.status=0'],params=[];
    for(const [key,column] of [['locationId','location_id'],['stationId','station_id'],['dishId','dish_id'],['userId','user_id']]) if(filters[key]){where.push(`r.${column}=?`);params.push(Number(filters[key]));}
    const rows=await query(`SELECT r.id,r.user_id,r.location_id,r.station_id,r.dish_id,r.content,r.meal_mode,r.created_at,u.nickname
      FROM review r JOIN user u ON u.id=r.user_id WHERE ${where.join(' AND ')} ORDER BY r.id DESC LIMIT 100`,params);
    for(const r of rows) {
        r.scores=await query('SELECT d.code,s.score FROM rating_detail s JOIN review_dimension d ON d.id=s.dimension_id WHERE s.review_id=?',[r.id]);
        r.images=await query('SELECT object_key,sort FROM review_image WHERE review_id=? ORDER BY sort,id',[r.id]);
    }return rows;
}
async function remove(user,id) {
    const conn=await get_conn();
    try {
        await conn.beginTransaction();
        await conn.query('SELECT id FROM user WHERE id=? FOR UPDATE',[user]);
        const [rs]=await conn.query('SELECT * FROM review WHERE id=? AND user_id=? AND deleted_at IS NULL',[id,user]);
        if(!rs.length) throw err.not_found('评价不存在');
        await conn.query('SELECT id FROM location WHERE id=? FOR UPDATE',[rs[0].location_id]);
        const [current]=await conn.query('SELECT id FROM review WHERE id=? AND deleted_at IS NULL FOR UPDATE',[id]);
        if(!current.length)throw err.not_found('评价不存在');
        await conn.query('UPDATE review SET deleted_at=NOW() WHERE id=? AND deleted_at IS NULL',[id]);
        await conn.query('UPDATE review_like SET deleted_at=NOW() WHERE biz_type=1 AND biz_id=? AND deleted_at IS NULL',[id]);
        await replies(conn,2,id);
        await conn.query(`UPDATE upload_asset a JOIN review_image i ON i.object_key=a.object_key SET a.ref_count=GREATEST(0,a.ref_count-1) WHERE i.review_id=?`,[id]);
        await recalc(conn,rs[0]);await refresh_achievements(conn,user);await conn.commit();return {deleted:true};
    } catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
module.exports={dimensions,create:(u,b)=>save(u,null,b),update:save,list,remove,recalc};
