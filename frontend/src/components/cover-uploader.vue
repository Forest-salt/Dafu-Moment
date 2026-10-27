<template>
    <div class="cover-uploader">
        <input ref="file_el" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="on_pick" />

        <!-- 已有封面：缩略图（高 72 紧凑）+ 更换（图标+文字）/ 移除（图标圆钮，淡红贴纸） -->
        <div v-if="url" class="cover-box">
            <img :src="url" alt="封面" :style="{ width: thumb_w + 'px' }" />
            <div class="cover-ops">
                <el-button size="small" round title="更换封面" @click="file_el.click()">
                    <el-icon class="op-ic"><RefreshRight /></el-icon>
                    <span>更换</span>
                </el-button>
                <el-button size="small" round type="danger" class="cover-remove" title="移除封面" @click="remove">
                    <el-icon><Delete /></el-icon>
                </el-button>
            </div>
        </div>

        <!-- 无封面：虚线占位上传区（64px 紧凑） -->
        <label v-else class="cover-add" @click="file_el.click()">
            <el-icon :size="18"><Picture /></el-icon>
            <span>{{ tip }}</span>
            <span class="sub">点击选图 · 支持裁切</span>
        </label>

        <!-- 预设封面：贴纸插画一键选用（无需上传） -->
        <div v-if="presets" class="preset-row">
            <span class="preset-label">预设封面</span>
            <button
                v-for="p in PRESETS" :key="p.key" type="button"
                class="preset-item" :class="{ on: modelValue === p.key }"
                :title="p.name" @click="emit('update:modelValue', p.key)"
            >
                <img :src="p.url" :alt="p.name" />
            </button>
        </div>

        <!-- 裁切弹窗（canvas：拖拽平移 + 滚轮缩放 + 固定比例遮罩） -->
        <el-dialog v-model="crop_open" title="裁切封面" width="560px" :close-on-click-modal="false" append-to-body>
            <canvas
                ref="crop_el"
                class="crop-canvas"
                @pointerdown="on_down"
                @pointermove="on_move"
                @pointerup="on_up"
                @pointercancel="on_up"
                @wheel.prevent="on_wheel"
            ></canvas>
            <div class="crop-tip">拖动调整位置 · 滚轮缩放（或用 ± 按钮） · 虚线框内为保留区域</div>
            <template #footer>
                <el-button round @click="crop_open = false">取消</el-button>
                <el-button round @click="zoom_step(-1)">−</el-button>
                <el-button round @click="zoom_step(1)">＋</el-button>
                <el-button round type="primary" :loading="uploading" @click="do_crop">确认上传</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
/**
 * CoverUploader：单图封面上传 + Canvas 裁切（贴纸主题）
 * 流程：选图 → 裁切弹窗（拖拽平移/滚轮缩放/固定比例 cover 约束）→ 输出压缩 JPEG → scene=cover 上传
 * v-model：objectKey（string | null）；ratio 为输出宽高比（如 16/9、1）
 */
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { Picture, RefreshRight, Delete } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { api_upload } from '../api';
import { cover_url } from '../utils/format';

const props = defineProps({
    modelValue: { type: String, default: null }, // objectKey 或 preset:xxx
    ratio: { type: Number, default: 16 / 9 },    // 裁切输出比例
    tip: { type: String, default: '上传封面图' },
    presets: { type: Boolean, default: true },   // 是否显示预设封面网格（头像等 1:1 场景关闭）
});
const emit = defineEmits(['update:modelValue']);

/* 预设封面：/preset-cover 静态贴纸插画（16:9），key 以 preset: 前缀存库（16 款覆盖全品类） */
const PRESETS = [
    { key: 'preset:rice', name: '米饭', url: '/preset-cover/rice.svg' },
    { key: 'preset:noodle', name: '粉面', url: '/preset-cover/noodle.svg' },
    { key: 'preset:baozi', name: '面点', url: '/preset-cover/baozi.svg' },
    { key: 'preset:dumpling', name: '饺子', url: '/preset-cover/dumpling.svg' },
    { key: 'preset:porridge', name: '粥品', url: '/preset-cover/porridge.svg' },
    { key: 'preset:wok', name: '炒菜', url: '/preset-cover/wok.svg' },
    { key: 'preset:bbq', name: '烧烤', url: '/preset-cover/bbq.svg' },
    { key: 'preset:hotpot', name: '麻辣烫', url: '/preset-cover/hotpot.svg' },
    { key: 'preset:burger', name: '汉堡', url: '/preset-cover/burger.svg' },
    { key: 'preset:chicken', name: '炸鸡', url: '/preset-cover/chicken.svg' },
    { key: 'preset:fries', name: '小吃', url: '/preset-cover/fries.svg' },
    { key: 'preset:salad', name: '轻食', url: '/preset-cover/salad.svg' },
    { key: 'preset:milktea', name: '奶茶', url: '/preset-cover/milktea.svg' },
    { key: 'preset:coffee', name: '咖啡', url: '/preset-cover/coffee.svg' },
    { key: 'preset:dessert', name: '甜品', url: '/preset-cover/dessert.svg' },
    { key: 'preset:fruit', name: '水果', url: '/preset-cover/fruit.svg' },
];

const file_el = ref(null);
const crop_el = ref(null);
const crop_open = ref(false);
const uploading = ref(false);

const url = computed(() => cover_url(props.modelValue));
/** 缩略图宽：高固定 72，宽按裁切比例（16:9→128、1:1→72），窄图省空间 */
const thumb_w = computed(() => Math.min(136, Math.round(72 * props.ratio)));

// 裁切交互状态：源图 / 缩放 / 偏移（视口左上角在图坐标系的位置，cover 约束内）
let img = null;
let scale = 1;
let min_scale = 1;
let off = { x: 0, y: 0 };
let dragging = false;
let last_pt = { x: 0, y: 0 };

/** 视口 CSS 尺寸：宽撑满弹窗，但高不超过视口 48%（1:1 方图矮屏防溢出，宽高等比收） */
function viewport_size() {
    const el = crop_el.value;
    if (!el) return { w: 0, h: 0 };
    const maxH = Math.round(window.innerHeight * 0.48);
    const w = Math.min(el.clientWidth || 0, Math.round(maxH * props.ratio));
    return { w, h: Math.round(w / props.ratio) };
}

/**
 * 选图：校验 → 读 dataURL → 打开裁切弹窗
 * @param {Event} e
 */
async function on_pick(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { ElMessage.warning('原图请小于 8MB'); return; }
    const data_url = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(file);
    });
    img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = data_url; });
    crop_open.value = true;
}

// 弹窗打开后（DOM 就绪）初始化视口与 fit 缩放
watch(crop_open, async (v) => {
    if (!v) return;
    await nextTick();
    const el = crop_el.value;
    if (!el || !img) return;
    const { w, h } = viewport_size();
    el.width = w;
    el.height = h;
    el.style.width = `${w}px`; // 内部像素与 CSS 宽同步，防止 100% 拉伸变形
    fit_view();
    draw();
});

/** 初始 cover 适配：铺满视口的最小缩放并居中 */
function fit_view() {
    const { w, h } = viewport_size();
    if (!w || !img) return;
    min_scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    scale = min_scale;
    off = { x: (w - img.naturalWidth * scale) / 2, y: (h - img.naturalHeight * scale) / 2 };
}

/** cover 约束：图片不许露出视口边缘 */
function clamp_off() {
    const { w, h } = viewport_size();
    off.x = Math.min(0, Math.max(w - img.naturalWidth * scale, off.x));
    off.y = Math.min(0, Math.max(h - img.naturalHeight * scale, off.y));
}

/** 主绘制：图 + 牛皮纸色遮罩 + 虚线保留框 + 三分辅助线 */
function draw() {
    const el = crop_el.value;
    if (!el || !img) return;
    const ctx = el.getContext('2d');
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.drawImage(img, off.x, off.y, img.naturalWidth * scale, img.naturalHeight * scale);
    // 遮罩：视口四周 45% 墨咖啡
    ctx.fillStyle = 'rgba(61, 47, 30, 0.45)';
    const inset = Math.round(Math.min(el.width, el.height) * 0.06);
    const fx = inset, fy = inset, fw = el.width - inset * 2, fh = el.height - inset * 2;
    ctx.fillRect(0, 0, el.width, fy);
    ctx.fillRect(0, fy + fh, el.width, el.height - fy - fh);
    ctx.fillRect(0, fy, fx, fh);
    ctx.fillRect(fx + fw, fy, el.width - fx - fw, fh);
    // 虚线保留框 + 三分线
    ctx.strokeStyle = '#FFFDF4';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.strokeRect(fx, fy, fw, fh);
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 253, 244, 0.5)';
    for (let i = 1; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(fx + (fw * i) / 3, fy); ctx.lineTo(fx + (fw * i) / 3, fy + fh); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(fx, fy + (fh * i) / 3); ctx.lineTo(fx + fw, fy + (fh * i) / 3); ctx.stroke();
    }
}

/**
 * 拖拽平移（pointer capture，鼠标/触摸通吃）
 */
function on_down(e) {
    if (!img) return;
    dragging = true;
    last_pt = { x: e.clientX, y: e.clientY };
    e.target.setPointerCapture(e.pointerId);
}
function on_move(e) {
    if (!dragging) return;
    off.x += e.clientX - last_pt.x;
    off.y += e.clientY - last_pt.y;
    last_pt = { x: e.clientX, y: e.clientY };
    clamp_off();
    draw();
}
function on_up() { dragging = false; }

/**
 * 滚轮缩放（以指针为焦点）
 * @param {WheelEvent} e
 */
function on_wheel(e) {
    if (!img) return;
    const el = crop_el.value;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const next = Math.min(min_scale * 6, Math.max(min_scale, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    if (next === scale) return;
    off.x = px - ((px - off.x) * next) / scale;
    off.y = py - ((py - off.y) * next) / scale;
    scale = next;
    clamp_off();
    draw();
}

/** ± 按钮等比缩放（视口中心为焦点，移动端兜底） */
function zoom_step(dir) {
    if (!img) return;
    const el = crop_el.value;
    const cx = el.width / 2, cy = el.height / 2;
    const next = Math.min(min_scale * 6, Math.max(min_scale, scale * (dir > 0 ? 1.2 : 1 / 1.2)));
    if (next === scale) return;
    off.x = cx - ((cx - off.x) * next) / scale;
    off.y = cy - ((cy - off.y) * next) / scale;
    scale = next;
    clamp_off();
    draw();
}

/** 确认裁切：视口映射回源图坐标 → 输出压缩 JPEG → 上传 */
async function do_crop() {
    if (!img || uploading.value) return;
    uploading.value = true;
    try {
        const { w, h } = viewport_size();
        const out_w = props.ratio >= 1 ? 1280 : 960; // 1:1 方图降宽控体积
        const out_h = Math.round(out_w / props.ratio);
        const out = document.createElement('canvas');
        out.width = out_w;
        out.height = out_h;
        const octx = out.getContext('2d');
        octx.imageSmoothingQuality = 'high';
        // 视口 → 源图区域（inset 内框为最终保留区）
        const inset = Math.round(Math.min(w, h) * 0.06);
        const sx = (-off.x + inset) / scale;
        const sy = (-off.y + inset) / scale;
        const sw = (w - inset * 2) / scale;
        const sh = (h - inset * 2) / scale;
        octx.drawImage(img, sx, sy, sw, sh, 0, 0, out_w, out_h);
        const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', 0.85));
        const fd = new FormData();
        fd.append('file', blob, 'cover.jpg');
        fd.append('scene', 'cover');
        const data = await api_upload.image(fd);
        emit('update:modelValue', data.objectKey);
        crop_open.value = false;
        ElMessage.success('封面已上传');
    } catch { /* 拦截器已提示（含 409 判重） */ } finally {
        uploading.value = false;
    }
}

/** 移除封面（仅清引用，MinIO 对象不删） */
function remove() {
    emit('update:modelValue', null);
}

onBeforeUnmount(() => { dragging = false; });
</script>

<style scoped>
.cover-uploader { width: 100%; }
.cover-box { display: flex; gap: 12px; align-items: center; }
.cover-box img {
    height: 72px; object-fit: cover; border-radius: 8px;
    border: 2px solid var(--ink); box-shadow: 0 2.5px 0 var(--ink); background: var(--paper);
}
.cover-ops { display: flex; gap: 6px; }
.cover-ops .op-ic { margin-right: 3px; }
/* 移除圆钮：图标-only 紧凑（淡红贴纸 chip 由全局 danger 主题提供） */
.cover-remove { padding: 5px 9px; }
.cover-add {
    width: 100%; height: 64px; border: 2px dashed rgba(61, 47, 30, 0.35); border-radius: 10px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    color: var(--ink-2); cursor: pointer; font-size: 13px; background: var(--paper);
    transition: border-color .12s ease, color .12s ease;
}
.cover-add:hover { border-color: var(--brand); color: var(--brand); }
.cover-add .sub { font-size: 11px; opacity: 0.75; }
/* 预设封面网格：迷你贴纸缩略块，选中加贴纸黄描边 */
.preset-row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.preset-label { font-size: 11px; color: var(--ink-2); font-weight: 600; margin-right: 2px; flex-shrink: 0; }
.preset-item {
    height: 34px; width: 60px; padding: 0; cursor: pointer; overflow: hidden;
    border: 2px solid var(--ink); border-radius: 7px; background: var(--paper);
    box-shadow: 0 2px 0 var(--ink); transition: transform .1s ease, box-shadow .1s ease;
}
.preset-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
.preset-item:hover { transform: translateY(-2px); }
.preset-item.on { box-shadow: 0 2px 0 var(--ink), 0 0 0 2.5px var(--sun); }
/* 窄屏：占位区文字换行紧凑排布 */
@media (max-width: 520px) {
    .cover-add { flex-wrap: wrap; gap: 3px 8px; padding: 8px 10px; justify-content: center; }
    .cover-box { flex-wrap: wrap; }
}
.crop-canvas {
    width: 100%; margin: 0 auto; border-radius: 10px; border: 2px solid var(--ink);
    background: var(--page); touch-action: none; cursor: grab; display: block;
}
.crop-canvas:active { cursor: grabbing; }
.crop-tip { font-size: 12px; color: var(--ink-2); margin-top: 8px; text-align: center; }
</style>
