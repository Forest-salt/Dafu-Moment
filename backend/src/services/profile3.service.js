const { query,query_one,get_conn }=require('../db/pool');
const { err }=require('../utils/api-error');
async function get(user) {
    const p=await query_one('SELECT * FROM dietary_profile WHERE user_id=? AND deleted_at IS NULL',[user]);
    if (!p) return null;
    p.restrictions=await query('SELECT type,word FROM dietary_restriction WHERE dietary_profile_id=? ORDER BY type,id',[p.id]);
    return p;
}
async function save(user,b) {
    const min=b.budgetMin==null?null:Number(b.budgetMin),max=b.budgetMax==null?null:Number(b.budgetMax);
    if ([min,max].some(n=>n!==null && (!Number.isFinite(n)||n<0||n>99999999.99)) || (min!==null&&max!==null&&min>max)) throw err.invalid('预算上下限不合法');
    if (b.isVegetarian!==undefined && typeof b.isVegetarian!=='boolean') throw err.invalid('isVegetarian应为布尔值');
    const taste=String(b.tastePreference||'');
    if ([...taste].length>64) throw err.invalid('口味偏好最多64字');
    const restrictions=b.restrictions||[];
    if (!Array.isArray(restrictions)||restrictions.length>50||restrictions.some(r=>!r||![1,2].includes(r.type)||typeof r.word!=='string'||!r.word.trim()||[...r.word.trim()].length>64)) throw err.invalid('限制应分为1忌口、2过敏原，每项1至64字');
    const conn=await get_conn();
    try {
        await conn.beginTransaction();
        // Serialize replacement of the child rows even on first profile creation.
        await conn.query('SELECT id FROM user WHERE id=? FOR UPDATE',[user]);
        await conn.query(`INSERT INTO dietary_profile(user_id,budget_min,budget_max,is_vegetarian,taste_preference) VALUES(?,?,?,?,?)
          ON DUPLICATE KEY UPDATE budget_min=VALUES(budget_min),budget_max=VALUES(budget_max),is_vegetarian=VALUES(is_vegetarian),taste_preference=VALUES(taste_preference),deleted_at=NULL`,[user,min,max,Number(!!b.isVegetarian),taste||null]);
        const [rs]=await conn.query('SELECT id FROM dietary_profile WHERE user_id=?',[user]);
        await conn.query('DELETE FROM dietary_restriction WHERE dietary_profile_id=?',[rs[0].id]);
        for(const r of restrictions) await conn.query('INSERT INTO dietary_restriction(dietary_profile_id,type,word) VALUES(?,?,?) ON DUPLICATE KEY UPDATE word=VALUES(word)',[rs[0].id,r.type,r.word.trim()]);
        await conn.commit();
    } catch(e) { await conn.rollback();throw e; } finally {conn.release();}
    return get(user);
}
module.exports={get,save};
