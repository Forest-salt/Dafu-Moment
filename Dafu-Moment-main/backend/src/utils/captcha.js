/**
 * 图形验证码（03-详细设计 §3/§5.2）：手写 SVG 生成器，零新依赖
 * Redis 键：captcha:{captchaId}，TTL 300 秒；校验后立即删除（一次性，防重放）
 */
const crypto = require('crypto');
const { redis } = require('../db/redis');
const { err } = require('./api-error');

/** 字符集：剔除易混淆的 I/L/O/0/1 */
const CAPTCHA_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** 验证码有效期（秒），对应文档 §3 Redis 键设计 */
const CAPTCHA_TTL_SEC = 300;
/** SVG 画布尺寸 */
const SVG_W = 120;
const SVG_H = 40;

/**
 * 生成 4 位随机验证码文本（密码学随机源）
 * @returns {string}
 */
function gen_captcha_text() {
    let text = '';
    for (let i = 0; i < 4; i++) {
        text += CAPTCHA_CHARS[crypto.randomInt(0, CAPTCHA_CHARS.length)];
    }
    return text;
}

/**
 * 随机 HSL 颜色
 * @param {number} s - 饱和度（%）
 * @param {number} l - 亮度（%）
 * @returns {string} hsl(...) 字符串
 */
function rand_hsl(s, l) {
    return `hsl(${crypto.randomInt(0, 360)}, ${s}%, ${l}%)`;
}

/**
 * 生成 SVG 图片文本：浅色底 + 干扰线 + 逐字符随机字号/偏移/旋转绘制 + 噪点
 * @param {string} text - 验证码文本
 * @returns {string} SVG 字符串
 */
function gen_captcha_svg(text) {
    const parts = [];
    // 浅色底（随机色相、高亮度，保证深色字符可读）
    parts.push(`<rect width="${SVG_W}" height="${SVG_H}" fill="hsl(${crypto.randomInt(0, 360)}, 40%, 95%)"/>`);
    // 干扰线 3 条（随机起止点 + 中饱和度颜色）
    for (let i = 0; i < 3; i++) {
        parts.push(
            `<line x1="${crypto.randomInt(0, SVG_W)}" y1="${crypto.randomInt(0, SVG_H)}"`
            + ` x2="${crypto.randomInt(0, SVG_W)}" y2="${crypto.randomInt(0, SVG_H)}"`
            + ` stroke="${rand_hsl(60, 60)}" stroke-width="1" opacity="0.6"/>`
        );
    }
    // 逐字符绘制：随机基线偏移与 ±22° 旋转提高机器识别成本
    for (let i = 0; i < text.length; i++) {
        const x = 12 + i * 26 + crypto.randomInt(-2, 3);
        const y = 28 + crypto.randomInt(-3, 4);
        const deg = crypto.randomInt(-22, 23);
        const fs = 22 + crypto.randomInt(0, 6);
        parts.push(
            `<text x="${x}" y="${y}" fill="${rand_hsl(65, 32)}" font-size="${fs}"`
            + ` font-family="Georgia, 'Times New Roman', serif" font-weight="bold"`
            + ` transform="rotate(${deg} ${x} ${y})">${text[i]}</text>`
        );
    }
    // 噪点 20 个（半径 1 的小圆）
    for (let i = 0; i < 20; i++) {
        parts.push(
            `<circle cx="${crypto.randomInt(0, SVG_W)}" cy="${crypto.randomInt(0, SVG_H)}"`
            + ` r="1" fill="${rand_hsl(50, 55)}" opacity="0.5"/>`
        );
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}"`
        + ` viewBox="0 0 ${SVG_W} ${SVG_H}">${parts.join('')}</svg>`;
}

/**
 * 生成验证码并写入 Redis（captcha:{id}，TTL 300 秒）
 * Redis 异常直接上抛：无法落库即无法校验，宁可不可用也不放行（fail-closed）
 * @returns {Promise<{captchaId: string, text: string, svg: string}>}
 */
async function create_captcha() {
    const captchaId = crypto.randomUUID();
    const text = gen_captcha_text();
    await redis.set(`captcha:${captchaId}`, text, 'EX', CAPTCHA_TTL_SEC);
    return { captchaId, text, svg: gen_captcha_svg(text) };
}

/**
 * 校验验证码（一次性：读取后无论对错立即 DEL；忽略大小写与首尾空白）
 * Redis 异常按校验失败处理（无法验证即不放行）
 * @param {string} captchaId - 验证码 ID
 * @param {string} code - 用户输入
 * @returns {Promise<boolean>}
 */
async function verify_captcha(captchaId, code) {
    if (typeof captchaId !== 'string' || captchaId.length < 8 || captchaId.length > 64) return false;
    if (typeof code !== 'string' || code.trim().length === 0) return false;
    try {
        const key = `captcha:${captchaId}`;
        const answer = await redis.get(key);
        // 读后即删：无论对错一次性失效
        await redis.del(key);
        return !!answer && answer.toLowerCase() === code.trim().toLowerCase();
    } catch (e) {
        console.warn('[captcha] Redis 不可用，验证码校验失败:', e.message);
        return false;
    }
}

/**
 * 断言验证码通过，否则抛 422 / 业务码 40001
 * @param {string} captchaId
 * @param {string} code
 * @returns {Promise<void>}
 */
async function assert_captcha(captchaId, code) {
    const passed = await verify_captcha(captchaId, code);
    if (!passed) throw err.invalid('验证码错误或已过期');
}

module.exports = { create_captcha, verify_captcha, assert_captcha };
