/**
 * MinIO 对象存储客户端 + 桶初始化（公共读策略）
 */
const { Client } = require('minio');
const config = require('../config');
const { of } = require('../utils/logger');

const log = of('[minio]');

const minioClient = new Client({
    endPoint: config.minio.host,
    port: config.minio.port,
    useSSL: false,
    accessKey: config.minio.user,
    secretKey: config.minio.password,
});

/**
 * 启动时确保桶存在且公共可读（失败不阻断启动，上传时再重试）
 * @returns {Promise<void>}
 */
async function ensure_bucket() {
    try {
        const exists = await minioClient.bucketExists(config.minio.bucket);
        if (!exists) {
            await minioClient.makeBucket(config.minio.bucket);
            log.info(`[minio] 已创建桶 ${config.minio.bucket}`);
        }
        // 公共读策略：允许匿名 GET（前端/网关直读图片）
        const policy = {
            Version: '2012-10-17',
            Statement: [{
                Effect: 'Allow',
                Principal: { AWS: ['*'] },
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${config.minio.bucket}/*`],
            }],
        };
        await minioClient.setBucketPolicy(config.minio.bucket, JSON.stringify(policy));
        log.info('[minio] 桶就绪（公共读）');
    } catch (err) {
        console.warn('[minio] 初始化失败（稍后重试）:', err.message);
    }
}

module.exports = { minioClient, ensure_bucket };
