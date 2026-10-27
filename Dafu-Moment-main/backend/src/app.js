/**
 * Express 应用装配
 */
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { not_found, error_handler } = require('./middleware/error');
const { minioClient } = require('./db/minio');
const config = require('./config');

/**
 * 创建应用实例
 * @returns {express.Express}
 */
function create_app() {
    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '1mb' }));

    // /img/<objectKey> → MinIO 流式代理（本地开发用；生产由 Nginx 直连）
    app.get('/img/*', async (req, res) => {
        const key = req.params[0];
        try {
            const stream = await minioClient.getObject(config.minio.bucket, key);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            stream.pipe(res);
        } catch {
            // 统一业务码口径：40401（禁止旁路写死 HTTP body code）
            res.status(404).json({ code: 40401, msg: '图片不存在' });
        }
    });

    app.use('/api', routes);
    app.use(not_found());
    app.use(error_handler());
    return app;
}

module.exports = { create_app };
