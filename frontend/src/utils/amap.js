/**
 * 高德 JS API 2.0 公共加载器（r42 起 Leaflet+栅格瓦片全面换官方矢量渲染）：
 * - 矢量地图文字/图标任意缩放锐利，自带中文注记（替代此前手拼的 256px 栅格注记层）
 * - key/安全密钥走 Vite 环境变量（VITE_AMAP_KEY / VITE_AMAP_SECURITY_CODE），不写死在代码里
 * - 安全密钥必须在 loader 触发加载前挂到 window._AMapSecurityConfig（官方 jscode 机制）
 * - 全站共用单例 Promise，避免重复注入脚本
 * 注意：AMap 坐标序为 [lng, lat]（Leaflet 是 [lat, lng]），调用侧务必转换
 */
import AMapLoader from '@amap/amap-jsapi-loader';

window._AMapSecurityConfig = { securityJsCode: import.meta.env.VITE_AMAP_SECURITY_CODE };

let loading = null;

/**
 * 单例加载 AMap 2.0（并发调用共享同一次加载）
 * @returns {Promise<Object>} AMap 命名空间对象
 */
export function load_amap() {
    if (!loading) {
        loading = AMapLoader.load({
            key: import.meta.env.VITE_AMAP_KEY,
            version: '2.0',
            plugins: ['AMap.ToolBar'], // 缩放工具条（2.0 无 Leaflet 式 zoomControl 选项，需显式加控件）
        });
    }
    return loading;
}

/** 校区中心（GCJ-02 火星坐标，AMap [lng, lat] 序：福州大学旗山校区图书馆主馆） */
export const AMAP_CENTER = [119.1961, 26.0568];

/**
 * 生成水滴 pin 的 HTML（前台地图/后台校位图共用同款贴纸语言）
 * @param {Object} [opts]
 * @param {boolean} [opts.on] - 选中态（加深橙）
 * @param {boolean} [opts.gray] - 已下架态（灰身、无脉冲）
 * @returns {string} marker content HTML
 */
export function pin_html({ on = false, gray = false } = {}) {
    const fill = gray ? '#a99a80' : (on ? '#A8720F' : '#C98A1E');
    const pulse = gray ? '' : '<span class="pulse"></span>';
    return `<div class="pin${on ? ' on' : ''}">${pulse}<svg width="30" height="38" viewBox="0 0 30 38"><path d="M15 36 C15 36 27 22.8 27 13.5 A12 12 0 1 0 3 13.5 C3 22.8 15 36 15 36 Z" fill="${fill}" stroke="#fff" stroke-width="2.5"/><circle cx="15" cy="13.5" r="4.6" fill="#fff"/></svg></div>`;
}
