<template>
    <div class="page-wrap tk">
        <!-- 顶部返回头 -->
        <div class="topbar">
            <span class="icircle back" aria-label="返回" @click="go_back">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
            </span>
            <b class="t-title">任务中心</b>
            <i class="t-hold"></i>
        </div>

        <!-- 1. 金币卡：插画 + 粗大数字 + 兑换说明 -->
        <div class="card coinpanel fade-up">
            <div class="coin-row">
                <b class="cp-title">赚金币</b>
                <div class="coin-num">
                    <img class="avatar-fix" src="/assets/icons/ill-coin.png" alt="金币" />
                    <b class="score-num">{{ coins }}</b>
                </div>
            </div>
            <p class="cp-tip">金币用于喂食与装扮解锁 · 每日 0 点刷新 · 已获金币不追回</p>
        </div>

        <!-- 2. 任务分类 Tab -->
        <div class="ttabs fade-up">
            <span :class="{ on: tab === 'daily' }" @click="tab = 'daily'">每日任务</span>
            <span :class="{ on: tab === 'grow' }" @click="tab = 'grow'">成长任务</span>
        </div>

        <!-- 3a. 每日任务列表（6 条） -->
        <template v-if="tab === 'daily'">
            <div class="card task fade-up" v-for="t in DAILY" :key="t.key">
                <span class="tico">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" v-html="ICONS[t.icon]"></svg>
                    <i class="coin">+{{ t.reward }}</i>
                </span>
                <div class="tinfo">
                    <b>{{ t.name }}</b>
                    <span>{{ t.desc }} · 已完成 {{ t.base }}/1</span>
                </div>
                <!-- 进度满且未领 → 领取；已领 → 灰态；未完成 → 去完成 -->
                <span v-if="t.base >= 1 && !claim_map[t.key]" class="tbtn go" @click="claim_daily(t)">领取</span>
                <span v-else-if="claim_map[t.key]" class="tbtn done">已领取</span>
                <span v-else class="tbtn go" @click="router.push(t.to)">去完成</span>
            </div>
            <p class="list-tip">每日任务合计可得 {{ DAILY_TOTAL }} 金币 · 单项每日限领一次</p>
        </template>

        <!-- 3b. 成长任务列表（5 条，进度条型） -->
        <template v-else>
            <div class="card task fade-up" v-for="g in grow_list" :key="g.key">
                <span class="tico">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" v-html="ICONS[g.icon]"></svg>
                    <i class="coin">+{{ g.reward }}</i>
                </span>
                <div class="tinfo">
                    <b>{{ g.name }}</b>
                    <span class="grow-bar"><i :style="{ width: g.pct + '%' }"></i></span>
                    <span class="grow-val">{{ g.cur }} / {{ g.target }}</span>
                </div>
                <span v-if="g.cur >= g.target && !grow_claim[g.key]" class="tbtn go" @click="claim_grow(g)">领取</span>
                <span v-else-if="grow_claim[g.key]" class="tbtn done">已领取</span>
                <span v-else class="tbtn go" @click="router.push(g.to)">去完成</span>
            </div>
            <p class="list-tip">成长任务一次性达成，不可重复领取 · 与成就口径一致，同步推进成就进度</p>
        </template>
    </div>
</template>

<script setup>
/**
 * 任务中心页（对齐 P32 + C23）：
 * 金币卡（插画 + 粗大数字 + 兑换说明）→
 * 每日任务 6 条（26px 圆底自绘 SVG + 金币角标，领取/去完成/已领取灰态）→
 * 成长任务 5 条（进度条型，达成可领）。领取态按「今日」持久化 localStorage，
 * 跨日自动重置；金币余额同步累加。
 * 任务数据后端暂无接口 → mock + localStorage（TODO: 待后端接口）
 */
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { load_json, save_json } from '../utils/storage.js';

const router = useRouter();

/* ---------------- mock 常量（TODO: 待后端接口） ---------------- */

// 自绘 SVG 图标表（C23：打卡=日历勾、点评=星形笔、喂食=碗、收藏=书签、互动=气泡、分享=箭头）
const ICONS = {
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M8 3v4M16 3v4M3.5 9.5h17"/><path d="M9 14.5l2.2 2.2 4-4.5"/>',
    starpen: '<path d="M12 3.5l2.5 5.2 5.7.7-4.2 4 1.1 5.6-5.1-2.8-5.1 2.8 1.1-5.6-4.2-4 5.7-.7z"/>',
    bowl: '<path d="M4 11h16a8 8 0 01-16 0z"/><path d="M9 7c0-1.5 1-2 1-3M13 7c0-1.5 1-2 1-3"/>',
    mark: '<path d="M7 3.5h10a1 1 0 011 1V21l-6-3.5L6 21V4.5a1 1 0 011-1z"/>',
    chat: '<path d="M21 12a8 8 0 01-8 8H4l1.5-3.5A8 8 0 1121 12z"/><path d="M8.5 10.5h7M8.5 13.5h4.5"/>',
    up: '<path d="M12 15V4"/><path d="M8 7.5L12 3.5l4 4"/><path d="M5 12v6a2 2 0 002 2h10a2 2 0 002-2v-6"/>',
    heart: '<path d="M12 20s-7-4.5-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.5-9 9-9 9z"/>',
    pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0113 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.2"/>',
    shirt: '<path d="M8.5 4L12 5.5 15.5 4l4.5 3.5-2.5 2.5-1.5-1V20h-8v-11l-1.5 1L4 7.5z"/>',
};

// 每日任务 6 条：base 为「今日已完成次数」（mock 静态值）
const DAILY = [
    { key: 'checkin', name: '每日打卡', desc: '任意档口完成一次就餐打卡', reward: 10, icon: 'cal', to: '/checkin', base: 1 },
    { key: 'review', name: '写一条点评', desc: '发布 1 条有效点评', reward: 20, icon: 'starpen', to: '/publish', base: 0 },
    { key: 'feed', name: '给宠物喂食一次', desc: '宠物页完成一次投喂', reward: 5, icon: 'bowl', to: '/pet', base: 0 },
    { key: 'fav', name: '收藏一道菜', desc: '收藏任意菜品进想吃清单', reward: 5, icon: 'mark', to: '/search', base: 0 },
    { key: 'interact', name: '互动一次', desc: '点赞 / 评论 / 回复任意一次', reward: 5, icon: 'chat', to: '/circle', base: 1 },
    { key: 'share', name: '分享一条动态', desc: '发一条动态并生成分享卡', reward: 10, icon: 'up', to: '/post-publish', base: 0 },
];

// 成长任务 5 条（进度条型，口径与成就页一致）
const GROW_DEFS = [
    { key: 'g_checkin', name: '累计打卡 10 天', target: 10, curKey: 'checkins', reward: 50, icon: 'cal', to: '/checkin' },
    { key: 'g_review', name: '发布 20 条点评', target: 20, curKey: 'reviews', reward: 100, icon: 'starpen', to: '/publish' },
    { key: 'g_likes', name: '获赞 50 次', target: 50, curKey: 'likes', reward: 50, icon: 'heart', to: '/circle' },
    { key: 'g_spots', name: '点亮 8 个点位', target: 8, curKey: 'spots', reward: 50, icon: 'pin', to: '/' },
    { key: 'g_dress', name: '装扮收集 3 套', target: 3, curKey: 'dresses', reward: 30, icon: 'shirt', to: '/pet' },
];

const DEFAULT_ACHV = { checkins: 36, spots: 17, reviews: 12, likes: 312 };
const DAILY_TOTAL = DAILY.reduce((s, t) => s + t.reward, 0); // 每日合计 55



/**
 * 今日日期串（本地时区，跨日重置用）
 * @returns {string} 形如 2026-10-15
 */
function today_str() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/* ---------------- 状态 ---------------- */

const tab = ref('daily');
const coins = ref(86); // 金币余额（mock）
const achv = ref({ ...DEFAULT_ACHV, dresses: 1 }); // 成就口径进度 + 装扮数
const claim_map = reactive({}); // 每日任务今日领取态
const grow_claim = reactive({}); // 成长任务领取态（一次性）

// 成长任务列表：合并当前进度 → 百分比
const grow_list = computed(() =>
    GROW_DEFS.map((g) => {
        const cur = Math.min(g.target, Number(achv.value[g.curKey]) || 0);
        return { ...g, cur, pct: Math.round((cur / g.target) * 100) };
    })
);

/* ---------------- 生命周期 ---------------- */

onMounted(() => {
    // 金币余额 + 成就口径进度（缺省兜底）
    coins.value = Number(load_json('dafu_coins', 86)) || 0;
    const saved = load_json('dafu_achv_progress', {});
    Object.keys(DEFAULT_ACHV).forEach((k) => {
        if (saved[k] !== undefined) achv.value[k] = Number(saved[k]) || 0;
    });
    // 每日领取态：跨日自动重置
    const claim = load_json('dafu_tasks_claim', {});
    Object.assign(claim_map, claim.date === today_str() ? claim.map : {});
    // 成长任务领取态（一次性，不随日期重置）
    Object.assign(grow_claim, load_json('dafu_grow_claim', {}));
});

/* ---------------- 交互 ---------------- */

/**
 * 返回上一页
 */
function go_back() {
    router.back();
}

/**
 * 领取每日任务奖励：金币入账 + 今日领取态持久化
 * @param {Object} t 任务项
 */
function claim_daily(t) {
    claim_map[t.key] = true;
    coins.value += t.reward;
    save_json('dafu_coins', coins.value);
    save_json('dafu_tasks_claim', { date: today_str(), map: { ...claim_map } });
    ElMessage.success(`已领取 ${t.reward} 金币`);
}

/**
 * 领取成长任务奖励：金币入账 + 一次性领取态持久化
 * @param {Object} g 成长任务项
 */
function claim_grow(g) {
    grow_claim[g.key] = true;
    coins.value += g.reward;
    save_json('dafu_coins', coins.value);
    save_json('dafu_grow_claim', { ...grow_claim });
    ElMessage.success(`已领取 ${g.reward} 金币`);
}
</script>

<style scoped>
/* 顶部返回头 */
.topbar { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; min-height: 44px; }
.t-title { font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }
.t-hold { width: 40px; flex-shrink: 0; }
.icircle.back { color: var(--ink); }

/* 金币卡 */
.coinpanel { margin-top: 10px; }
.coin-row { display: flex; align-items: center; }
.cp-title { font-size: 16px; }
.coin-num { margin-left: auto; display: flex; align-items: center; gap: 5px; }
.coin-num img { width: 24px; height: 24px; object-fit: contain; }
.coin-num b { font-size: 22px; color: #B85A2A; }
.cp-tip { font-size: 10px; color: var(--ink-2); margin: 4px 0 0; }

/* 任务分类 Tab */
.ttabs { display: flex; gap: 20px; padding: 16px 2px 0; }
.ttabs span { font-size: 13px; color: var(--ink-2); font-weight: 600; position: relative; padding-bottom: 6px; cursor: pointer; }
.ttabs span.on { color: var(--ink); font-weight: 800; }
.ttabs span.on::after { content: ''; position: absolute; left: 15%; right: 15%; bottom: 0; height: 2.5px; border-radius: 2px; background: var(--brand); }

/* 任务行 */
.task { margin-top: 10px; display: flex; align-items: center; gap: 11px; padding: 12px 13px; }
.task + .task { margin-top: 10px; }

/* 行首圆底图标：26px 淡金圆底 + 金币角标（C23） */
.tico {
    width: 26px; height: 26px; border-radius: 50%;
    background: #FBF0D8; color: var(--ink-3);
    display: flex; align-items: center; justify-content: center;
    position: relative; flex-shrink: 0;
}
.tico .coin {
    position: absolute; right: -6px; bottom: -5px; font-style: normal;
    font-size: 8px; font-weight: 800; color: #5C3A00;
    background: #E8B93C; padding: 1px 5px;
    border-radius: var(--radius-sm); border: 1.5px solid var(--paper);
}
.tinfo { flex: 1; min-width: 0; }
.tinfo b { display: block; font-size: 12.5px; }
.tinfo > span { display: block; font-size: 9.5px; color: var(--ink-2); margin-top: 3px; }

/* 成长任务进度条 */
.grow-bar { height: 5px; border-radius: 8px; background: #EDE0C2; overflow: hidden; margin-top: 6px; }
.grow-bar i { display: block; height: 100%; background: linear-gradient(90deg, #E8B93C, var(--star)); border-radius: 8px; transition: width .3s ease; }
.grow-val { font-variant-numeric: tabular-nums; }

/* 操作小按钮：领取（琥珀实底）/ 已领取（灰态） */
.tbtn { flex-shrink: 0; font-size: 11px; font-weight: 800; padding: 7px 15px; border-radius: var(--radius-sm); cursor: pointer; }
.tbtn.go { background: var(--brand); color: var(--paper); }
.tbtn.go:active { transform: translateY(1px); }
.tbtn.done { background: #EDE0C2; color: var(--ink-3); cursor: default; }

/* 列表底部提示 */
.list-tip { text-align: center; font-size: 9.5px; color: var(--ink-2); margin: 10px 0 0; }

/* ===== 桌面适配（≥769）===== */
@media (min-width: 769px) {
    /* 整页限宽 760 居中：任务行保持单列列表形态，不做双列 */
    .page-wrap.tk { max-width: 760px; }
    /* 金币卡与任务行桌面字号放大一档 */
    .coin-num b { font-size: 26px; }
    .tinfo b { font-size: 13.5px; }
    .tinfo > span { font-size: 10.5px; }
    .tbtn { font-size: 12px; padding: 8px 18px; }
}
</style>
