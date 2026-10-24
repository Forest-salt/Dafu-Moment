/**
 * 图片上传服务：magic number 校验 → Jimp 解码复核 → dHash 判重 → MinIO 入库
 */
const crypto = require('crypto');
const config = require('../config');
const { minioClient } = require('../db/minio');
const { redis, redis_safe } = require('../db/redis');
const { dhash, sniff_image_type } = require('../utils/dhash');
const { err } = require('../utils/api-error');

/**
 * 上传单图（≤5MB，白名单 jpeg/png/webp）
 * @param {Buffer} buf - 文件字节
 * @param {number} userId - 上传者
 * @param {string} scene - 场景前缀 review|cover
 * @returns {Promise<{objectKey: string, url: string, dhashHex: string}>}
 */
async function upload_image(buf, userId, scene = 'review') {
    // 1) magic number 白名单（防改后缀）
    const type = sniff_image_type(buf);
    if (!type) throw err.invalid('仅支持 jpg/png/webp 图片');
    // 上限 5MB：与 routes multer limits 共用 config 常量
    if (buf.length > config.numbers.UPLOAD_MAX_BYTES) throw err.invalid('图片不能超过 5MB');

    // 2) dHash + 判重（Redis 近 7 天池，汉明 ≤5 → 409）
    const { bin, hex } = await dhash(buf);
    const dup = await check_pool_dup(bin);
    if (dup) throw err.conflict('图片疑似搬运（与近期上传重复），请换一张实拍');

    // 3) 入 MinIO：objectKey = {scene}/{yyyymm}/{uuid}.{ext}
    const ext = type === 'jpeg' ? 'jpg' : type;
    const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');
    const objectKey = `${scene}/${yyyymm}/${crypto.randomUUID()}.${ext}`;
    const meta = { 'Content-Type': `image/${type === 'jpg' ? 'jpeg' : ext}` };
    await minioClient.putObject(config.minio.bucket, objectKey, buf, buf.length, meta);

    // 4) dHash 入 Redis 池（7 天）+ 上传登记（发评绑定校验用，24h）
    await redis_safe(async () => {
        const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        await redis.sadd(`phash:${yyyymmdd}`, hex);
        await redis.expire(`phash:${yyyymmdd}`, 7 * 86400);
        await redis.set(`upload:${userId}:${objectKey}`, '1', 'EX', 86400);
    });

    return { objectKey, url: `/img/${objectKey}`, dhashHex: hex };
}

/**
 * 与池内已有哈希比对
 * @param {Buffer} bin - 哈希
 * @returns {Promise<boolean>}
 */
async function check_pool_dup(bin) {
    return redis_safe(async () => {
        for (let d = 0; d < 7; d++) {
            const day = new Date(Date.now() - d * 86400000);
            const key = `phash:${day.toISOString().slice(0, 10).replace(/-/g, '')}`;
            const poolHexes = await redis.smembers(key);
            for (const ph of poolHexes) {
                const other = Buffer.from(ph, 'hex');
                let dist = 0;
                for (let i = 0; i < other.length; i++) {
                    let x = bin[i] ^ other[i];
                    while (x) {
                        dist += x & 1;
                        x >>= 1;
                    }
                }
                if (dist <= config.numbers.DHASH_HAMMING) return true;
            }
        }
        return false;
    }, false);
}

/**
 * 发评绑定校验：图片必须存在且属于本人 24h 内上传（防盗链引用）
 * @param {number} userId
 * @param {string[]} objectKeys
 * @returns {Promise<boolean>}
 */
async function verify_ownership(userId, objectKeys) {
    return redis_safe(async () => {
        for (const key of objectKeys) {
            const okFlag = await redis.exists(`upload:${userId}:${key}`);
            if (!okFlag) return false;
        }
        return true;
    }, true); // Redis 降级时跳过校验
}

module.exports = { upload_image, verify_ownership };
