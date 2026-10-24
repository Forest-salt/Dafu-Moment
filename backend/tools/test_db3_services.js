/** Real MySQL integration assertions. Run only through verify_db3_services.py (fresh owned server). */
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {query,query_one,pool}=require('../src/db/pool');
const {ensure_schema}=require('../src/db/schema3');
const identity=require('../src/services/identity3.service');
const checkin=require('../src/services/checkin.service');
const journal=require('../src/services/journal3.service');
const profile=require('../src/services/profile3.service');
const review=require('../src/services/review3.service');
const pet=require('../src/services/pet3.service');
const interaction=require('../src/services/interaction3.service');
const tasks=require('../src/services/task3.service');
const media=require('../src/services/media3.service');
const results=[];
async function test(name,fn){await fn();results.push({check:name,passed:true});console.log('PASS '+name);}
async function rejects(p,status){await assert.rejects(p,e=>e.status===status);}
async function scalar(sql,params=[]){return Number(Object.values(await query_one(sql,params))[0]);}
let server,redis;
async function main(){
    if(process.env.DB3_OWNED_TEST!=='1')throw Error('Only run with owned temporary server');
    await test('fresh_schema_and_repeat_78_106_545',async()=>{
        await ensure_schema();await ensure_schema();
        assert.equal(await scalar("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()"),78);
        assert.equal(await scalar("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()"),545);
    });
    let u,v;
    await test('nine_digit_synthetic_identity_password_hash_unverified',async()=>{
        u=await identity.register({studentNo:'990000001',password:'test-only-password-1',nickname:'虚构测试01'});
        v=await identity.register({studentNo:'990000002',password:'test-only-password-2',nickname:'虚构测试02'});
        assert.equal(u.verified_status,0);assert.deepEqual(u.roles,['user']);assert.equal(u.student_no.length,9);
        assert.equal((await identity.login({studentNo:'990000001',password:'test-only-password-1'})).id,u.id);
        await rejects(identity.register({studentNo:'12345678',password:'test-only-password-1'}),422);
        await rejects(identity.login({studentNo:'990000001',password:'bad'}),401);
        await assert.rejects(identity.register({studentNo:'990000001',password:'test-only-password-1'}),e=>e.code==='ER_DUP_ENTRY');
        assert(!(await query_one('SELECT password_hash FROM user WHERE id=?',[u.id])).password_hash.includes('test-only'));
    });
    await test('phone_encrypted_at_rest_salted_lookup',async()=>{
        process.env.PHONE_HASH_SALT='test-only-salt-000000000';process.env.PHONE_ENCRYPTION_KEY='ab'.repeat(32);
        const a=await identity.register({phone:'19900000000',password:'test-phone-only',nickname:'虚构手机测试'});
        const row=await query_one('SELECT phone,phone_hash FROM user WHERE id=?',[a.id]);
        assert(row.phone.startsWith('v1:'));assert(!row.phone.includes('19900000000'));assert.equal(row.phone_hash.length,64);
        assert.equal((await identity.login({phone:'19900000000',password:'test-phone-only'})).id,a.id);
        delete process.env.PHONE_HASH_SALT;delete process.env.PHONE_ENCRYPTION_KEY;
        await rejects(identity.login({phone:'19900000000',password:'test-phone-only'}),503);
    });
    const l=(await query('INSERT INTO location(name,scene_category_id) VALUES(?,1)',['虚构测试点位'])).insertId;
    const other=(await query('INSERT INTO location(name,scene_category_id) VALUES(?,1)',['虚构其他点位'])).insertId;
    const s=(await query('INSERT INTO station(name,location_id) VALUES(?,?)',['虚构档口',l])).insertId;
    const dish=(await query('INSERT INTO dish(name,station_id,price,status) VALUES(?,?,12.50,1)',['虚构菜品',s])).insertId;
    await query('INSERT INTO upload_asset(object_key,hash_dhash,size,mime,uploader_id) VALUES(?,?,100,?,?),(?,?,100,?,?)',['test/one.png','hash-test-one','image/png',u.id,'test/other.png','hash-test-two','image/png',v.id]);
    let ci,jid;
    await test('checkin_unique_concurrent_ownership_rollback',async()=>{
        const b={locationId:l,date:'2026-10-20',dishIds:[dish],imageKeys:['test/one.png']};
        const parallel=await Promise.allSettled([checkin.create(u.id,b),checkin.create(u.id,b)]);
        assert.equal(parallel.filter(r=>r.status==='fulfilled').length,1);
        const conflict=parallel.find(r=>r.status==='rejected').reason;assert.equal(conflict.status,409);assert(conflict.data.checkinId);
        ci=parallel.find(r=>r.status==='fulfilled').value.checkinId;
        await rejects(checkin.create(u.id,{locationId:l,date:'2026-10-21',imageKeys:['test/other.png']}),403);
        await rejects(checkin.create(u.id,{locationId:other,stationId:s,date:'2026-10-21'}),422);
        await rejects(checkin.create(u.id,{locationId:l,date:'2026-02-30'}),422);
        assert.equal(await scalar('SELECT COUNT(*) FROM check_in WHERE user_id=?',[u.id]),1);
        assert.equal(await scalar('SELECT COUNT(*) FROM footprint WHERE user_id=?',[u.id]),1);
        assert.equal(await scalar('SELECT ref_count FROM upload_asset WHERE object_key=?',['test/one.png']),1);
    });
    await test('journal_checkin_text_image_privacy_no_canvas',async()=>{
        jid=(await journal.create(u.id,{checkInId:ci,note:'虚构手账',imageKeys:['test/one.png']})).id;
        assert.equal((await journal.get(u.id,jid)).is_private,1);
        await rejects(journal.get(v.id,jid),404);
        assert.equal(await media.can_read('test/one.png',v.id),false);
        assert.equal(await media.can_read('test/one.png',u.id),true);
        await rejects(journal.update(v.id,jid,{note:'越权'}),404);
        await rejects(journal.update(u.id,jid,{layout:[],note:'旧画布'}),422);
        await rejects(journal.update(u.id,jid,{template:'unspecified'}),422);
        await rejects(journal.update(u.id,jid,{note:'应回滚',imageKeys:['test/other.png']}),403);
        assert.equal((await journal.get(u.id,jid)).note,'虚构手账');
        await journal.update(u.id,jid,{note:'已公开的虚构手账',isPrivate:false,imageKeys:['test/one.png']});
        assert.equal((await journal.get(v.id,jid)).is_private,0);
        assert.equal(await media.can_read('test/one.png',v.id),true);
        assert.equal(await scalar('SELECT ref_count FROM upload_asset WHERE object_key=?',['test/one.png']),2);
    });
    await test('dietary_profile_normalized_repeat_validation',async()=>{
        const b={budgetMin:10,budgetMax:20,isVegetarian:true,tastePreference:'清淡',restrictions:[{type:1,word:'香菜'},{type:2,word:'虾'}]};
        await profile.save(u.id,b);const p=await profile.save(u.id,b);assert.equal(p.restrictions.length,2);assert.equal(p.budget_min,10);
        await rejects(profile.save(u.id,{...b,budgetMin:30}),422);
        await rejects(profile.save(u.id,{...b,restrictions:[{type:3,word:'x'}]}),422);
        assert.equal((await profile.get(u.id)).restrictions.length,2);
    });
    let rid;
    await test('review_normalized_dimensions_pending_excluded_aggregate',async()=>{
        assert.deepEqual((await review.dimensions(1)).map(d=>d.code),['taste','portion','queue']);
        const b={stationId:s,dishId:dish,content:'虚构测试评价',mealMode:1,scores:{taste:4,portion:3}};
        await rejects(review.create(u.id,{...b,scores:{taste:4}}),422);
        await rejects(review.create(u.id,{...b,scores:{taste:4,portion:3,package:4}}),422);
        await rejects(review.create(u.id,{...b,imageKeys:['test/other.png']}),403);
        assert.equal(await scalar('SELECT COUNT(*) FROM review'),0);
        rid=(await review.create(u.id,b)).id;
        assert.equal(await scalar('SELECT COUNT(*) FROM rating_detail WHERE review_id=?',[rid]),2);
        assert.equal(await scalar('SELECT COUNT(*) FROM review_summary'),6);
        await review.create(v.id,{...b,content:'虚构测试含代购',scores:{taste:1,portion:1}});
        assert.equal(await scalar('SELECT COUNT(*) FROM review WHERE status=2'),1);
        assert.equal(await scalar('SELECT AVG(avg_score) FROM review_summary WHERE dimension_id=1'),4);
        await review.update(u.id,rid,{...b,scores:{taste:5,portion:4}});
        assert.equal(await scalar('SELECT AVG(avg_score) FROM review_summary WHERE dimension_id=1'),5);
        await interaction.like(v.id,rid);await interaction.like(v.id,rid);
        assert.equal(await scalar('SELECT COUNT(*) FROM review_like WHERE biz_type=1 AND biz_id=? AND deleted_at IS NULL',[rid]),1);
        assert.equal(await scalar('SELECT progress FROM user_achievement WHERE user_id=? AND achievement_id=4',[u.id]),1);
        await interaction.like(v.id,rid,true);await interaction.like(v.id,rid);
        await rejects(review.remove(v.id,rid),404);
        await review.remove(u.id,rid);assert.equal(await scalar('SELECT COUNT(*) FROM review_summary'),0);
    });
    await test('checkin_delete_cascades_journal_assets_progress_keeps_history',async()=>{
        const post=(await query('INSERT INTO post(user_id,content,post_type,journal_id) VALUES(?,?,3,?)',[u.id,'虚构手账转帖',jid])).insertId;
        const comment=(await query('INSERT INTO review_reply(user_id,content,parent_type,parent_id) VALUES(?,?,1,?)',[v.id,'虚构评论',post])).insertId;
        await query('INSERT INTO review_like(user_id,biz_type,biz_id) VALUES(?,2,?),(?,3,?)',[v.id,post,u.id,comment]);
        await interaction.favorite(v.id,{bizType:4,bizId:post});
        await rejects(checkin.remove(v.id,ci),403);await checkin.remove(u.id,ci);
        await rejects(journal.get(u.id,jid),404);
        assert.equal(await scalar('SELECT ref_count FROM upload_asset WHERE object_key=?',['test/one.png']),0);
        assert.equal(await scalar('SELECT progress FROM user_achievement WHERE user_id=? AND achievement_id=1',[u.id]),0);
        assert.equal(await scalar('SELECT COUNT(*) FROM footprint WHERE user_id=?',[u.id]),1);
        assert.equal(await scalar('SELECT COUNT(*) FROM post WHERE id=? AND deleted_at IS NULL',[post]),0);
        assert.equal(await scalar('SELECT COUNT(*) FROM review_reply WHERE id=? AND deleted_at IS NULL',[comment]),0);
        assert.equal(await scalar('SELECT COUNT(*) FROM review_like WHERE biz_type IN(2,3) AND deleted_at IS NULL'),0);
        assert.equal(await scalar('SELECT COUNT(*) FROM favorite WHERE biz_type=4 AND biz_id=? AND deleted_at IS NULL',[post]),0);
        await rejects(checkin.create(u.id,{locationId:l,date:'2026-10-20'}),409);
    });
    await test('pet_feed_balance_concurrent_limit_atomic',async()=>{
        await pet.adopt(u.id);await pet.adopt(u.id);assert.equal(await scalar('SELECT COUNT(*) FROM pet WHERE user_id=?',[u.id]),1);
        await rejects(pet.feed(u.id),409);
        await query('INSERT INTO coin_transaction(user_id,change_type,amount,balance_after) VALUES(?,3,100,100)',[u.id]);
        const rs=await Promise.allSettled(Array.from({length:5},()=>pet.feed(u.id)));
        assert.equal(rs.filter(r=>r.status==='fulfilled').length,3);
        assert.equal((await pet.get(u.id)).balance,70);
        assert.equal((await pet.get(u.id)).pet.lit_days,0);
        assert.equal(await scalar('SELECT COUNT(*) FROM coin_transaction WHERE user_id=? AND change_type=2',[u.id]),3);
        await query('UPDATE pet SET created_at=DATE_SUB(NOW(),INTERVAL 5 DAY) WHERE user_id=?',[u.id]);
        assert.equal((await pet.get(u.id)).pet.status,1); // Feeding is feedback, not a fabricated valid review/check-in.
    });
    await test('daily_task_evidence_concurrent_once_no_reclaim',async()=>{
        await rejects(tasks.claim(v.id,1),409);
        const visit=await checkin.create(v.id,{locationId:l,date:checkin.date_key()});
        const attempts=await Promise.allSettled([tasks.claim(v.id,1),tasks.claim(v.id,1),tasks.claim(v.id,1)]);
        assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
        assert.equal(await scalar('SELECT SUM(amount) FROM coin_transaction WHERE user_id=?',[v.id]),10);
        await checkin.remove(v.id,visit.checkinId);await rejects(tasks.claim(v.id,1),409);
        assert.equal(await scalar('SELECT SUM(amount) FROM coin_transaction WHERE user_id=?',[v.id]),10);
    });
    await test('favorite_polymorphic_codes_repeat_softdelete_readd',async()=>{
        await interaction.favorite(u.id,{bizType:3,bizId:dish});await interaction.favorite(u.id,{bizType:3,bizId:dish});
        assert.equal((await interaction.list(u.id)).length,1);
        await interaction.favorite(u.id,{bizType:3,bizId:dish},true);await interaction.favorite(u.id,{bizType:3,bizId:dish});
        assert.equal((await interaction.list(u.id)).length,1);
        await rejects(interaction.favorite(u.id,{bizType:0,bizId:dish}),422);
    });
    await test('http_canonical_routes_auth_roles_and_captcha_fail_closed',async()=>{
        const client=require('../src/db/redis');redis=client.redis;redis.on('error',()=>{});redis.disconnect();
        const {create_app}=require('../src/app3');server=create_app().listen(0,'127.0.0.1');
        await new Promise(resolve=>server.on('listening',resolve));
        const base='http://127.0.0.1:'+server.address().port+'/api';
        const token=require('jsonwebtoken').sign({uid:u.id},require('../src/config').jwt_secret);
        const call=(url,options={})=>fetch(base+url,options);
        assert.equal((await call('/health')).status,200);
        assert.equal((await call('/checkins')).status,401);
        assert.equal((await call('/checkins',{headers:{Authorization:'Bearer '+token}})).status,200);
        assert.equal((await call('/data/locations',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({name:'未授权'})})).status,403);
        assert.equal((await call('/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentNo:'990000099',password:'test-only-xx',captchaId:'owned-test-captcha',captchaCode:'AAAA'})})).status,422);
        assert.equal(await scalar("SELECT COUNT(*) FROM user WHERE student_no='990000099'"),0);
    });
    await test('schema_drift_refused_without_repair_or_data_change',async()=>{
        await query('ALTER TABLE dietary_profile MODIFY COLUMN taste_preference VARCHAR(63)');
        await assert.rejects(ensure_schema(),e=>e.message.includes('dietary_profile.taste_preference'));
        assert.equal(await scalar("SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='dietary_profile' AND COLUMN_NAME='taste_preference'"),63);
    });
    fs.writeFileSync(process.argv[2],JSON.stringify({schema:'3.0',production_accessed:false,tests:results},null,2));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{
    if(server)await new Promise(resolve=>server.close(resolve));if(redis)redis.disconnect();await pool.end();
});
