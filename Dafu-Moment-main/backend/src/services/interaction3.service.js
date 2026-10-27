const {query,get_conn}=require('../db/pool');
const {err}=require('../utils/api-error');
const {refresh_achievements}=require('./checkin.service');
async function favorite(user,b,remove=false){
    const type=Number(b.bizType),id=Number(b.bizId),table={1:'location',2:'station',3:'dish',4:'post'}[type];
    if(!table||!Number.isSafeInteger(id)||id<=0)throw err.invalid('收藏目标类型或ID不合法');
    const c=await get_conn();
    try{
        await c.beginTransaction();await c.query('SELECT id FROM user WHERE id=? FOR UPDATE',[user]);
        if(remove){await c.query('UPDATE favorite SET deleted_at=NOW() WHERE user_id=? AND biz_type=? AND biz_id=? AND deleted_at IS NULL',[user,type,id]);}
        else{
            const status=type===3?'AND status=1':type===4?'AND status=0':'';
            const [target]=await c.query(`SELECT id FROM ${table} WHERE id=? AND deleted_at IS NULL ${status} FOR UPDATE`,[id]);
            if(!target.length)throw err.not_found('收藏目标不存在');
            if(b.groupId){const [g]=await c.query('SELECT id FROM favorite_group WHERE id=? AND user_id=? AND deleted_at IS NULL',[b.groupId,user]);if(!g.length)throw err.forbidden('收藏分组不属于当前用户');}
            await c.query('INSERT INTO favorite(user_id,biz_type,biz_id,group_id) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE group_id=VALUES(group_id)',[user,type,id,b.groupId||null]);
        }
        await c.commit();return {favorited:!remove};
    }catch(e){await c.rollback();throw e;}finally{c.release();}
}
async function like(user,id,remove=false){
    const c=await get_conn();
    try{
        await c.beginTransaction();
        const [rs]=await c.query('SELECT user_id FROM review WHERE id=? AND status=0 AND deleted_at IS NULL',[id]);
        if(!rs.length)throw err.not_found('评价不存在');
        // Deterministic user lock order also covers the author achievement refresh.
        for(const uid of [...new Set([Number(user),Number(rs[0].user_id)])].sort((a,b)=>a-b))await c.query('SELECT id FROM user WHERE id=? FOR UPDATE',[uid]);
        const [valid]=await c.query('SELECT id FROM review WHERE id=? AND status=0 AND deleted_at IS NULL FOR UPDATE',[id]);if(!valid.length)throw err.not_found('评价不存在');
        if(remove)await c.query('UPDATE review_like SET deleted_at=NOW() WHERE user_id=? AND biz_type=1 AND biz_id=? AND deleted_at IS NULL',[user,id]);
        else await c.query('INSERT INTO review_like(user_id,biz_type,biz_id) VALUES(?,1,?) ON DUPLICATE KEY UPDATE biz_id=VALUES(biz_id)',[user,id]);
        await refresh_achievements(c,rs[0].user_id);await c.commit();return {liked:!remove};
    }catch(e){await c.rollback();throw e;}finally{c.release();}
}
async function list(user){return query('SELECT * FROM favorite WHERE user_id=? AND deleted_at IS NULL ORDER BY id DESC LIMIT 200',[user]);}
module.exports={favorite,like,list};
