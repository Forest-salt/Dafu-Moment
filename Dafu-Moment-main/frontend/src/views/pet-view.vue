<template>
    <div class="page-wrap pet">
        <!-- 顶部返回头 -->
        <div class="topbar">
            <span class="icircle back" aria-label="返回" @click="go_back">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
            </span>
            <b class="t-title">我的宠物</b>
            <i class="t-hold"></i>
        </div>

        <!-- 1. 用户信息条：头像 + 昵称 + 「已点亮 N 天」（C13 同行排法） -->
        <div class="user-row fade-up">
            <img class="avatar-fix" src="/assets/avatar-user.png" style="width: 38px; height: 38px; border-radius: 50%;" alt="头像" />
            <b class="nick">{{ nick }}</b>
            <div class="lit">
                <span class="lit-t">已点亮</span>
                <b class="lit-n score-num">{{ pet.litDays }}</b>
                <span class="lit-t">天</span>
            </div>
        </div>

        <!-- 2. 宠物舞台：表情随饱腹度切换 + 装扮叠加 -->
        <div class="petstage fade-up">
            <span class="tray"></span>
            <img class="pet" :class="{ bump: feed_bump }" :src="pet_face" alt="福宝" />
            <img v-if="pet.dress" class="pet dress" :class="{ bump: feed_bump }" :src="`/assets/pet-dress/${pet.dress}.png`" alt="装扮" />
            <!-- 投喂 +1 浮动反馈 -->
            <span v-if="float_on" class="float-plus">饱腹 +14</span>
        </div>

        <!-- 3. 名称 + 成长值/等级行 -->
        <div class="pet-name">福宝</div>
        <div class="lvrow">
            <span class="lvb">Lv.{{ pet.level }}</span>
            <span class="bar"><i :style="{ width: growth_pct + '%' }"></i></span>
            <span class="gift"><img src="/assets/pet-dress/d9.png" alt="皇冠奖励" /></span>
        </div>
        <div class="lv-tip">{{ level_tip }}</div>

        <!-- 4. 饥饿引导（需求 5.1.7：连续 3 天未打卡/点评进入饥饿，仅影响外观不扣数据） -->
        <div v-if="pet.satiety <= 40" class="hungry card fade-up">
            <b>福宝饿肚子了…</b>
            <p>连续 3 天未打卡 / 点评会进入饥饿状态，看起来蔫蔫的——<b>只影响外观，不会扣任何数据</b>。去打个卡就恢复活力！</p>
            <button class="btn-primary hungry-btn" @click="$router.push('/checkin')">去打卡 · 换投喂道具</button>
        </div>

        <!-- 5. 饱腹度进度条 + 投喂按钮（消耗道具） -->
        <div class="feed-zone fade-up">
            <div class="sat-row">
                <span class="sat-label">饱腹度</span>
                <span class="sat-bar"><i :style="{ width: pet.satiety + '%' }"></i></span>
                <b class="sat-num">{{ pet.satiety }}</b>
            </div>
            <button class="btn-primary feed-btn" :class="{ bumping: feed_bump }" @click="feed">
                投喂 · 道具 ×{{ pet.props }}
            </button>
            <div class="feed-tip">每日首次有效打卡或点评可获得投喂道具 · 道具不足去 <a @click="$router.push('/tasks')">任务中心</a> 赚</div>
        </div>

        <!-- 5.5 三宫格入口：形象 / 赚金币 / 社区（复刻 P14-宠物成长.html .tri：44px 白卡 contain） -->
        <div class="tri fade-up">
            <a class="tri-cell" @click="skin_open = true">
                <img src="/assets/icons/grid-avatar.png" alt="形象" />
                <span class="tt">形象</span>
                <span class="sub">基础 + 9 款装扮</span>
            </a>
            <router-link class="tri-cell" to="/tasks">
                <img src="/assets/icons/grid-coin.png" alt="赚金币" />
                <span class="tt">赚金币</span>
                <span class="sub">道具 ×{{ pet.props }}</span>
            </router-link>
            <router-link class="tri-cell" to="/pet-community">
                <img src="/assets/icons/grid-home.png" alt="社区" />
                <span class="tt">社区</span>
                <span class="sub">全服宠物墙</span>
            </router-link>
        </div>

        <!-- 6. 形象弹层：装扮橱窗 + 表情图鉴收进弹层，页面主体只保留三宫格入口（对齐 P14 openSkin） -->
        <div v-if="skin_open" class="skin-mask" @click.self="skin_open = false">
            <div class="skin-panel">
                <div class="sp-head">
                    <b>福宝的形象</b>
                    <span class="sp-close" aria-label="关闭" @click="skin_open = false">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </span>
                </div>
                <div class="sp-sec">装扮橱窗 <span>{{ pet.dress ? '已穿戴 · 再点一下脱下' : '点一件给福宝穿上' }}</span></div>
                <div class="face-grid">
                    <div
                        v-for="d in DRESSES" :key="d.id"
                        class="sg" :class="{ on: pet.dress === d.id }"
                        @click="toggle_dress(d.id)"
                    >
                        <span v-if="pet.dress === d.id" class="using">使用中</span>
                        <span class="sg-img"><img :src="`/assets/pet-dress/${d.id}.png`" :alt="d.name" /></span>
                        <div class="nm">{{ d.name }}</div>
                        <div class="tg">{{ d.tag }}</div>
                    </div>
                </div>
                <div class="sp-sec">表情图鉴 <span>不同状态有不同表情</span></div>
                <div class="face-grid">
                    <div v-for="f in FACES" :key="f.img" class="sg">
                        <span class="sg-img"><img :src="f.img" :alt="f.name" /></span>
                        <div class="nm">{{ f.name }}</div>
                        <div class="tg">{{ f.when }}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
/**
 * 宠物成长页（对齐 P14 + C13）：
 * 表情随饱腹度切换（>80 开心 / 40~80 平静 / 15~40 打瞌睡 / <15 生气），
 * 饥饿仅影响外观不扣数据（需求 5.1.7）；饱腹度条 + 投喂消耗道具；
 * 装扮橱窗横滑穿戴；成长等级行 + 任务入口。
 * 宠物后端暂无接口 → mock + localStorage dafu_pet（TODO: 待后端接口）
 */
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { load_json, save_json } from '../utils/storage.js';

const router = useRouter();

/* ---------------- mock 常量（TODO: 待后端接口） ---------------- */

// 宠物默认档案：饱腹度 78 / 道具 3 / 已点亮 128 天（与原型口径一致）
const DEFAULT_PET = { satiety: 78, props: 3, litDays: 128, growth: 320, level: 6, dress: null };

// 装扮橱窗：d1~d9
const DRESSES = [
    { id: 'd1', name: '砂锅蒸笼', tag: '80 金币' },
    { id: 'd2', name: '草莓罩', tag: '60 金币' },
    { id: 'd3', name: '饭团', tag: '60 金币' },
    { id: 'd4', name: '寿司卷', tag: '80 金币' },
    { id: 'd5', name: '汉堡', tag: '80 金币' },
    { id: 'd6', name: '草莓奶油', tag: '100 金币' },
    { id: 'd7', name: '红披风', tag: '120 金币' },
    { id: 'd8', name: '辣椒罩', tag: '80 金币' },
    { id: 'd9', name: '皇冠', tag: 'Lv.7 解锁' },
];

// 表情图鉴：全 10 款表情与触发场景（素材 03-IP形象与宠物 全量使用）
const FACES = [
    { img: '/assets/pet/base.png', name: '基础款', when: '初始形象' },
    { img: '/assets/pet/e-happy.png', name: '开心', when: '饱腹 80+' },
    { img: '/assets/pet/e-calm2.png', name: '满足', when: '刚被投喂' },
    { img: '/assets/pet/e-calm.png', name: '平静', when: '日常待机' },
    { img: '/assets/pet/e-sleep.png', name: '打瞌睡', when: '饱腹 15~40' },
    { img: '/assets/pet/e-angry.png', name: '生气', when: '饱腹 <15' },
    { img: '/assets/pet/e-shy.png', name: '害羞', when: '被同学摸摸' },
    { img: '/assets/pet/e-wrong.png', name: '委屈', when: '今天还没打卡' },
    { img: '/assets/pet/e-cry1.png', name: '哭泣', when: '连续 3 天未打卡' },
    { img: '/assets/pet/e-cry2.png', name: '水晶天使', when: '连续 5 天未打卡' },
];

// 升级门槛：成长值攒满 500 升 Lv.7 解锁皇冠
const GROWTH_MAX = 500;



/* ---------------- 状态 ---------------- */

const nick = ref('知食小王');
const pet = reactive({ ...DEFAULT_PET });
const feed_bump = ref(false); // 投喂后短暂切换「满足」表情
const float_on = ref(false); // 饱腹 +14 浮动反馈
const skin_open = ref(false); // 「形象」弹层：装扮橱窗 + 表情图鉴（页面主体不直接平铺）

// 宠物表情：按饱腹度分档（投喂瞬间切满足脸）
const pet_face = computed(() => {
    if (feed_bump.value) return '/assets/pet/e-calm2.png';
    if (pet.satiety > 80) return '/assets/pet/e-happy.png';
    if (pet.satiety >= 40) return '/assets/pet/e-calm.png';
    if (pet.satiety >= 15) return '/assets/pet/e-sleep.png';
    return '/assets/pet/e-angry.png';
});

// 成长进度百分比
const growth_pct = computed(() => Math.min(100, Math.round((pet.growth / GROWTH_MAX) * 100)));

// 等级提示文案
const level_tip = computed(() => {
    if (pet.growth >= GROWTH_MAX) return 'Lv.7 已达成 · 皇冠装扮已解锁';
    return `距离 Lv.7 还差 ${Math.ceil((GROWTH_MAX - pet.growth) / 10)} 次投喂 · 解锁皇冠装扮`;
});

/* ---------------- 生命周期 ---------------- */

onMounted(() => {
    // 合并默认档案，防旧数据缺字段
    Object.assign(pet, load_json('dafu_pet', { ...DEFAULT_PET }));
    const user = load_json('fk_user', null);
    if (user?.nickname) nick.value = user.nickname;
});

/* ---------------- 交互 ---------------- */

/**
 * 返回上一页
 */
function go_back() {
    router.back();
}

/**
 * 投喂：消耗道具 ×1 → 饱腹 +14、成长 +10，表情切「满足」反馈
 */
function feed() {
    if (pet.props < 1) {
        // 道具不足 → 引导去任务中心
        ElMessageBox.confirm('投喂道具不够啦，去任务中心做任务赢道具吧！', '道具不足', {
            confirmButtonText: '去任务中心', cancelButtonText: '先不了', type: 'warning',
        }).then(() => router.push('/tasks')).catch(() => {});
        return;
    }
    pet.props -= 1;
    pet.satiety = Math.min(100, pet.satiety + 14);
    pet.growth = Math.min(GROWTH_MAX, pet.growth + 10);
    if (pet.growth >= GROWTH_MAX && pet.level < 7) {
        pet.level = 7; // 升级解锁皇冠
        ElMessage.success('福宝升到 Lv.7，皇冠装扮已解锁！');
    }
    save_json('dafu_pet', { ...pet });
    // 反馈动画：满足表情 1.4s + 浮动数字 1s
    feed_bump.value = true;
    float_on.value = true;
    setTimeout(() => { feed_bump.value = false; }, 1400);
    setTimeout(() => { float_on.value = false; }, 1000);
}

/**
 * 穿戴 / 脱下装扮（穿戴后叠加在宠物图上）
 * @param {string} id 装扮 id
 */
function toggle_dress(id) {
    pet.dress = pet.dress === id ? null : id;
    save_json('dafu_pet', { ...pet });
}
</script>

<style scoped>
/* 顶部返回头 */
.topbar { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; min-height: 44px; }
.t-title { font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }
.t-hold { width: 40px; flex-shrink: 0; }
.icircle.back { color: var(--ink); }

/* 用户信息条 */
.user-row { display: flex; align-items: center; gap: 9px; padding-top: 10px; }
.nick { font-size: 14px; flex: 1; }
/* C13：已点亮 128 天 —— 小字 + 数字强调同行 */
.lit { display: flex; align-items: baseline; gap: 4px; }
.lit-t { font-size: 10.5px; color: var(--ink-2); }
.lit-n { font-size: 16px; color: var(--brand); }

/* 宠物舞台 */
.petstage { position: relative; height: 224px; display: flex; align-items: flex-end; justify-content: center; }
.tray {
    position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%);
    width: 210px; height: 26px; border-radius: 50%;
    background: radial-gradient(ellipse at center, #D9C69A 0%, rgba(217, 198, 154, 0) 72%);
}
/* 注意：根元素类名含 pet（page-wrap pet），图片规则必须限定在 .petstage 内，
   否则 .pet 会命中根容器导致整页被压成 168px（历史事故） */
.petstage .pet { width: 168px; height: 168px; object-fit: contain; position: relative; z-index: 2; transition: opacity .2s ease; }
/* 装扮叠加层：与宠物图同位覆盖（用 left 偏移定位，避免与 bump 动画的 transform 冲突） */
.petstage .pet.dress { position: absolute; left: calc(50% - 84px); bottom: 0; z-index: 3; pointer-events: none; }
.petstage .pet.bump { animation: bump .5s ease; }
@keyframes bump {
    0%, 100% { transform: translateY(0); }
    35% { transform: translateY(-10px) scale(1.04); }
    70% { transform: translateY(0); }
}
.float-plus {
    position: absolute; top: 34px; left: 50%; transform: translateX(-50%); z-index: 4;
    font-size: 12px; font-weight: 700; color: var(--brand-dark);
    background: var(--brand-light); border-radius: var(--radius-sm); padding: 3px 10px;
    animation: float_up 1s ease both;
}
@keyframes float_up {
    from { opacity: 0; transform: translate(-50%, 6px); }
    30% { opacity: 1; }
    to { opacity: 0; transform: translate(-50%, -22px); }
}

/* 名称 + 等级行 */
.pet-name { text-align: center; font-size: 16px; font-weight: 700; }
.lvrow { display: flex; align-items: center; justify-content: center; gap: 9px; margin-top: 10px; }
.lvb { width: 32px; height: 32px; border-radius: 50%; background: var(--brand); color: #FFFDF5; font-size: 10.5px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.bar { width: 150px; height: 12px; border-radius: 8px; background: #EDE0C2; overflow: hidden; }
.bar i { display: block; height: 100%; background: linear-gradient(90deg, #EBCF9C, var(--star)); border-radius: 8px; transition: width .3s ease; }
.gift { width: 28px; height: 28px; border-radius: 50%; background: var(--paper); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.gift img { width: 18px; height: 18px; object-fit: contain; }
.lv-tip { text-align: center; font-size: 9.5px; color: var(--ink-2); margin-top: 6px; }

/* 饥饿引导卡 */
.hungry { margin-top: 18px; }
.hungry b { font-size: 13px; }
.hungry p { font-size: 11px; color: #5C4A2E; line-height: 1.8; margin: 6px 0 12px; }
.hungry p b { font-size: 11px; color: var(--brand-dark); }
.hungry-btn { width: 100%; height: 40px; }

/* 饱腹度 + 投喂 */
.feed-zone { margin-top: 24px; }
.sat-row { display: flex; align-items: center; gap: 9px; }
.sat-label { font-size: 10.5px; color: var(--ink-2); flex-shrink: 0; }
.sat-bar { flex: 1; height: 10px; border-radius: 8px; background: #EDE0C2; overflow: hidden; }
.sat-bar i { display: block; height: 100%; background: linear-gradient(90deg, #EBCF9C, var(--star)); border-radius: 8px; transition: width .3s ease; }
.sat-num { font-size: 13px; min-width: 26px; text-align: right; }
.feed-btn { display: flex; width: 200px; height: 42px; margin: 14px auto 0; font-size: 14px; font-weight: 800; }
.feed-btn.bumping { animation: bump .5s ease; }
.feed-tip { text-align: center; font-size: 10px; color: var(--ink-2); margin-top: 9px; line-height: 1.7; }
.feed-tip a { color: var(--brand); font-weight: 700; cursor: pointer; }

/* 三宫格入口：形象 / 赚金币 / 社区（复刻 P14 .tri：3 列白卡 + 44px contain 贴纸） */
.tri { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 14px; }
.tri-cell {
    background: var(--paper); border-radius: 14px; box-shadow: var(--shadow-soft);
    display: flex; flex-direction: column; align-items: center; padding: 14px 0 12px; gap: 6px;
    cursor: pointer; transition: transform .08s ease;
    text-decoration: none; color: inherit; /* router-link 渲染为 a，去掉默认下划线与链接色 */
}
.tri-cell:active { transform: translateY(1px); }
.tri-cell img { width: 44px; height: 44px; object-fit: contain; }
.tri-cell .tt { font-size: 11.5px; font-weight: 700; color: var(--ink); }
.tri-cell .sub { font-size: 9px; color: var(--ink-2); }

.sg { position: relative; flex: 0 0 76px; text-align: center; }
/* 方形图外框：圆润描边容器 + overflow hidden，贴纸 contain 完整显示 */
.sg-img {
    display: block; width: 64px; height: 64px; margin: 0 auto;
    border-radius: 14px; border: 1.5px solid var(--line); background: var(--paper);
    overflow: hidden; transition: border-color .12s ease;
}
.sg-img img {
    /* 完整贴纸 contain 显示，不放大裁切（与原型一致的查看比例） */
    width: 100%; height: 100%; object-fit: contain;
}
.sg.on .sg-img { border-color: var(--brand); background: var(--brand-light); }
.sg .using {
    position: absolute; top: -5px; left: 2px; font-size: 8px;
    background: var(--brand); color: #FFF; padding: 1px 5px; border-radius: 6px; z-index: 1;
}
.sg .nm { font-size: 9.5px; font-weight: 600; margin-top: 4px; }
.sg .tg { font-size: 8.5px; color: var(--ink-2); }

/* 形象弹层：遮罩 + 底部弹出卡（层级高于 tabbar，装扮/表情网格平铺，整层竖直滚动） */
.skin-mask {
    position: fixed; inset: 0; z-index: 300; /* 高于 tabbar(200)，底部内容不被导航遮挡 */
    background: rgba(58, 46, 26, .4);
    display: flex; align-items: flex-end; justify-content: center;
    animation: fade_in .18s ease;
}
@keyframes fade_in { from { opacity: 0; } to { opacity: 1; } }
.skin-panel {
    width: 100%; max-height: 82vh; overflow-y: auto;
    background: var(--page); border-radius: 20px 20px 0 0;
    padding: 16px 16px 28px; animation: slide_up .22s ease;
    /* 整层竖直滚动，滚动轴全部隐藏 */
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.skin-panel::-webkit-scrollbar { display: none; }
@keyframes slide_up { from { transform: translateY(40px); opacity: .4; } to { transform: none; opacity: 1; } }
.sp-head { display: flex; align-items: center; margin-bottom: 4px; }
.sp-head b { font-size: 15px; }
.sp-close {
    margin-left: auto; width: 30px; height: 30px; border-radius: 50%;
    background: var(--paper); box-shadow: var(--shadow-soft);
    display: flex; align-items: center; justify-content: center;
    color: var(--ink-2); cursor: pointer;
}
.sp-sec { font-size: 13px; font-weight: 800; margin: 14px 0 10px; display: flex; align-items: baseline; gap: 8px; }
.sp-sec span { font-size: 10px; font-weight: 400; color: var(--ink-2); }
/* 装扮 + 表情统一网格平铺（4 列） */
.face-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 6px; }
.face-grid .sg { flex: none; }

/* ===== 桌面适配（≥769）===== */
@media (min-width: 769px) {
    /* 整页限宽 860 居中（限定根组合类，避免命中 .petstage 内的 .pet 图片） */
    .page-wrap.pet { max-width: 860px; }
    /* 宠物舞台居中放大：宠物图 168 → 210，舞台高度随行 */
    .petstage { height: 272px; }
    .petstage .pet { width: 210px; height: 210px; }
    /* 装扮叠加层随放大后的宠物图同位对齐（半宽偏移 84 → 105） */
    .petstage .pet.dress { left: calc(50% - 105px); }
    /* 投喂区桌面横排：饱腹度条占左、投喂按钮占右，提示行跨两列 */
    .feed-zone {
        display: grid; grid-template-columns: 1fr auto;
        align-items: center; column-gap: 24px;
    }
    .sat-row { grid-column: 1; }
    .feed-btn { grid-column: 2; grid-row: 1; width: 220px; margin: 0; }
    .feed-tip { grid-column: 1 / -1; }
    /* 形象弹层：桌面限宽居中，格子加大 */
    .skin-panel { max-width: 560px; margin: 0 auto; }
    .sg-img { width: 72px; height: 72px; }
}

/* ===== 桌面适配（≥1200）===== */
</style>
