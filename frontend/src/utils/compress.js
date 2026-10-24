/**
 * 前端图片压缩：Canvas 重绘至长边 ≤1280px、JPEG q=0.8（04 §五.1）
 */

/**
 * 压缩图片文件为 JPEG Blob
 * @param {File} file - 原始文件
 * @param {number} maxSide - 长边上限
 * @param {number} quality - JPEG 质量
 * @returns {Promise<Blob>}
 */
export function compress_image(file, maxSide = 1280, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            try {
                let { width, height } = img;
                const scale = Math.min(1, maxSide / Math.max(width, height));
                width = Math.round(width * scale);
                height = Math.round(height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(url);
                    resolve(blob || file);
                }, 'image/jpeg', quality);
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('图片解码失败'));
        };
        img.src = url;
    });
}
