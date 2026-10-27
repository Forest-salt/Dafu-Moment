/**
 * dHash 感知哈希自实现（03 §四.6，~30 行，答辩可讲）
 * 流程：Jimp 解码 → 缩放 9×8 灰度 → 相邻像素横向比较 → 64bit → BINARY(8)
 */
const Jimp = require('jimp');

/**
 * 计算图片 buffer 的 dHash（64bit）
 * @param {Buffer} buf - 图片字节
 * @returns {Promise<{bin: Buffer, hex: string}>}
 */
async function dhash(buf) {
    const img = await Jimp.read(buf);
    img.resize(9, 8).greyscale();
    const bits = [];
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            // 左像素 > 右像素 记 1（横向梯度）
            const left = Jimp.intToRGBA(img.getPixelColor(x, y)).r;
            const right = Jimp.intToRGBA(img.getPixelColor(x + 1, y)).r;
            bits.push(left > right ? 1 : 0);
        }
    }
    // 64 bit → 8 字节
    const bin = Buffer.alloc(8);
    bits.forEach((b, i) => {
        if (b) bin[i >> 3] |= 1 << (i & 7);
    });
    return { bin, hex: bin.toString('hex') };
}

/**
 * 汉明距离：XOR + popcount
 * @param {Buffer} a - 哈希 A
 * @param {Buffer} b - 哈希 B
 * @returns {number}
 */
function hamming(a, b) {
    let dist = 0;
    for (let i = 0; i < a.length; i++) {
        let x = a[i] ^ b[i];
        while (x) {
            dist += x & 1;
            x >>= 1;
        }
    }
    return dist;
}

/**
 * 校验 magic number（防改后缀），白名单 jpeg/png/webp
 * @param {Buffer} buf - 文件字节
 * @returns {string|null} 类型名，不合法返回 null
 */
function sniff_image_type(buf) {
    if (!buf || buf.length < 12) return null;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
    if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
    return null;
}

module.exports = { dhash, hamming, sniff_image_type };
