<template>
    <div class="page-wrap drafts-page">
        <!-- 标题行：返回 + 居中标题（P25） -->
        <div class="titlebar">
            <button class="icircle back" aria-label="返回" @click="go_back">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <b class="title">草稿箱</b>
        </div>

        <!-- 统计行 -->
        <div class="stat-row">
            <span>共 {{ drafts.length }} 条草稿</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A6A3A" stroke-width="1.7" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        </div>

        <!-- 草稿卡列表；draft-grid 仅为网格化容器，移动端 display:contents 不影响原布局 -->
        <template v-if="drafts.length">
            <div class="draft-grid">
                <div
                    v-for="(d, i) in drafts" :key="d.id"
                    class="card draft fade-up" :style="{ animationDelay: `${i * 0.04}s` }"
                >
                    <div class="head">
                        <span class="type">{{ d.kind === 'post' ? '动态草稿' : '点评草稿' }}</span>
                        <span class="time">{{ d.time }}</span>
                    </div>
                    <div class="sum">{{ d.summary }}</div>
                    <div v-if="d.thumbs?.length" class="thumbs">
                        <img v-for="(t, j) in d.thumbs" :key="j" :src="t" alt="" />
                    </div>
                    <div class="ops">
                        <span class="edit" @click="go_edit(d)">继续编辑</span>
                        <span class="del" @click="do_delete(d)">删除</span>
                    </div>
                </div>
            </div>
        </template>

        <!-- 空态插画 -->
        <div v-else class="empty fade-up">
            <img src="/assets/spare/R21.png" alt="空空如也" />
            <p>草稿箱空空的，想到什么就先存着吧</p>
        </div>
    </div>
</template>

<script setup>
/**
 * 草稿箱（/drafts）：对齐 P25 原型
 * - 草稿卡：类型签（点评/动态）+ 时间 + 摘要两行截断 + 缩略图 + 操作
 * - 继续编辑：点评 → /publish；动态 → /post-publish
 * - 删除：二次确认后移除并写回 localStorage
 * - 数据：localStorage（key: fk_drafts）；无后端草稿接口，无数据时展示空态
 * TODO: 待后端接口：草稿保存 / 草稿列表 / 草稿删除
 */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();

/** localStorage 存储键 */
const DRAFT_KEY = 'fk_drafts';

const drafts = ref([]);

/**
 * 从 localStorage 载入草稿；无数据 / 解析失败时保持空列表（页面展示空态，不回退假数据）
 */
function load_drafts() {
    let list = null;
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) list = JSON.parse(raw);
    } catch { /* 解析失败按空处理 */ }
    drafts.value = Array.isArray(list) ? list : [];
}

/**
 * 写回 localStorage
 */
function save_drafts() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts.value));
}

/**
 * 继续编辑：点评 → /publish；动态 → /post-publish（携带草稿 id 供回填）
 * @param {Object} d
 */
function go_edit(d) {
    const path = d.kind === 'post' ? '/post-publish' : '/publish';
    router.push({ path, query: { draftId: d.id } });
}

/**
 * 删除草稿：二次确认后移除并写回 localStorage
 * @param {Object} d
 */
async function do_delete(d) {
    try {
        await ElMessageBox.confirm('删除后不可恢复，确认删除？', '删除草稿', {
            type: 'warning',
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            confirmButtonClass: 'el-button--danger',
        });
    } catch { return; }
    drafts.value = drafts.value.filter((x) => x.id !== d.id);
    save_drafts();
    ElMessage.success('草稿已删除');
}

/**
 * 返回上一页
 */
function go_back() {
    router.back();
}

onMounted(load_drafts);
</script>

<style scoped>
/* 标题行：返回浮钮 + 居中标题 */
.titlebar {
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}
.back { position: absolute; left: 0; }
.title { font-size: 16px; font-weight: 700; }

/* 统计行 */
.stat-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 2px 0;
    font-size: 11px;
    color: var(--ink-2);
}

/* 草稿卡（P25）：无框卡 + 弥散阴影 */
.card.draft { margin-top: 10px; }
.head { display: flex; align-items: center; }
/* 类型签：淡金底微圆角 */
.type {
    font-size: 9px;
    font-weight: 700;
    color: var(--ink-3);
    background: var(--brand-light);
    padding: 2px 8px;
    border-radius: 6px;
}
.time { margin-left: auto; font-size: 9.5px; color: var(--ink-2); }
/* 摘要两行截断 */
.sum {
    font-size: 12px;
    color: var(--ink);
    margin-top: 9px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.6;
}
.thumbs { display: flex; gap: 9px; margin-top: 9px; }
.thumbs img { width: 56px; height: 56px; border-radius: 9px; object-fit: cover; }
.ops { display: flex; justify-content: flex-end; gap: 18px; margin-top: 9px; font-size: 11px; }
.ops .edit { color: var(--brand); font-weight: 700; cursor: pointer; }
.ops .edit:hover { color: var(--brand-dark); }
.ops .del { color: var(--bad); cursor: pointer; opacity: .85; }
.ops .del:hover { opacity: 1; }

/* 空态插画 */
.empty { text-align: center; padding: 40px 0 12px; }
.empty img { width: 180px; margin: 0 auto; opacity: .9; }
.empty p { font-size: 12px; color: var(--ink-2); margin-top: 10px; }

/* ===== 桌面适配（≥769）：草稿卡双列网格，标题/统计/空态跨全宽 ===== */
/* 网格化容器：移动端 display:contents 不产生任何盒影响，桌面才变 grid */
.draft-grid { display: contents; }
@media (min-width: 769px) {
    /* 草稿卡桌面 2 列网格，纵向间距由网格接管 */
    .draft-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 16px; align-items: start; }
    .card.draft { margin-top: 0; }
    /* 缩略图桌面适当加大 */
    .thumbs img { width: 72px; height: 72px; }
}

/* ===== 桌面适配（≥1200）：摘要与缩略图再加一档 ===== */
@media (min-width: 1200px) {
    /* 超宽屏：摘要字号升一档，长草稿更易扫读 */
    .sum { font-size: 13px; }
}
</style>
