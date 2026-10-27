<template>
    <div class="page-wrap pet-community">
        <!-- 顶部返回头：返回 + 标题 + 全服规模 -->
        <div class="topbar">
            <span class="icircle back" aria-label="返回" @click="go_back">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
            </span>
            <b class="t-title">社区宠物中心</b>
            <span class="t-right">全服 1,208 只福宝</span>
        </div>

        <!-- 我的宠物入口卡 → /pet（舞台式展示：大贴纸 + 饱腹度条，与宠物页 UI 同源） -->
        <div class="card mine-entry fade-up" @click="$router.push('/pet')">
            <span class="mine-stage">
                <img class="mine-pet" src="/assets/icons/grid-avatar.png" alt="我家的福宝" />
            </span>
            <div class="mine-info">
                <b>我家的福宝</b>
                <span class="mine-sat">
                    <i class="sat-bar"><em :style="{ width: mine_satiety + '%' }"></em></i>
                    饱腹 {{ mine_satiety }}
                </span>
                <span class="mine-sub">投喂道具 ×{{ mine_props }} · 点进小窝看看</span>
            </div>
            <i class="mine-arr">›</i>
        </div>

        <!-- 周投喂榜 Top3：名次圆号 -->
        <div class="sec"><b>本周投喂榜</b><span>每周一 0 点重置</span></div>
        <section class="top3 fade-up">
            <div v-for="t in TOP3" :key="t.rank" class="t-card">
                <span class="rank" :class="`r${t.rank}`">{{ t.rank }}</span>
                <img class="avatar-fix" src="/assets/avatar-user.png" :alt="t.user" />
                <b class="t-name">{{ t.user }}</b>
                <span class="t-count">喂了 {{ t.count }} 次</span>
            </div>
        </section>

        <!-- 宠物广场：他人宠物卡流 -->
        <div class="sec"><b>宠物广场</b><span>投喂 / 摸摸都可以攒好感</span></div>
        <section class="p-list">
            <div v-for="(p, i) in pets" :key="p.id" class="card p-card fade-up" :style="{ animationDelay: `${(i % 6) * 40}ms` }">
                <div class="p-pet-wrap">
                    <img class="p-pet" :src="p.img" alt="福宝" />
                    <span class="chip face-chip">{{ p.face }}</span>
                </div>
                <div class="p-body">
                    <div class="p-owner">
                        <img class="avatar-fix" src="/assets/avatar-user.png" style="width: 20px; height: 20px; border-radius: 50%;" alt="" />
                        <b>{{ p.user }}</b>
                    </div>
                    <p class="p-mood">{{ p.mood }}</p>
                    <div class="p-ops">
                        <button class="op-btn" :class="{ done: p.feeded }" :disabled="p.feeded" @click="do_feed(p)">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h16a8 8 0 0 1-16 0z" /><path d="M8 11c0-3 2-5 4-5s4 2 4 5" /></svg>
                            投喂 {{ p.feeds }}
                        </button>
                        <button class="op-btn" :class="{ done: p.touched }" :disabled="p.touched" @click="do_touch(p)">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 3.5C19 15.5 12 20 12 20z" /></svg>
                            摸摸 {{ p.touches }}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    </div>
</template>

<script setup>
/**
 * 社区宠物中心页（对齐 P33）：
 * 我的宠物入口卡 → /pet；周投喂榜 Top3（名次圆号）；
 * 宠物广场卡流（宠物图+表情 / 主人头像昵称 / 今日状态 / 投喂摸摸互动+计数）。
 * 后端暂无接口 → 页内 mock（TODO: 待后端接口），我的宠物读 dafu_pet
 */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { load_json } from '../utils/storage.js';

const router = useRouter();

/* ---------------- mock 常量（TODO: 待后端接口） ---------------- */

// 周投喂榜 Top3
const TOP3 = [
    { rank: 1, user: '深夜干饭王', count: 86 },
    { rank: 2, user: '碳水快乐星', count: 72 },
    { rank: 3, user: '甜品雷达', count: 65 },
];

// 广场宠物 mock：宠物图（装扮/表情）+ 表情签 + 主人 + 今日状态 + 互动计数
const MOCK_PETS = [
    { id: 1, img: '/assets/pet-dress/d9.png', face: '开心', user: '深夜干饭王', mood: '凌晨背完书奖励自己一顿麻辣香锅，头都亮了', feeds: 23, touches: 41 },
    { id: 2, img: '/assets/pet-dress/d7.png', face: '满足', user: '辣度试验员', mood: '今日挑战变态辣拌面，披风都辣飞了', feeds: 19, touches: 36 },
    { id: 3, img: '/assets/pet-dress/d1.png', face: '平静', user: '面面俱到', mood: '砂锅蒸笼上岗，今天吃三鲜蒸饺', feeds: 17, touches: 30 },
    { id: 4, img: '/assets/pet-dress/d5.png', face: '开心', user: '碳水快乐星', mood: '汉堡日！面包胚比脸大', feeds: 15, touches: 28 },
    { id: 5, img: '/assets/pet-dress/d6.png', face: '害羞', user: '甜品雷达', mood: '草莓奶油双皮奶，甜到心尖尖', feeds: 14, touches: 26 },
    { id: 6, img: '/assets/pet-dress/d4.png', face: '满足', user: '干饭不语', mood: '寿司卷配味增汤，安静干饭', feeds: 12, touches: 22 },
    { id: 7, img: '/assets/pet/e-happy.png', face: '开心', user: '一日五餐', mood: '第五餐是丁香园的杨枝甘露', feeds: 11, touches: 21 },
    { id: 8, img: '/assets/pet-dress/d3.png', face: '平静', user: '轻食星人', mood: '饭团 + 无糖豆浆，轻盈一天', feeds: 9, touches: 18 },
];



/* ---------------- 状态 ---------------- */

const pets = ref(MOCK_PETS.map((p) => ({ ...p }))); // 拷贝一份，互动计数本地可变
const mine_satiety = ref(78);
const mine_props = ref(3);

/* ---------------- 生命周期 ---------------- */

onMounted(() => {
    // 我的宠物入口展示本机档案（无则用默认值）
    const pet = load_json('dafu_pet', null);
    if (pet) {
        mine_satiety.value = pet.satiety ?? 78;
        mine_props.value = pet.props ?? 3;
    }
});

/* ---------------- 交互 ---------------- */

/**
 * 返回上一页
 */
function go_back() {
    router.back();
}

/**
 * 给 TA 的福宝投喂（每人限一次）
 * @param {object} p 宠物卡数据
 */
function do_feed(p) {
    if (p.feeded) return;
    p.feeded = true;
    p.feeds += 1;
    ElMessage.success(`已给 ${p.user} 的福宝投喂`);
}

/**
 * 摸摸 TA 的福宝（每人限一次）
 * @param {object} p 宠物卡数据
 */
function do_touch(p) {
    if (p.touched) return;
    p.touched = true;
    p.touches += 1;
    ElMessage.success(`摸了摸 ${p.user} 的福宝，好感 +1`);
}
</script>

<style scoped>
/* 顶部返回头 */
.topbar { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; min-height: 44px; }
.t-title { font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }
.t-right { font-size: 10px; color: var(--ink-2); }
.icircle.back { color: var(--ink); }

/* 我的宠物入口卡：舞台式（大贴纸 + 饱腹度条），与宠物页 UI 同源 */
.mine-entry { margin-top: 16px; display: flex; align-items: center; gap: 14px; cursor: pointer; padding: 14px 16px; }
.mine-stage {
    flex-shrink: 0; width: 84px; height: 84px; border-radius: 18px;
    background: var(--paper); border: 1.5px solid var(--line);
    display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.mine-pet { width: 68px; height: 68px; object-fit: contain; }
.mine-info { flex: 1; min-width: 0; }
.mine-info b { display: block; font-size: 14.5px; }
.mine-sat { display: flex; align-items: center; gap: 7px; font-size: 10.5px; color: var(--ink-2); margin-top: 6px; }
.mine-sat .sat-bar { flex: 1; max-width: 130px; }
.mine-sub { display: block; font-size: 10.5px; color: var(--ink-2); margin-top: 4px; }
.mine-arr { font-style: normal; font-size: 15px; color: var(--ink-2); flex-shrink: 0; }
/* 饱腹度小进度条（与宠物页 sat-bar 同款口径） */
.mine-sat .sat-bar { display: inline-block; height: 7px; border-radius: 4px; background: rgba(201, 138, 30, .14); overflow: hidden; }
.mine-sat .sat-bar em { display: block; height: 100%; border-radius: 4px; background: var(--brand); }

/* 周投喂榜 Top3 */
.top3 { display: flex; gap: 10px; }
.t-card { flex: 1; background: var(--paper); border-radius: var(--radius); box-shadow: var(--shadow-soft); padding: 18px 8px 14px; text-align: center; position: relative; }
.rank {
    position: absolute; top: 8px; left: 8px; width: 20px; height: 20px; border-radius: 50%;
    font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center;
    background: var(--brand-light); color: var(--ink-3);
}
.rank.r1 { background: var(--brand); color: #FFFDF5; }
.rank.r2 { background: #EBCF9C; color: #7A5514; }
.rank.r3 { background: #F1E7D0; color: #A08550; }
.t-card img { width: 44px; height: 44px; border-radius: 50%; margin: 6px auto 0; display: block; }
.t-name { display: block; font-size: 11.5px; margin-top: 8px; }
.t-count { display: block; font-size: 9.5px; color: var(--ink-2); margin-top: 3px; }

/* 宠物广场卡流 */
.p-list { display: flex; flex-direction: column; gap: 12px; }
.p-card { display: flex; gap: 12px; }
/* 宠物广场方形图：圆润外框 + 贴纸 contain 完整显示（复刻 P33 .pcell 比例） */
.p-pet-wrap {
    position: relative; flex-shrink: 0; width: 88px; height: 88px;
    border-radius: 16px; border: 1.5px solid var(--line); background: var(--paper);
    overflow: hidden;
}
.p-pet { width: 100%; height: 100%; object-fit: contain; }
.face-chip { position: absolute; left: 50%; transform: translateX(-50%); bottom: -2px; white-space: nowrap; }
.p-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.p-owner { display: flex; align-items: center; gap: 7px; }
.p-owner b { font-size: 12.5px; }
.p-mood {
    font-size: 11px; color: #5C4A2E; line-height: 1.7; margin: 6px 0 0;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.p-ops { display: flex; gap: 8px; margin-top: auto; padding-top: 8px; }
.op-btn {
    display: inline-flex; align-items: center; gap: 5px;
    height: 28px; padding: 0 11px; border-radius: var(--radius-sm);
    background: var(--brand-light); color: var(--ink-3);
    border: none; font-size: 11px; font-weight: 600; cursor: pointer;
    transition: background .12s ease, color .12s ease;
}
.op-btn svg { width: 13px; height: 13px; }
.op-btn:not(:disabled):hover { background: var(--brand); color: #FFFDF5; }
.op-btn.done { background: #F1E7D0; color: var(--ink-2); cursor: default; }

/* ===== 桌面适配（≥769）===== */
@media (min-width: 769px) {
    /* 宠物广场卡流：单列改 2 列网格（minmax(0,1fr) 防内容撑破列宽） */
    .p-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
}

/* ===== 桌面适配（≥1200）===== */
@media (min-width: 1200px) {
    /* 宽屏三列铺开 */
    .p-list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
</style>
