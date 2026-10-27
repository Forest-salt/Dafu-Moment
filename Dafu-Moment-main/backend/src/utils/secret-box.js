/**
 * 密钥保险箱（r46 起）：用户 API 密钥 AES-256-GCM 对称加密后落库
 * 安全口径：
 *  - 数据库中只存密文（iv + authTag + ciphertext 合并 base64），任何人直接查库看不到明文
 *  - 解密密钥由环境变量 AI_ENC_KEY 派生（未配置时从 JWT 密钥派生兜底），仅存在于应用进程内存
 *  - 明文只在服务端调用 LLM 的瞬间解密使用，任何接口都不回传明文（前端仅掩码回显）
 */
const crypto = require('crypto');
const config = require('../config');

// 加密主密钥：sha256(AI_ENC_KEY || jwt_secret) → 32 字节（AES-256）
const MASTER_KEY = crypto.createHash('sha256')
    .update(String(process.env.AI_ENC_KEY || config.jwt_secret))
    .digest();

/**
 * 加密明文密钥 → base64 密文（12 字节随机 iv + 16 字节 authTag + 密文体）
 * @param {string} plain - 明文 API 密钥
 * @returns {string} base64 密文（落库值）
 */
function encrypt_secret(plain) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
    const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    // 输出布局：iv(12) + authTag(16) + ciphertext
    return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

/**
 * 解密库内密文 → 明文密钥（仅 ask 链路内部调用）
 * @param {string} payload - encrypt_secret 产出的 base64 密文
 * @returns {string} 明文密钥（损坏/被篡改时抛错并返回空串，走降级）
 */
function decrypt_secret(payload) {
    try {
        const buf = Buffer.from(String(payload || ''), 'base64');
        if (buf.length < 12 + 16) return '';
        const iv = buf.subarray(0, 12);
        const tag = buf.subarray(12, 28);
        const data = buf.subarray(28);
        const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch {
        // 密文损坏或主密钥更换 → 返回空串，上层按「未配置」降级，不阻塞问答
        return '';
    }
}

module.exports = { encrypt_secret, decrypt_secret };
