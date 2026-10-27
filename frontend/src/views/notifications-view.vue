<template>
    <div class="page-wrap notices-page">
        <!-- 标题行：返回 + 居中标题 + 右侧通知设置入口（P24） -->
        <div class="titlebar">
            <button class="icircle back" aria-label="返回" @click="go_back">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <b class="title">获赞与消息</b>
            <router-link class="bell" to="/settings" aria-label="通知设置">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 9a6 6 0 10-12 0c0 5-2 6-2 6h16s-2-1-2-6" /><path d="M10 19a2 2 0 004 0" /></svg>
            </router-link>
        </div>

        <!-- 分类 Tab：互动 / 审核 / 系统 -->
        <div class="ctabs">
            <span
                v-for="t in TABS" :key="t.key"
                :class="{ on: active_tab === t.key }"
                @click="switch_tab(t.key)"
            >{{ t.label }}</span>
        </div>

        <!-- 未读提示行 + 全部已读 -->
        <div class="unread-row">
            <span>{{ unread_count }} 条未读</span>
            <span class="read-all" @click="read_all">全部已读</span>
        </div>

        <!-- 消息列表：左小圆 SVG（心/勾/铃铛）+ 标题 + 摘要 + 时间，未读淡金圆点 -->
        <div class="msglist">
            <template v-if="cur_list.length">
                <!-- 互动类可跳点评详情；审核类跳我的点评；推送类灵感卡跳推荐菜；系统/周报不跳 -->
                <component
                    :is="jumpable(n) ? 'a' : 'div'"
                    v-for="(n, i) in cur_list" :key="n.id"
                    class="msgrow fade-up" :class="{ plain: !jumpable(n) }" :style="{ animationDelay: `${i * 0.04}s` }"
                    :href="jumpable(n) ? 'javascript:;' : undefined"
                    @click="open_notice(n)"
                >
                    <span class="av" :class="{ unread: !n.read }">
                        <!-- 自绘 SVG：心 / 勾 / 铃铛 / 礼花（G4 禁汉字图标） -->
                        <svg v-if="n.type === 'interact'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.5-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.5-9 9-9 9z" /></svg>
                        <svg v-else-if="n.type === 'audit'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 12.5l2.4 2.4 4.6-5" /><path d="M12 3l7 2.8v5.4c0 4.6-3 7.6-7 9.8-4-2.2-7-5.2-7-9.8V5.8z" /></svg>
                        <svg v-else-if="n.type === 'push'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.2L18 8.4l-3 2.9.7 4.3L12 13.6l-3.7 2 .7-4.3-3-2.9 4.1-1.2z" /><path d="M6 19h12" /></svg>
                        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 9a6 6 0 10-12 0c0 5-2 6-2 6h16s-2-1-2-6" /><path d="M10 19a2 2 0 004 0" /></svg>
                        <!-- 未读淡金圆点 -->
                        <i v-if="!n.read" class="dot" />
                    </span>
                    <div class="mtxt">
                        <div class="mtitle">
                            <template v-if="n.type === 'interact'">
                                <b>{{ n.actor }}</b>
                                {{ n.count > 1 ? `等 ${n.count} 人赞了你的点评` : n.title }}
                            </template>
                            <template v-else>{{ n.title }}</template>
                        </div>
                        <!-- 推送类内容带推荐清单，保留换行 -->
                        <div v-if="n.summary" class="msum" :class="{ multi: n.type === 'push' }">{{ n.summary }}</div>
                        <div class="mtime">{{ n.time }}</div>
                    </div>
                    <span v-if="n.state_text" class="mstate" :class="n.state_cls">{{ n.state_text }}</span>
                </component>
            </template>

            <!-- 空态 -->
            <div v-else class="empty fade-up">
                <img src="/assets/spare/R21.png" alt="空空如也" />
                <p>这里还没有消息</p>
            </div>
        </div>
        <div class="foot-hint">同类互动消息已合并展示 · 点击消息可查看来源内容</div>
    </div>
</template>

<script setup>
/**
 * 通知中心（/notifications）：对齐 P24 原型
 * - 分类 Tab「互动 / 审核 / 系统」可切换
 * - 消息行：左小圆 SVG（心/勾/铃铛）+ 标题 + 摘要 + 时间 + 未读淡金圆点
 * - 同类合并：互动类同一点评的点赞合并为「xx 等 N 人赞了你的点评」
 * - 「全部已读」接 api_notification.read_all；mine() 失败或空数据展示空态（不使用页内假数据）
 * - 点击跳转：互动 → /post/:id；审核 → /my-reviews；无来源可跳的消息置为不可点
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api_notification } from '../api';

const router = useRouter();

const TABS = [
    { key: 'interact', label: '互动' },
    { key: 'audit', label: '审核' },
    { key: 'push', label: '推送' },
    { key: 'system', label: '系统' },
];
const active_tab = ref('interact');

const notices = ref([]);

/** 当前分类消息 */
const cur_list = computed(() => notices.value.filter((n) => n.type === active_tab.value));

/** 未读数（全部分类） */
const unread_count = computed(() => notices.value.filter((n) => !n.read).length);

/**
 * 切换分类
 * @param {string} k - interact / audit / system
 */
function switch_tab(k) {
    active_tab.value = k;
}

/**
 * 返回上一页
 */
function go_back() {
    router.back();
}

/**
 * 消息点击：互动 → /post/:postId；审核 → /my-reviews；系统不跳
 * @param {Object} n
 */
function open_notice(n) {
    if (n.type === 'interact' && n.postId) {
        router.push(`/post/${n.postId}`);
        return;
    }
    if (n.type === 'audit') {
        router.push('/my-reviews');
        return;
    }
    // 推送类：灵感卡跳推荐菜详情
    if (n.type === 'push' && n.refId) {
        router.push(n.kind === 'digest' ? `/dish/${n.refId}` : '/my-reviews');
    }
}

/**
 * 全部已读：接 api_notification.read_all()，失败也本地置已读（mock 环境）
 */
async function read_all() {
    try {
        await api_notification.read_all();
    } catch { /* 失败回退本地置已读 */ }
    notices.value = notices.value.map((n) => ({ ...n, read: true }));
    ElMessage.success('已全部标记为已读');
}

/**
 * 同类合并：互动类中同一点评（postId）的同种互动（kind）合并为一条并累计人数
 * @param {Array} list - normalize 后的消息
 * @returns {Array}
 */
function merge_notices(list) {
    const out = [];
    const seen = new Map();
    for (const n of list) {
        const can_merge = n.type === 'interact' && n.kind === 'like' && n.postId;
        if (!can_merge) { out.push(n); continue; }
        const key = `${n.kind}_${n.postId}`;
        if (seen.has(key)) {
            const first = seen.get(key);
            first.count += n.count || 1;
            first.read = first.read && n.read;
        } else {
            seen.set(key, n);
            out.push(n);
        }
    }
    return out;
}

/**
 * 字段归一化：兼容后端蛇形 / 驼峰字段，映射为页面展示模型
 * @param {Object} it
 * @returns {Object}
 */
function normalize(it) {
    const type = it.type ?? it.notice_type ?? 'system';
    const kind = it.kind ?? it.action ?? '';
    return {
        id: String(it.id ?? Math.random()),
        // push = 算法推送（灵感 digest / 周报 report），ref_type 细分用途
        type: ['interact', 'audit', 'system', 'push'].includes(type) ? type : 'system',
        kind: kind || it.ref_type || '',
        actor: it.actor ?? it.actor_name ?? '有人',
        count: Number(it.count ?? 1),
        title: it.title ?? '系统消息',
        summary: it.summary ?? it.content ?? '',
        time: it.time ?? it.created_at ?? '',
        read: !!(it.read ?? it.is_read),
        postId: it.postId ?? it.post_id ?? null,
        refId: it.refId ?? it.ref_id ?? null,
        state_text: it.state_text ?? '',
        state_cls: it.state_cls ?? '',
    };
}

/**
 * 消息行是否可点击跳转：互动需带点评引用，推送需带推荐菜 id；系统类与无引用消息不可点
 * @param {Object} n 归一化后的消息
 */
function jumpable(n) {
    if (n.type === 'interact') return !!n.postId;
    if (n.type === 'audit') return true;
    if (n.type === 'push') return !!n.refId;
    return false;
}

/**
 * 装载通知：接 api_notification.mine()，成功后做同类合并；接口失败或空数据展示空态
 */
async function load_notices() {
    try {
        const raw = await api_notification.mine();
        const list = Array.isArray(raw) ? raw : (raw?.list ?? []);
        notices.value = merge_notices(list.map(normalize));
    } catch {
        notices.value = [];
    }
}

onMounted(load_notices);
</script>

<style scoped>
/* 标题行：返回浮钮 + 居中标题 + 右侧铃铛（通知设置入口） */
.titlebar {
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    border-bottom: 1px solid var(--line);
    margin: 0 -16px;
    padding: 0 16px;
}
.back { position: absolute; left: 16px; }
.bell { position: absolute; right: 16px; color: #5C4A2E; display: flex; }
.title { font-size: 16px; font-weight: 700; }

/* 分类 Tab：琥珀下划指示 */
.ctabs {
    display: flex;
    gap: 18px;
    padding: 0 2px;
}
.ctabs span {
    font-size: 12.5px;
    color: var(--ink-2);
    font-weight: 600;
    padding: 11px 0;
    position: relative;
    cursor: pointer;
}
.ctabs span.on { color: var(--ink); font-weight: 800; }
.ctabs span.on::after {
    content: '';
    position: absolute;
    left: 15%; right: 15%; bottom: 0;
    height: 2.5px;
    border-radius: 2px;
    background: var(--brand);
}

/* 未读提示行 */
.unread-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 2px 2px;
    font-size: 11px;
    color: var(--ink-2);
}
.read-all { color: var(--brand); font-weight: 700; cursor: pointer; }
.read-all:hover { color: var(--brand-dark); }

/* 消息行：行间 1px 虚线（P24） */
.msglist { padding: 4px 2px 0; }
.msgrow {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 0;
    cursor: pointer;
    text-decoration: none;
    color: inherit;
}
.msgrow + .msgrow { border-top: 1px dashed var(--line); }
/* 无可跳转来源的消息：不显示手型，避免误以为可点 */
.msgrow.plain { cursor: default; }
.msgrow > div { flex: 1; }

/* 左小圆：淡金底 + 琥珀图标；未读右上淡金圆点 */
.av {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--brand-light);
    color: var(--ink-3);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
}
.dot {
    position: absolute;
    top: 1px;
    right: 1px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--sun);
    border: 1.5px solid var(--paper);
}

/* 文本：标题 12.5 / 摘要 10 / 时间 9.5 */
.mtxt { flex: 1; min-width: 0; }
.mtitle { font-size: 12.5px; line-height: 1.5; }
.mtitle b { font-weight: 700; }
.msum {
    font-size: 10px;
    color: var(--ink-2);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
/* 推送类消息保留推荐清单换行（最多 4 行防溢出） */
.msum.multi {
    white-space: pre-line;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    overflow: hidden;
}
.mtime { font-size: 9.5px; color: var(--ink-2); margin-top: 3px; }

/* 审核结果小签 */
.mstate {
    font-size: 9px;
    padding: 3px 9px;
    border-radius: var(--radius-sm);
    font-weight: 700;
    flex-shrink: 0;
}
.mstate.ok { background: #E8F3E4; color: #3E7C3A; }
.mstate.bad { background: #FDEEEA; color: #B03A2E; }

/* 空态 */
.empty { text-align: center; padding: 30px 0 12px; }
.empty img { width: 180px; margin: 0 auto; opacity: .9; }
.empty p { font-size: 12px; color: var(--ink-2); margin-top: 10px; }

.foot-hint { text-align: center; font-size: 10px; color: var(--ink-2); margin-top: 16px; }

/* ===== 桌面适配（≥769）：内容限宽成阅读列，消息行改左右布局 ===== */
@media (min-width: 769px) {
    /* 通知中心为阅读型窄列：整页限宽 760 居中（覆盖 .page-wrap 桌面 1080 档），列表保持单列 */
    .notices-page { max-width: 760px; }
    /* 标题栏取消移动端贴边负边距，桌面恢复常规留白；返回/铃铛锚点随之收进内容列 */
    .titlebar { margin: 0; padding: 0; }
    .back { left: 0; }
    .bell { right: 0; }
}

/* ===== 桌面适配（≥1200）：阅读列放宽一档 ===== */
@media (min-width: 1200px) {
    /* 超宽屏：阅读列放宽到 820，信息密度更舒适 */
    .notices-page { max-width: 820px; }
}
</style>
