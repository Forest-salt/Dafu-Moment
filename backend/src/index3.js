const {ensure_schema}=require('./db/schema3');
const {create_app}=require('./app3');
const config=require('./config');
async function start(){
    await ensure_schema();
    return create_app().listen(config.port,()=>console.log('[boot] 数据库3.0接口就绪，端口'+config.port));
}
if(require.main===module)start().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={start};
