/** 3.0独立应用：旧路由/旧种子/旧自动ALTER不进入此运行链。 */
const express=require('express');
const cors=require('cors');
const {not_found,error_handler}=require('./middleware/error');
function create_app(){
    const app=express();app.use(cors());app.use(express.json({limit:'1mb'}));
    app.get('/img/*',async(req,res)=>{
        try{
            const {minioClient}=require('./db/minio');const config=require('./config');
            let user=0;
            try{const p=require('jsonwebtoken').verify(String(req.headers.authorization||'').replace(/^Bearer /,''),config.jwt_secret);const u=await require('./services/identity3.service').public_user(p.uid);if(u&&u.status!==2)user=u.id;}catch{}
            if(!await require('./services/media3.service').can_read(req.params[0],user))return res.status(404).json({code:40401,msg:'图片不存在'});
            const stream=await minioClient.getObject(config.minio.bucket,req.params[0]);res.set('Cache-Control','private, no-store');stream.on('error',()=>res.destroy());stream.pipe(res);
        }
        catch{res.status(404).json({code:40401,msg:'图片不存在'});}
    });
    app.use('/api',require('./routes/db3'));
    app.use(not_found());app.use(error_handler());return app;
}
module.exports={create_app};
