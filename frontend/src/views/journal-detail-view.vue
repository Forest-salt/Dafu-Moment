<template>
    <div class="page-wrap journal">
        <!-- 顶部标题栏：返回 + 标题 + 仅自己可见 -->
        <div class="topbar">
            <span class="icircle back" aria-label="返回" @click="go_back">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
            </span>
            <b class="t-title">手账详情</b>
            <span class="t-right">仅自己可见</span>
        </div>

        <!-- ============ 后端手账：贴纸排版画布渲染 ============ -->
        <template v-if="rec && rec.layout">
            <div class="card j-card fade-up">
                <span class="washtape"></span>
                <div class="head-row">
                    <b class="j-date">{{ cn_date(rec.date) }} · {{ rec.title }}</b>
                    <span class="chip">私有</span>
                </div>
                <!-- 画布渲染：与编辑器同口径等比缩放（只读） -->
                <div class="mini-stage">
                    <div class="paper" :class="`bg-${rec.bg}`" :style="[rec.bg === 3 && rec.bg_src ? { background: `#FFFDF5 url(${rec.bg_src}) center / cover no-repeat` } : {}, { transform: `scale(${mini_scale})` }]">
                        <div
                            v-for="(b, i) in rec.layout" :key="i" class="blk"
                            :style="blk_style(b)"
                        >
                            <img v-if="b.kind === 'sticker'" :src="b.src" alt="" />
                            <span v-else class="txt" :style="{ color: `#${b.color}`, fontSize: `${b.size}px` }">{{ b.text }}</span>
                        </div>
                        <span class="date-stamp">{{ rec.date }}<i>大福食刻 · 手账</i></span>
                    </div>
                </div>
                <!-- 随笔正文 -->
                <p v-if="rec.text" class="j-content">{{ rec.text }}</p>
            </div>
            <p class="privacy-tip">手账默认仅自己可见；转成社区帖子后会进入审核，通过前不在点评圈展示。</p>
            <div class="hold"></div>
            <div class="actionbar">
                <button class="ghost-btn" @click="to_edit">编辑手账</button>
                <button class="ghost-btn" @click="to_draft">转为社区帖子草稿</button>
                <button class="danger-btn" @click="do_delete">删除</button>
            </div>
        </template>

        <!-- ============ 兼容：打卡流水手账（拍立得形式） ============ -->
        <template v-else-if="rec">
            <div class="card j-card fade-up">
                <span class="washtape"></span>
                <div v-if="img_list.length" class="slider">
                    <div v-for="(img, i) in img_list" :key="i" class="slide">
                        <img :src="img" alt="手账照片" @error="on_img_error($event, i)" />
                    </div>
                </div>
                <div v-else class="slider">
                    <div class="slide img-fallback big"><span>{{ (rec.dishes[0]?.name || '大福').slice(0, 1) }}</span></div>
                </div>
                <div v-if="img_list.length > 1" class="slide-count">1 / {{ img_list.length }} 左右滑动查看</div>
                <div class="head-row">
                    <b class="j-date">{{ cn_date(rec.date) }} · {{ rec.meal }}</b>
                    <span class="chip">私有</span>
                </div>
                <div class="shop-row">
                    <span>{{ rec.canteenName }} · 约 {{ rec.kcal }} 千卡 · ¥{{ total_price }}</span>
                </div>
                <p class="j-content">{{ rec.note || '这一顿没有写什么，味道都记在照片里了。' }}</p>
                <div v-if="rec.dishes.length" class="dish-row">
                    <span v-for="d in rec.dishes" :key="d.name" class="chip">{{ d.name }} ¥{{ d.price }}</span>
                </div>
            </div>
            <p class="privacy-tip">手账默认仅自己可见；转成社区帖子后会进入审核，通过前不在点评圈展示。</p>
            <div class="hold"></div>
            <div class="actionbar">
                <button class="ghost-btn" @click="to_draft">转为社区帖子草稿</button>
                <button class="danger-btn" @click="del_checkin">删除</button>
            </div>
        </template>
    </div>
</template>

<script setup>
/**
 * 手账详情页（r52 升级）：
 *  - 后端手账（手账编辑器作品）：等比渲染排版画布（贴纸/文字块）+ 随笔 + 编辑/转草稿/删除
 *  - 兼容旧打卡流水手账（拍立得形式渲染，localStorage 数据）
 */
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api_journal } from '../api';

const route = useRoute();
const router = useRouter();

/* ---------------- 状态 ---------------- */

const rec = ref(null); // 手账记录（后端手账含 layout；打卡流水无）
const broken = ref(new Set()); // 加载失败图片下标（blob 预览过期兜底）
const mini_scale = ref(0.4); // 画布等比缩放（容器宽 / 750）

const CANVAS_W = 750;

/** 打卡流水兼容：展示图列表 */
const img_list = computed(() => {
    const list = rec.value?.photos?.length ? rec.value.photos : (rec.value?.dishes?.[0]?.img ? [rec.value.dishes[0].img] : []);
    return list.filter((_, i) => !broken.value.has(i));
});

/** 打卡流水兼容：菜品总价 */
const total_price = computed(() => (rec.value?.dishes || []).reduce((s, d) => s + (d.price || 0), 0));

/* ---------------- 画布渲染 ---------------- */

/**
 * 块定位样式（与编辑器同口径）
 * @param {object} b 排版块
 */
function blk_style(b) {
    return {
        left: `${b.x}px`,
        top: `${b.y}px`,
        width: `${b.w}px`,
        zIndex: b.z || 1,
        transform: `rotate(${b.rot || 0}deg)`,
    };
}

/** 画布等比缩放适配容器 */
function fit_scale() {
    const stage = document.querySelector('.mini-stage');
    if (stage) mini_scale.value = Math.min(1, (stage.clientWidth - 8) / CANVAS_W);
}

/* ---------------- 生命周期 ---------------- */

onMounted(async () => {
    // 优先后端手账（编辑器作品）；404 回退打卡流水（localStorage）
    try {
        const r = await api_journal.get(route.params.id);
        rec.value = r;
        await nextTick(fit_scale);
        window.addEventListener('resize', fit_scale);
    } catch {
        const list = JSON.parse(localStorage.getItem('dafu_checkins') || '[]');
        rec.value = list.find((c) => String(c.id) === String(route.params.id)) || null;
        if (!rec.value) {
            ElMessage.error('手账不存在');
            router.replace('/footprint');
        }
    }
});

/* ---------------- 交互 ---------------- */

/** 返回上一页 */
function go_back() {
    router.back();
}

/** 编辑手账 → 编辑器 */
function to_edit() {
    router.push(`/journal/edit/${rec.value.id}`);
}

/** 图片加载失败（blob 预览过期）时移除该图 */
function on_img_error(e, i) {
    broken.value.add(i);
    e.target.style.display = 'none';
}

/** 转为社区帖子草稿：进入公开审核流程 */
function to_draft() {
    ElMessage.success('手账已转为社区帖子草稿，发布后将进入公开审核流程');
    router.push({ path: '/post-publish', query: { from: 'journal', journalId: String(rec.value.id) } });
}

/**
 * 删除后端手账：确认后调用接口并返回足迹列表
 */
async function do_delete() {
    try {
        await ElMessageBox.confirm('删除后这篇手账就找不回来了，确定删除吗？', '删除手账', {
            confirmButtonText: '删除', cancelButtonText: '再想想', type: 'warning',
        });
    } catch {
        return;
    }
    await api_journal.remove(rec.value.id);
    ElMessage.success('手账已删除');
    router.replace('/footprint');
}

/**
 * 删除打卡流水手账（旧数据兼容）
 */
async function del_checkin() {
    try {
        await ElMessageBox.confirm('删除后这条手账就找不回来了，确定删除吗？', '删除手账', {
            confirmButtonText: '删除', cancelButtonText: '再想想', type: 'warning',
        });
    } catch {
        return;
    }
    const list = JSON.parse(localStorage.getItem('dafu_checkins') || '[]').filter((c) => String(c.id) !== String(rec.value.id));
    localStorage.setItem('dafu_checkins', JSON.stringify(list));
    ElMessage.success('手账已删除');
    router.replace('/footprint');
}

/* ---------------- 工具 ---------------- */

/**
 * 日期转中文展示（10 月 3 日）
 * @param {string} date YYYY-MM-DD
 * @returns {string} 中文日期
 */
function cn_date(date) {
    const [, m, d] = String(date).split('-');
    return `${Number(m)} 月 ${Number(d)} 日`;
}
</script>

<style scoped>
/* 顶部标题栏 */
.topbar { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; min-height: 44px; }
.t-title { font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }
.t-right { font-size: 10px; color: var(--ink-2); }
.icircle.back { color: var(--ink); }

/* 手账卡（拍立得/画布共用外壳） */
.j-card { margin-top: 16px; padding: 12px 12px 14px; position: relative; }
.washtape {
    position: absolute; top: -7px; left: 50%; transform: translateX(-50%) rotate(-2deg);
    width: 70px; height: 16px; background: rgba(201, 138, 30, 0.35); border-radius: 3px;
}

/* 日期行 + 私有签 */
.head-row { display: flex; align-items: baseline; justify-content: space-between; margin-top: 4px; }
.j-date { font-size: 15px; }

/* 画布只读渲染（等比缩放容器：外层量宽，内层 750×1000 缩放） */
.mini-stage { display: flex; justify-content: center; margin-top: 12px; overflow: hidden; }
.paper {
    position: relative; width: 750px; height: 1000px; flex-shrink: 0;
    transform-origin: top left; border-radius: 12px; overflow: hidden;
    border: 1px solid var(--paper-line); box-shadow: var(--shadow-soft);
}
.paper.bg-0 { background: #FFFDF5 linear-gradient(var(--paper-line) 1px, transparent 1px), linear-gradient(90deg, var(--paper-line) 1px, transparent 1px); background-size: 40px 40px; background-position: 10px 10px; }
.paper.bg-1 { background: #FFFDF5 radial-gradient(rgba(201,138,30,0.22) 1.6px, transparent 1.6px); background-size: 40px 40px; background-position: 10px 10px; }
.paper.bg-2 { background: #EFE0C3; }
.paper.bg-2::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: repeating-linear-gradient(transparent 0 47px, rgba(122,88,44,0.16) 47px 48px);
}
.date-stamp {
    position: absolute; right: 22px; bottom: 18px; z-index: 0;
    font-size: 16px; font-weight: 700; color: rgba(58,46,26,0.55);
    text-align: right; display: flex; flex-direction: column; align-items: flex-end;
}
.date-stamp i { font-style: normal; font-size: 10px; font-weight: 600; color: rgba(58,46,26,0.35); margin-top: 2px; }
.blk { position: absolute; }
.blk img { display: block; width: 100%; filter: drop-shadow(0 4px 8px rgba(58,46,26,0.18)); }
.blk .txt {
    display: block; background: #FFFEF7; border: 1.5px solid #EAD9B4; border-radius: 12px;
    box-shadow: 0 4px 10px rgba(58,46,26,0.16); padding: 10px 14px;
    font-family: 'Kaiti SC', 'STKaiti', 'KaiTi', serif; font-weight: 700; line-height: 1.5; word-break: break-all;
}

/* 随笔正文 */
.j-content { font-size: 12.5px; line-height: 1.85; color: #5C4A2E; margin: 12px 0 0; }
.dish-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }

/* 打卡流水兼容：多图横滑 */
.slider { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 8px; border-radius: 10px; }
.slider::-webkit-scrollbar { height: 4px; }
.slide { flex: 0 0 100%; scroll-snap-align: center; height: 210px; border-radius: 10px; overflow: hidden; }
.slide img { width: 100%; height: 100%; object-fit: cover; display: block; }
.slide.big { height: 210px; font-size: 30px; }
.slide-count { font-size: 10px; color: var(--ink-2); text-align: center; margin-top: 6px; }
.shop-row { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ink-2); margin-top: 5px; }

/* 隐私说明 */
.privacy-tip { font-size: 10px; color: var(--ink-2); margin-top: 12px; line-height: 1.7; }
.hold { height: 20px; }

/* 底部操作按钮 */
.actionbar { display: flex; gap: 10px; margin-top: 20px; }
.ghost-btn {
    flex: 1; height: 42px; border-radius: var(--radius-sm);
    background: var(--paper); color: var(--ink-3);
    border: 1px solid var(--line); font-size: 13px; font-weight: 700; cursor: pointer;
    transition: background .12s ease; white-space: nowrap; /* 按钮文字不折行 */
}
.ghost-btn:hover { background: #FBF3DC; }
.danger-btn {
    flex: 1; height: 42px; border-radius: var(--radius-sm);
    background: #fdecec; color: var(--bad); border: none;
    font-size: 13px; font-weight: 700; cursor: pointer;
    transition: background .12s ease; white-space: nowrap;
}
.danger-btn:hover { background: #fbdcdc; }

/* ===== 桌面适配（≥769）===== */
@media (min-width: 769px) {
    .page-wrap { max-width: 760px; }
    .slide, .slide.big { height: 300px; }
}
</style>
