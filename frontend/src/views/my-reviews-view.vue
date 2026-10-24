<template>
    <div class="page-wrap myreviews-page">
        <!-- 标题行：返回 + 居中标题 + 右侧统计（P23） -->
        <div class="titlebar">
            <button class="icircle back" aria-label="返回" @click="go_back">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <b class="title">我的点评</b>
            <span class="total">共 {{ reviews.length }} 条</span>
        </div>

        <!-- 点评卡列表 -->
        <template v-if="reviews.length">
            <div
                v-for="(r, i) in reviews" :key="r.id"
                class="card revcard fade-up" :style="{ animationDelay: `${i * 0.04}s` }"
                @click="go_detail(r)"
            >
                <p class="body">{{ r.content || '（纯图点评）' }}</p>
                <div class="urow">
                    <span class="st">★ {{ fmt_score(r.overallScore) }}</span>
                    <span class="meta">{{ r.subjectName }} · {{ time_ago(r.createdAt) }}</span>
                    <span class="like">
                        <img src="/assets/icons/icon-like.png" alt="赞" />
                        {{ r.upCount || 0 }}
                    </span>
                </div>
                <!-- 状态签（展示中 / 审核中 / 已下架 / 已驳回+原因） -->
                <div class="srow">
                    <span class="state" :class="STATUS_CLS[r.status]">{{ STATUS_TEXT[r.status] || '审核中' }}</span>
                    <span v-if="r.status === 3 && r.statusReason" class="reason">原因：{{ r.statusReason }}</span>
                </div>
                <div class="ops">
                    <span @click.stop="go_detail(r)">查看</span>
                    <span @click.stop="go_edit(r)">编辑</span>
                    <span class="del" @click.stop="do_delete(r)">删除</span>
                </div>
            </div>
            <div class="foot-hint">「编辑」将进入发布页修改后重新提交；删除后可重新发布，已获金币不追回。</div>
        </template>

        <!-- 空态 -->
        <div v-else class="empty fade-up">
            <img src="/assets/spare/R21.png" alt="空空如也" />
            <p>还没有发过点评，去写下第一条吧</p>
            <button class="btn-primary go-write" @click="$router.push('/publish')">写点评</button>
        </div>
    </div>
</template>

<script setup>
/**
 * 我的点评（/my-reviews）：对齐 P23 原型
 * - 接 api_review.my_reviews()，接口失败或空数据展示空态（不使用页内假数据）
 * - 卡片：内容摘要 / ★分 + 对象名·时间 / 点赞数 / 状态签（含驳回原因）/ 操作
 * - 操作：查看 → 点评详情；编辑 → /publish 编辑模式；删除 → 二次确认后 api_review.remove
 */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api_review } from '../api';
import { fmt_score, time_ago } from '../utils/format';

const router = useRouter();

/** 状态文案（对齐任务口径：展示中 / 审核中 / 已下架 / 已驳回） */
const STATUS_TEXT = { 0: '展示中', 1: '审核中', 2: '已下架', 3: '已驳回' };
/** 状态签配色：绿 / 淡金 / 灰 / 红 */
const STATUS_CLS = { 0: 'ok', 1: 'wait', 2: 'off', 3: 'bad' };

const reviews = ref([]);

/**
 * 点评详情链接：有真实点评 id 走 /post/:id（post 详情按点评 id 查询），否则按点位类型跳档口/菜品/食堂
 * @param {Object} r
 * @returns {string}
 */
function object_link(r) {
    if (r.id) return `/post/${r.id}`;
    const t = Number(r.subjectType);
    const id = r.subjectId;
    return t === 0 ? `/dish/${id}` : t === 1 ? `/station/${id}` : `/canteen/${id}`;
}

/**
 * 查看详情 → 对象页 / 点评详情
 * @param {Object} r
 */
function go_detail(r) {
    router.push(object_link(r));
}

/**
 * 编辑 → 发布页编辑模式（回填该条点评）
 * @param {Object} r
 */
function go_edit(r) {
    router.push({ path: '/publish', query: { reviewId: r.id } });
}

/**
 * 删除点评：二次确认后调 api_review.remove，成功后才移除本地行（失败由拦截器提示）
 * @param {Object} r
 */
async function do_delete(r) {
    try {
        await ElMessageBox.confirm(
            '删除后不可恢复；已获金币不追回，相关统计成就同步扣减（不低于 0）。',
            '删除这条点评？',
            { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' }
        );
    } catch { return; }
    try {
        await api_review.remove(r.id);
    } catch {
        return;
    }
    reviews.value = reviews.value.filter((x) => x.id !== r.id);
    ElMessage.success('已删除');
}

/**
 * 返回上一页
 */
function go_back() {
    router.back();
}

/**
 * 装载我的点评：接 api_review.my_reviews()，接口失败或空数据均为空态
 */
async function load_reviews() {
    try {
        const list = await api_review.my_reviews();
        reviews.value = Array.isArray(list) ? list : [];
    } catch {
        reviews.value = [];
    }
}

onMounted(load_reviews);
</script>

<style scoped>
/* 标题行：返回浮钮 + 居中标题 + 右侧统计 */
.titlebar {
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}
.back { position: absolute; left: 0; }
.title { font-size: 16px; font-weight: 700; }
.total { position: absolute; right: 0; font-size: 10px; color: var(--ink-2); }

/* 点评卡（P23）：无框卡 + 弥散阴影，逐张纵排 */
.card.revcard { margin-top: 10px; cursor: pointer; }
.body { font-size: 12.5px; line-height: 1.7; margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.urow { display: flex; align-items: center; gap: 7px; margin-top: 10px; }
.st { color: var(--star); font-size: 11px; font-weight: 700; }
.meta { font-size: 10px; color: var(--ink-2); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.like { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--ink-2); flex-shrink: 0; }
.like img { width: 15px; height: 15px; object-fit: contain; }

/* 状态行：状态签 + 驳回原因 */
.srow { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.state { font-size: 9px; padding: 3px 9px; border-radius: var(--radius-sm); font-weight: 700; flex-shrink: 0; }
.state.ok { background: #E8F3E4; color: #3E7C3A; }
.state.wait { background: #FBF0D8; color: #A06A10; }
.state.off { background: #F1E7D0; color: var(--ink-2); }
.state.bad { background: #FDEEEA; color: #B03A2E; }
.reason { font-size: 10px; color: var(--bad); min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 操作行：查看 / 编辑 / 删除 */
.ops { display: flex; gap: 14px; margin-top: 9px; font-size: 10.5px; color: var(--ink-2); }
.ops span { cursor: pointer; transition: color .12s ease; }
.ops span:hover { color: var(--brand-dark); }
.ops .del:hover { color: var(--bad); }

/* 空态插画 */
.empty { text-align: center; padding: 40px 0 12px; }
.empty img { width: 180px; margin: 0 auto; opacity: .9; }
.empty p { font-size: 12px; color: var(--ink-2); margin-top: 10px; }
.go-write { margin-top: 14px; }

.foot-hint { text-align: center; font-size: 10px; color: var(--ink-2); margin-top: 14px; }

/* ===== 桌面适配（≥769）：整页限宽 800 居中，列表保持单列纵排 ===== */
@media (min-width: 769px) {
    /* 我的点评是个人管理型窄列：限宽 800 居中（覆盖 .page-wrap 桌面 1080 档），卡片流不分列 */
    .myreviews-page { max-width: 800px; }
    /* 卡片桌面加大内边距与正文字号，长文更易读 */
    .card.revcard { padding: 16px 18px; }
    .body { font-size: 13px; }
}

/* ===== 桌面适配（≥1200）：正文再放大一档 ===== */
@media (min-width: 1200px) {
    /* 超宽屏：正文与元信息再升一档字号 */
    .body { font-size: 13.5px; }
    .meta { font-size: 11px; }
}
</style>
