const {query,get_conn}=require('../db/pool');
const {err}=require('../utils/api-error');
const evidence={
  1:'SELECT id FROM check_in WHERE user_id=? AND check_in_date=CURRENT_DATE() AND created_at>=CURRENT_DATE() AND deleted_at IS NULL LIMIT 1',
  2:'SELECT id FROM review WHERE user_id=? AND status=0 AND created_at>=CURRENT_DATE() AND deleted_at IS NULL LIMIT 1',
  3:'SELECT id FROM feed_record WHERE user_id=? AND fed_at>=CURRENT_DATE() LIMIT 1',
  4:'SELECT id FROM favorite WHERE user_id=? AND biz_type=3 AND created_at>=CURRENT_DATE() AND deleted_at IS NULL LIMIT 1',
  5:'SELECT id FROM review_like WHERE user_id=? AND created_at>=CURRENT_DATE() AND deleted_at IS NULL LIMIT 1',
  6:'SELECT id FROM post WHERE user_id=? AND status=0 AND created_at>=CURRENT_DATE() AND deleted_at IS NULL LIMIT 1',
};
async function list(user){return query(`SELECT t.*,c.status,c.completed_at,c.claimed_at FROM task t LEFT JOIN task_claim c
  ON c.task_id=t.id AND c.user_id=? AND c.claim_date=CURRENT_DATE() WHERE t.enabled=1 ORDER BY t.id`,[user]);}
async function claim(user,id){
    const c=await get_conn();
    try{
        await c.beginTransaction();await c.query('SELECT id FROM user WHERE id=? FOR UPDATE',[user]);
        const [tasks]=await c.query('SELECT * FROM task WHERE id=? AND enabled=1 FOR UPDATE',[id]);
        const t=tasks[0];if(!t)throw err.not_found('任务不存在');
        if(t.task_type!==1||!evidence[t.action_type])throw err.invalid('本期仅实现3.0每日任务');
        const [cs]=await c.query('SELECT status FROM task_claim WHERE user_id=? AND task_id=? AND claim_date=CURRENT_DATE() FOR UPDATE',[user,id]);
        if(cs.length&&cs[0].status===2)throw err.conflict('今日奖励已领取');
        const [proof]=await c.query(evidence[t.action_type],[user]);if(!proof.length)throw err.conflict('今日尚未完成任务');
        if(!Number.isInteger(t.reward_coins)||t.reward_coins<0)throw err.invalid('任务奖励配置不合法');
        await c.query(`INSERT INTO task_claim(user_id,task_id,claim_date,status,completed_at,claimed_at) VALUES(?,?,CURRENT_DATE(),2,NOW(),NOW())
          ON DUPLICATE KEY UPDATE status=2,completed_at=COALESCE(completed_at,NOW()),claimed_at=NOW()`,[user,id]);
        const [bs]=await c.query('SELECT COALESCE(SUM(amount),0) balance FROM coin_transaction WHERE user_id=?',[user]);
        const balance=Number(bs[0].balance)+t.reward_coins;
        await c.query('INSERT INTO coin_transaction(user_id,change_type,amount,biz_id,balance_after) VALUES(?,1,?,?,?)',[user,t.reward_coins,id,balance]);
        await c.commit();return {taskId:Number(id),reward:t.reward_coins,balance};
    }catch(e){await c.rollback();throw e;}finally{c.release();}
}
module.exports={list,claim};
