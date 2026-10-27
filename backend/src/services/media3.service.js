const crypto=require('crypto');
const config=require('../config');
const {query}=require('../db/pool');
const {minioClient}=require('../db/minio');
const {dhash,sniff_image_type,hamming}=require('../utils/dhash');
const {err}=require('../utils/api-error');
async function upload(buffer,user){
    const type=sniff_image_type(buffer);if(!type||buffer.length>config.numbers.UPLOAD_MAX_BYTES)throw err.invalid('上传应为5MB以内jpg/png/webp');
    let fingerprint;try{fingerprint=await dhash(buffer);}catch{throw err.invalid('图片无法解码，请使用有效的jpg/png/webp');}
    const {hex,bin}=fingerprint;
    const recent=await query('SELECT hash_dhash FROM upload_asset WHERE created_at>=DATE_SUB(NOW(),INTERVAL 7 DAY)');
    if(recent.some(r=>/^[a-f0-9]{16}$/i.test(r.hash_dhash)&&hamming(bin,Buffer.from(r.hash_dhash,'hex'))<=config.numbers.DHASH_HAMMING))throw err.conflict('图片与近期上传相似，请勿重复上传');
    const key='db3/'+crypto.randomUUID()+'.'+(type==='jpeg'?'jpg':type),mime='image/'+type;
    await minioClient.putObject(config.minio.bucket,key,buffer,buffer.length,{'Content-Type':mime});
    try{await query('INSERT INTO upload_asset(object_key,hash_dhash,size,mime,uploader_id) VALUES(?,?,?,?,?)',[key,hex,buffer.length,mime,user]);}
    catch(e){await minioClient.removeObject(config.minio.bucket,key);throw e;}
    return {objectKey:key,url:'/img/'+key};
}
async function can_read(key,user=0){
    const rows=await query(`SELECT 1 allowed WHERE
      EXISTS(SELECT 1 FROM upload_asset WHERE object_key=? AND uploader_id=?)
      OR EXISTS(SELECT 1 FROM review_image i JOIN review r ON r.id=i.review_id WHERE i.object_key=? AND r.status=0 AND r.deleted_at IS NULL)
      OR EXISTS(SELECT 1 FROM check_in_image i JOIN check_in c ON c.id=i.check_in_id WHERE i.object_key=? AND i.deleted_at IS NULL AND c.deleted_at IS NULL AND (c.user_id=? OR c.visibility=3))
      OR EXISTS(SELECT 1 FROM journal_image i JOIN journal j ON j.id=i.journal_id JOIN check_in c ON c.id=j.check_in_id WHERE i.object_key=? AND i.deleted_at IS NULL AND j.deleted_at IS NULL AND c.deleted_at IS NULL AND (c.user_id=? OR j.is_private=0))
      OR EXISTS(SELECT 1 FROM dish WHERE image=? AND status=1 AND deleted_at IS NULL)
      OR EXISTS(SELECT 1 FROM user WHERE avatar=? AND status<>3 AND deleted_at IS NULL)`,[key,user,key,key,user,key,user,key,key]);
    return rows.length>0;
}
module.exports={upload,can_read};
