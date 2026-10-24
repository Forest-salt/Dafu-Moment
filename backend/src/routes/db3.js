/** 独立3.0接口，不调用旧22表SQL服务。接口字段直接对应3.0，交接见docs/db3。 */
const express=require('express'),jwt=require('jsonwebtoken');
const config=require('../config');
const {query,query_one}=require('../db/pool');
const {ok,err}=require('../utils/api-error');
const identity=require('../services/identity3.service');
const checkin=require('../services/checkin.service');
const journal=require('../services/journal3.service');
const profile=require('../services/profile3.service');
const review=require('../services/review3.service');
const pet=require('../services/pet3.service');
const interaction=require('../services/interaction3.service');
const tasks=require('../services/task3.service');
const captcha=require('../utils/captcha');
const {rate_limit}=require('../middleware/rate-limit');
const router=express.Router();
const wrap=fn=>(req,res,next)=>Promise.resolve().then(()=>fn(req,res)).catch(next);
function guard(write=false){return async(req,_res,next)=>{
    try{
        const token=String(req.headers.authorization||'');
        if(!token.startsWith('Bearer '))throw err.unauthorized();
        let p;try{p=jwt.verify(token.slice(7),config.jwt_secret);}catch{throw err.unauthorized();}
        const u=await identity.public_user(p.uid);if(!u)throw err.unauthorized();
        if(u.status===2)throw err.banned('账号已封禁');
        if(write&&u.status===1){
            if(!u.mute_until||new Date(u.mute_until)>new Date())throw err.banned('账号禁言中');
            await query('UPDATE user SET status=0,mute_until=NULL WHERE id=? AND status=1 AND mute_until<=NOW()',[u.id]);u.status=0;
        }
        req.user=u;next();
    }catch(e){next(e);}
};}
function maintainer(req,_res,next){
    next(req.user.roles.some(r=>['super_admin','platform_admin','data_maintainer'].includes(r))?undefined:err.forbidden('需要数据维护权限'));
}
router.get('/health',wrap(async(_req,res)=>{
    const r=await query_one("SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'");
    if(Number(r.n)!==78)throw err.unavailable('数据库结构发生变化，请核对3.0基线');
    ok(res,{schema:'3.0',tables:Number(r.n)});
}));
router.get('/auth/captcha',rate_limit('captcha3',30,60),wrap(async(_req,res)=>{
    const c=await captcha.create_captcha();ok(res,{captchaId:c.captchaId,imageBase64:`data:image/svg+xml;base64,${Buffer.from(c.svg).toString('base64')}`,...(config.debug?{debugCode:c.text}:{})});
}));
for(const action of ['register','login'])router.post(`/auth/${action}`,rate_limit('auth3-'+action,10,600),wrap(async(req,res)=>{
    await captcha.assert_captcha(req.body.captchaId,req.body.captchaCode);
    const user=await identity[action](req.body);ok(res,{user,token:jwt.sign({uid:user.id},config.jwt_secret,{expiresIn:'7d'})});
}));
router.get('/auth/me',guard(),wrap(async(req,res)=>ok(res,req.user)));
router.get('/locations',wrap(async(req,res)=>ok(res,await query(`SELECT l.*,c.name scene_category,m.latitude,m.longitude,b.business_hours,b.business_status
    FROM location l LEFT JOIN scene_category c ON c.id=l.scene_category_id LEFT JOIN map_location m ON m.id=l.map_location_id
    LEFT JOIN business_info b ON b.location_id=l.id AND b.deleted_at IS NULL WHERE l.deleted_at IS NULL
    ${req.query.q?'AND l.name LIKE ?':''} ORDER BY l.id LIMIT 200`,req.query.q?['%'+String(req.query.q).slice(0,128)+'%']:[]))));
router.get('/locations/:id',wrap(async(req,res)=>{
    const row=await query_one('SELECT * FROM location WHERE id=? AND deleted_at IS NULL',[req.params.id]);if(!row)throw err.not_found('点位不存在');
    row.stations=await query('SELECT * FROM station WHERE location_id=? AND deleted_at IS NULL ORDER BY id',[row.id]);
    row.summary=await query('SELECT s.*,d.code,d.name FROM review_summary s JOIN review_dimension d ON d.id=s.dimension_id WHERE s.biz_type=1 AND s.biz_id=?',[row.id]);ok(res,row);
}));
router.get('/stations/:id',wrap(async(req,res)=>{
    const row=await query_one('SELECT * FROM station WHERE id=? AND deleted_at IS NULL',[req.params.id]);if(!row)throw err.not_found('档口不存在');
    row.dishes=await query('SELECT * FROM dish WHERE station_id=? AND status=1 AND deleted_at IS NULL',[row.id]);ok(res,row);
}));
router.get('/dishes/:id',wrap(async(req,res)=>{const r=await query_one('SELECT * FROM dish WHERE id=? AND status=1 AND deleted_at IS NULL',[req.params.id]);if(!r)throw err.not_found('菜品不存在');ok(res,r);}));
router.get('/dimensions',wrap(async(req,res)=>ok(res,await review.dimensions(req.query.mealMode||1))));
router.get('/reviews',wrap(async(req,res)=>ok(res,await review.list(req.query))));
router.post('/reviews',guard(true),rate_limit('review3',10,3600),wrap(async(req,res)=>ok(res,await review.create(req.user.id,req.body))));
router.put('/reviews/:id',guard(true),wrap(async(req,res)=>ok(res,await review.update(req.user.id,req.params.id,req.body))));
router.delete('/reviews/:id',guard(true),wrap(async(req,res)=>ok(res,await review.remove(req.user.id,req.params.id))));
router.get('/checkins',guard(),wrap(async(req,res)=>ok(res,await checkin.list(req.user.id))));
router.get('/checkins/calendar',guard(),wrap(async(req,res)=>ok(res,await checkin.calendar(req.user.id,req.query.month))));
router.get('/checkins/stats',guard(),wrap(async(req,res)=>ok(res,await checkin.stats(req.user.id))));
router.post('/checkins',guard(true),wrap(async(req,res)=>ok(res,await checkin.create(req.user.id,req.body))));
router.delete('/checkins/:id',guard(true),wrap(async(req,res)=>ok(res,await checkin.remove(req.user.id,req.params.id))));
router.get('/footprint',guard(),wrap(async(req,res)=>ok(res,await query('SELECT f.*,l.name FROM footprint f JOIN location l ON l.id=f.location_id WHERE f.user_id=? AND f.deleted_at IS NULL',[req.user.id]))));
router.get('/journal',guard(),wrap(async(req,res)=>ok(res,await journal.list(req.user.id))));
router.get('/journal/:id',guard(),wrap(async(req,res)=>ok(res,await journal.get(req.user.id,req.params.id))));
router.post('/journal',guard(true),wrap(async(req,res)=>ok(res,await journal.create(req.user.id,req.body))));
router.put('/journal/:id',guard(true),wrap(async(req,res)=>ok(res,await journal.update(req.user.id,req.params.id,req.body))));
router.delete('/journal/:id',guard(true),wrap(async(req,res)=>ok(res,await journal.remove(req.user.id,req.params.id))));
router.get('/me/dietary-profile',guard(),wrap(async(req,res)=>ok(res,await profile.get(req.user.id))));
router.put('/me/dietary-profile',guard(true),wrap(async(req,res)=>ok(res,await profile.save(req.user.id,req.body))));
router.get('/achievements',guard(),wrap(async(req,res)=>ok(res,await query(`SELECT a.*,COALESCE(p.progress,0) progress,COALESCE(p.unlocked,0) unlocked FROM achievement a
    LEFT JOIN user_achievement p ON p.achievement_id=a.id AND p.user_id=? ORDER BY a.id`,[req.user.id]))));
router.get('/pet',guard(),wrap(async(req,res)=>ok(res,await pet.get(req.user.id))));
router.post('/pet',guard(true),wrap(async(req,res)=>ok(res,await pet.adopt(req.user.id))));
router.post('/pet/feed',guard(true),wrap(async(req,res)=>ok(res,await pet.feed(req.user.id))));
router.get('/tasks',guard(),wrap(async(req,res)=>ok(res,await tasks.list(req.user.id))));
router.post('/tasks/:id/claim',guard(true),wrap(async(req,res)=>ok(res,await tasks.claim(req.user.id,req.params.id))));
router.get('/favorites',guard(),wrap(async(req,res)=>ok(res,await interaction.list(req.user.id))));
router.post('/favorites',guard(true),wrap(async(req,res)=>ok(res,await interaction.favorite(req.user.id,req.body))));
router.delete('/favorites',guard(true),wrap(async(req,res)=>ok(res,await interaction.favorite(req.user.id,req.body,true))));
router.post('/reviews/:id/like',guard(true),wrap(async(req,res)=>ok(res,await interaction.like(req.user.id,req.params.id))));
router.delete('/reviews/:id/like',guard(true),wrap(async(req,res)=>ok(res,await interaction.like(req.user.id,req.params.id,true))));
const upload=require('multer')({storage:require('multer').memoryStorage(),limits:{fileSize:config.numbers.UPLOAD_MAX_BYTES}});
router.post('/media/upload',guard(true),rate_limit('upload3',30,3600),upload.single('file'),wrap(async(req,res)=>{
    if(!req.file)throw err.invalid('缺少图片');ok(res,await require('../services/media3.service').upload(req.file.buffer,req.user.id));
}));
router.get('/notifications',guard(),wrap(async(req,res)=>ok(res,await query('SELECT * FROM notification WHERE user_id=? ORDER BY id DESC LIMIT 100',[req.user.id]))));
router.put('/notifications/:id/read',guard(true),wrap(async(req,res)=>{const r=await query('UPDATE notification SET is_read=1 WHERE id=? AND user_id=?',[req.params.id,req.user.id]);if(!r.affectedRows)throw err.not_found();ok(res,{read:true});}));
// Maintenance writes are explicit and cannot supply arbitrary table/column identifiers.
router.post('/data/locations',guard(true),maintainer,wrap(async(req,res)=>{
    const b=req.body,name=String(b.name||'').trim();if(!name||[...name].length>128)throw err.invalid('点位名称应为1至128字');
    const r=await query('INSERT INTO location(name,address,scene_category_id,canteen_id) VALUES(?,?,?,?)',[name,b.address||null,b.sceneCategoryId||null,b.canteenId||null]);ok(res,{id:r.insertId});
}));
router.post('/data/stations',guard(true),maintainer,wrap(async(req,res)=>{
    const b=req.body,name=String(b.name||'').trim();if(!name||[...name].length>128)throw err.invalid('档口名称应为1至128字');
    const l=await query_one('SELECT id FROM location WHERE id=? AND deleted_at IS NULL',[b.locationId||0]);if(!l)throw err.not_found('点位不存在');
    const r=await query('INSERT INTO station(name,location_id,business_hours) VALUES(?,?,?)',[name,l.id,b.businessHours||null]);ok(res,{id:r.insertId});
}));
router.post('/data/dishes',guard(true),maintainer,wrap(async(req,res)=>{
    const b=req.body,name=String(b.name||'').trim(),price=Number(b.price);if(!name||[...name].length>128||!Number.isFinite(price)||price<0||price>99999999.99)throw err.invalid('菜品名称或价格不合法');
    const s=await query_one('SELECT id FROM station WHERE id=? AND status=1 AND deleted_at IS NULL',[b.stationId||0]);if(!s)throw err.not_found('档口不存在');
    const r=await query('INSERT INTO dish(name,station_id,price,price_unit,status) VALUES(?,?,?,?,0)',[name,s.id,price,b.priceUnit||null]);ok(res,{id:r.insertId,status:0});
}));
module.exports=router;
