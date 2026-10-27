/** 金币变更锁定用户行；一次喂食、扣款和流水共用事务，不生成satiety旧字段。 */
const {query,get_conn}=require('../db/pool');
const {err}=require('../utils/api-error');
async function get(user){
    // SRS6.1.7: three days without effective review/check-in, not "has not fed today".
    const rows=await query(`SELECT p.*,CASE WHEN TIMESTAMPDIFF(DAY,GREATEST(p.created_at,
       COALESCE((SELECT MAX(created_at) FROM check_in WHERE user_id=p.user_id AND deleted_at IS NULL),p.created_at),
       COALESCE((SELECT MAX(created_at) FROM review WHERE user_id=p.user_id AND status=0 AND deleted_at IS NULL),p.created_at)),NOW())>=3 THEN 1 ELSE 0 END derived_status,
       (SELECT COUNT(DISTINCT check_in_date) FROM check_in WHERE user_id=p.user_id AND deleted_at IS NULL) derived_lit_days
       FROM pet p WHERE user_id=? AND deleted_at IS NULL`,[user]);
    const b=await query('SELECT COALESCE(SUM(amount),0) balance FROM coin_transaction WHERE user_id=?',[user]);
    return {pet:rows[0]?{...rows[0],status:rows[0].derived_status,lit_days:Number(rows[0].derived_lit_days)}:null,balance:Number(b[0].balance)};
}
async function adopt(user){
    await query('INSERT INTO pet(user_id,level,lit_days) VALUES(?,1,0) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)',[user]);return get(user);
}
async function feed(user){
    const c=await get_conn();
    try{
        await c.beginTransaction();await c.query('SELECT id FROM user WHERE id=? FOR UPDATE',[user]);
        const [ps]=await c.query('SELECT id FROM pet WHERE user_id=? AND deleted_at IS NULL FOR UPDATE',[user]);if(!ps.length)throw err.not_found('请先领养宠物');
        const [ns]=await c.query('SELECT COUNT(*) n FROM feed_record WHERE user_id=? AND fed_at>=CURRENT_DATE()',[user]);if(ns[0].n>=3)throw err.conflict('当日最多喂食3次');
        const [bs]=await c.query('SELECT COALESCE(SUM(amount),0) balance FROM coin_transaction WHERE user_id=?',[user]);
        const balance=Number(bs[0].balance);if(balance<10)throw err.conflict('金币不足10');
        const [r]=await c.query('INSERT INTO feed_record(user_id,pet_id,coin_cost,fed_at) VALUES(?,?,10,NOW())',[user,ps[0].id]);
        await c.query('INSERT INTO coin_transaction(user_id,change_type,amount,biz_id,balance_after) VALUES(?,2,-10,?,?)',[user,r.insertId,balance-10]);
        await c.commit();return {feedId:r.insertId,balance:balance-10};
    }catch(e){await c.rollback();throw e;}finally{c.release();}
}
module.exports={get,adopt,feed};
