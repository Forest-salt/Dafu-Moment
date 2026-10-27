<template>
    <div class="page-wrap footprint">
        <!-- 顶部返回头 -->
        <div class="topbar">
            <span class="icircle back" aria-label="返回" @click="go_back">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
            </span>
            <b class="t-title">足迹与手账</b>
            <i class="t-hold"></i>
        </div>

        <!-- 1. 累计统计：三列纯数字强调（去胶囊去外框，C18 口径） -->
        <section class="cum fade-up">
            <div class="c">
                <b class="score-num">{{ total_count }}</b>
                <div>累计打卡次数</div>
            </div>
            <div class="c">
                <b class="score-num">{{ spot_count }}</b>
                <div>去过点位数</div>
            </div>
            <div class="c">
                <b class="score-num">{{ streak }}<small> 天</small></b>
                <div>连续打卡</div>
            </div>
        </section>

        <!-- 打卡直达入口：此前足迹页无打卡按钮（需绕回其它页面），主按钮醒目常驻 -->
        <button class="btn-primary ck-cta fade-up" @click="$router.push('/checkin')">今天吃什么 · 打个卡</button>

        <!-- 2. 打卡月历：自制网格月历，打卡日淡金底 + 圆点，月份可切换
             （split-l 为桌面分栏左列容器，移动端 display:contents 不影响布局） -->
        <div class="split-l">
        <section class="card cal fade-up">
            <div class="calhead">
                <b>我的干饭日历</b>
                <span class="cal-nav">
                    <i aria-label="上一月" @click="shift_month(-1)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
                    </i>
                    <em>{{ cur_year }} 年 {{ cur_month }} 月</em>
                    <i aria-label="下一月" @click="shift_month(1)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7" /></svg>
                    </i>
                </span>
            </div>
            <div class="calgrid">
                <span v-for="w in WEEKS" :key="w" class="wd">{{ w }}</span>
                <template v-for="(cell, i) in cal_cells" :key="i">
                    <span v-if="!cell" class="cell empty"></span>
                    <div
                        v-else class="cell"
                        :class="{ hit: !!day_map[cell.key], today: cell.key === today_key }"
                        @click="day_map[cell.key] && open_detail(day_map[cell.key][0])"
                    >
                        <span class="d">{{ cell.d }}</span>
                        <!-- 打卡日：食物小贴纸 + 淡金底 -->
                        <span v-if="day_map[cell.key]" class="sticker">
                            <img :src="cell_img(day_map[cell.key][0])" alt="" />
                        </span>
                        <span v-if="day_map[cell.key]" class="dot"></span>
                    </div>
                </template>
            </div>
            <div class="monthtag">点格上的食物照片查看当日食集 · 本月已打卡 {{ month_count }} 天</div>
        </section>

        <!-- 打卡记录：全量流水列表（容器限高内部滚动），点行开「当日食集」弹窗 -->
        <div class="card rec-list fade-up">
            <div class="rec-head"><b>打卡记录</b><span>共 {{ total_count }} 条</span></div>
            <div class="rec-scroll">
                <div v-for="r in sorted_checkins" :key="r.id" class="rec-row" @click="open_detail(r)">
                    <span class="rec-date">{{ cn_date(r.date) }} · {{ r.meal }}</span>
                    <span class="rec-shop">{{ r.canteenName }}</span>
                    <span class="rec-dish">{{ (r.dishes || []).map((d) => d.name).join('、') }}</span>
                    <i>›</i>
                </div>
                <div v-if="sorted_checkins.length === 0" class="empty-tip">还没有打卡记录，去第一打卡点亮足迹</div>
            </div>
        </div>
        </div>

        <!-- 3. 个人就餐足迹：点位卡（首次点亮小签） -->
        <!-- split-r 为桌面分栏右列容器（足迹 + 手账卡流），移动端 display:contents -->
        <div class="split-r">
        <!-- 桌面端右列视图切换：就餐足迹 / 美食手账（移动端隐藏，两段全显） -->
        <div class="r-tabs" role="tablist">
            <i :class="{ on: r_tab === 'spot' }" role="tab" @click="r_tab = 'spot'">就餐足迹</i>
            <i :class="{ on: r_tab === 'journal' }" role="tab" @click="r_tab = 'journal'">美食手账</i>
        </div>
        <!-- 就餐足迹面板：桌面端随切换显隐，移动端常显 -->
        <div v-show="!is_desktop || r_tab === 'spot'" class="r-pane">
        <div class="sec"><b>就餐足迹</b><span>{{ spots.length }} 个点位被点亮</span></div>
        <section class="spot-list">
            <div
                v-for="(s, i) in spots_shown" :key="s.id"
                class="card spot-card fade-up"
                :class="{ jump: can_spot(s.id) }"
                :style="{ animationDelay: `${(i % 4) * 40}ms` }"
                @click="go_spot(s)"
            >
                <div class="spot-thumb img-fallback">
                    <img :src="s.img" alt="" />
                </div>
                <div class="spot-info">
                    <div class="spot-line1">
                        <b>{{ s.name }}</b>
                        <span v-if="is_recent(s.firstDate)" class="tag lit-tag">首次点亮</span>
                    </div>
                    <div class="spot-line2">首打卡 {{ s.firstDate }} · 已去 {{ s.count }} 次</div>
                </div>
                <i v-if="can_spot(s.id)" class="spot-arr">›</i>
            </div>
            <div v-if="spots.length === 0" class="empty-tip">还没有足迹，去打卡点亮第一家店</div>
        </section>
        <!-- 展示更多 / 收起：分页步进，右列不再被长列表无限拉高（桌面高度失衡根因） -->
        <div v-if="spots.length > spots_shown.length" class="more-row" @click="spot_limit += SPOT_PAGE">
            展示更多（还有 {{ spots.length - spots_shown.length }} 家）
        </div>
        <div v-else-if="spot_limit > SPOT_PAGE" class="more-row ghost" @click="spot_limit = SPOT_PAGE">收起</div>
        </div>

        <!-- 4. 美食手账卡流：照片 + 随笔摘要 → /journal/:id（今日/本周/全部切换，对齐 P12 日报/周报口径） -->
        <div v-show="!is_desktop || r_tab === 'journal'" class="r-pane">
        <div class="sec">
            <b>美食手账</b>
            <span class="j-tabs">
                <i :class="{ on: j_range === 'day' }" @click="set_range('day')">今日</i>
                <i :class="{ on: j_range === 'week' }" @click="set_range('week')">本周</i>
                <i :class="{ on: j_range === 'all' }" @click="set_range('all')">全部</i>
            </span>
            <span class="j-new" @click="$router.push('/journal/edit')">创作手账 ›</span>
        </div>
        <section class="j-list">
            <div v-for="(j, i) in j_shown" :key="j.id" class="card j-card fade-up" :style="{ animationDelay: `${(i % 4) * 40}ms` }" @click="$router.push(`/journal/${j.id}`)">
                <div class="j-thumb sticker-thumb">
                    <img :src="j_cover(j)" alt="" loading="lazy" />
                </div>
                <div class="j-info">
                    <div class="j-line1">
                        <b>{{ j.title || cn_date(j.date) }}</b>
                        <span class="chip">私有</span>
                    </div>
                    <p class="j-note">{{ j.text || '用贴纸记录了这一餐的美好' }}</p>
                    <div class="j-sub">{{ cn_date(j.date) }} · {{ (j.layout || []).length }} 个贴纸/文字贴</div>
                </div>
            </div>
            <div v-if="j_filtered.length === 0" class="empty-tip">{{ j_range === 'day' ? '今天还没有手账，去创作一篇' : j_range === 'week' ? '本周还没有手账，去创作一篇' : '手账还是空的，去创作第一篇贴纸手账' }}</div>
        </section>
        <div v-if="j_filtered.length > j_shown.length" class="more-row" @click="j_limit += J_PAGE">
            展示更多（还有 {{ j_filtered.length - j_shown.length }} 篇）
        </div>
        <div v-else-if="j_limit > J_PAGE" class="more-row ghost" @click="j_limit = J_PAGE">收起</div>
        </div>
        </div>

        <!-- 营养成分弹窗（C12：店铺行整行可点 → /station/:id） -->
        <div v-if="detail" class="mask" @click.self="detail = null">
            <div class="modal fade-up">
                <span class="mclose" aria-label="关闭" @click="detail = null">×</span>
                <span class="m-sub">{{ cn_date(detail.date) }} · {{ detail.meal }}</span>
                <b class="m-title">当日食集</b>
                <div class="m-pic img-fallback">
                    <img :src="cell_img(detail)" alt="当日食物" />
                </div>
                <div class="m-dish">{{ (detail.dishes || []).map((d) => d.name).join(' · ') }}</div>

                <!-- 本餐花费：唯一真实金额口径（后端 dish 无营养字段，故不做热量/营养成分展示） -->
                <div class="m-kcal">
                    <b class="score-num">¥{{ order_total }}</b>
                    <span>本餐花费</span>
                </div>

                <!-- 店铺行：真实食区可整行点击跳详情；本地示例数据（假 ID）置灰不可点，避免 404 误跳 -->
                <div class="m-shop" :class="{ off: !can_jump }" @click="can_jump && go_station()">
                    <div class="m-shop-label">店铺</div>
                    <b>{{ detail.canteenName }}</b>
                    <svg v-if="can_jump" class="m-arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7" /></svg>
                </div>

                <div v-if="detail.note" class="m-note-wrap">
                    <div class="m-note-label">我的笔记</div>
                    <div class="m-note">{{ detail.note }}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
/**
 * 足迹与手账页（对齐 P12）：
 * 累计统计三列纯数字 / 自制打卡月历（淡金底+圆点+贴纸）/
 * 就餐足迹点位卡（首次点亮）/ 美食手账卡流 → /journal/:id /
 * 「当日食集」弹窗（店铺行 → /canteen/:id，修改说明 C12）。
 * 数据源 localStorage dafu_checkins（真实打卡流水，无数据即空态；TODO: 待后端接口）
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { api_content, api_journal } from '../api';
import { load_json, save_json } from '../utils/storage.js';

const router = useRouter();

const WEEKS = ['一', '二', '三', '四', '五', '六', '日'];

/* ---------------- 真实档口映射 ---------------- */

// 真实食区 ID 集合：弹窗店铺行 / 足迹点位卡跳转有效性判断
const real_ids = ref(new Set());

/**
 * 拉取真实档口：仅维护可跳转的食区 ID 集合；后端不可用时集合为空（跳转一律置灰）
 */
async function load_real_canteens() {
    try {
        const res = await api_content.canteens();
        // 兼容三种解包形态：数组直返 / {data:[...]} / {data:{list:[...]}}
        const list = Array.isArray(res) ? res : res?.data?.list || res?.data || [];
        if (!Array.isArray(list)) throw new Error('empty');
        real_ids.value = new Set(list.map((c) => Number(c.id)));
    } catch { /* 后端不可用：集合保持为空 */ }
}



/**
 * 日期格式化 YYYY-MM-DD（本地时区）
 * @param {Date} d 日期对象
 * @returns {string} 格式化结果
 */
function fmt_date(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

/* ---------------- 状态 ---------------- */

const checkins = ref([]); // 打卡流水（日历/统计/足迹/手账共同数据源）
const cur = ref(new Date()); // 月历当前月
const detail = ref(null); // 「当日食集」弹窗当前记录

const today_key = fmt_date(new Date());
const cur_year = computed(() => cur.value.getFullYear());
const cur_month = computed(() => cur.value.getMonth() + 1);

/* ---------------- 生命周期 ---------------- */

onMounted(async () => {
    // 拉真实档口：维护可跳转食区 ID 集合
    await load_real_canteens();
    // 读取本机打卡流水；清理历史演示假 ID（1001-1003）残留，保证与真实数据一致
    let list = load_json('dafu_checkins', []);
    if (!Array.isArray(list)) list = [];
    const cleaned = list.filter((c) => ![1001, 1002, 1003].includes(Number(c.canteenId)));
    if (cleaned.length !== list.length) save_json('dafu_checkins', cleaned);
    checkins.value = cleaned;
    // 创作手账（后端）
    load_journals();
});

/* ---------------- 统计 ---------------- */

const total_count = computed(() => checkins.value.length);

/* 打卡流水按日期倒序（记录列表：最近在前） */
const sorted_checkins = computed(() => [...checkins.value].sort((a, b) => b.date.localeCompare(a.date)));

const spot_count = computed(() => new Set(checkins.value.map((c) => c.canteenId)).size);

/**
 * 连续打卡天数：今天没打卡则从昨天起算，不中断连续
 */
const streak = computed(() => {
    const set = new Set(checkins.value.map((c) => c.date));
    let n = 0;
    const d = new Date();
    if (!set.has(fmt_date(d))) d.setDate(d.getDate() - 1);
    while (set.has(fmt_date(d))) {
        n += 1;
        d.setDate(d.getDate() - 1);
    }
    return n;
});

/* ---------------- 月历 ---------------- */

// 当月格子（周一起头，前置 null 补位）
const cal_cells = computed(() => {
    const y = cur.value.getFullYear();
    const m = cur.value.getMonth();
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const total = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < lead; i += 1) cells.push(null);
    for (let d = 1; d <= total; d += 1) {
        cells.push({ d, key: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }
    return cells;
});

// 日期 → 打卡记录映射
const day_map = computed(() => {
    const map = {};
    for (const c of checkins.value) {
        (map[c.date] = map[c.date] || []).push(c);
    }
    return map;
});

// 本月已打卡天数
const month_count = computed(() => {
    const prefix = `${cur_year.value}-${String(cur_month.value).padStart(2, '0')}`;
    return Object.keys(day_map.value).filter((k) => k.startsWith(prefix)).length;
});

/**
 * 切换月份
 * @param {number} dir -1 上一月 / 1 下一月
 */
function shift_month(dir) {
    cur.value = new Date(cur.value.getFullYear(), cur.value.getMonth() + dir, 1);
}

/* ---------------- 足迹聚合 ---------------- */

// 按点位聚合：图 / 名 / 首打卡日期 / 次数
const spots = computed(() => {
    const map = new Map();
    const asc = [...checkins.value].sort((a, b) => a.date.localeCompare(b.date));
    for (const c of asc) {
        if (!map.has(c.canteenId)) {
            map.set(c.canteenId, { id: c.canteenId, name: c.canteenName, firstDate: c.date, count: 0, img: c.dishes?.[0]?.img });
        }
        map.get(c.canteenId).count += 1;
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
});

/**
 * 首打卡是否在近 7 天内（用于「首次点亮」小签）
 * @param {string} date YYYY-MM-DD
 * @returns {boolean} 是否近期首次
 */
function is_recent(date) {
    const t = new Date();
    const d = new Date(date.replace(/-/g, '/'));
    return (t - d) / 86400000 <= 7;
}

/* ---------------- 手账卡流 ---------------- */

/* ---------------- 手账（后端创作手账，r52 编辑器作品） ---------------- */

const j_all = ref([]);

/**
 * 手账封面：cover 对象键 → /img/；内置贴纸静态路径直接用；无封面用主题贴纸兜底
 * @param {object} j 手账
 */
function j_cover(j) {
    if (j.cover) return j.cover.startsWith('/assets/') ? j.cover : `/img/${j.cover}`;
    const first = (j.layout || []).find((b) => b.kind === 'sticker');
    return first ? first.src : '/assets/food-stickers/food-02.png';
}

/* 手账时间范围：day 今日 / week 本周（周一起） / all 全部 */
const j_range = ref('week');

const j_filtered = computed(() => {
    if (j_range.value === 'all') return j_all.value;
    const now = new Date();
    const today = fmt_date(now);
    if (j_range.value === 'day') return j_all.value.filter((j) => j.date === today);
    const mon = new Date(now);
    mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const mon_key = fmt_date(mon);
    return j_all.value.filter((j) => j.date >= mon_key && j.date <= today);
});

/** 拉取我的创作手账 */
async function load_journals() {
    try {
        const r = await api_journal.list();
        j_all.value = r || [];
    } catch { /* 未登录等场景忽略 */ }
}

/* ---------------- 桌面右列切换与分页展示 ---------------- */

/* 分页步长：「展示更多」每次追加的条数 */
const SPOT_PAGE = 4;
const J_PAGE = 4;

/* 桌面断点同步：≥769px 时右列切换单视图，移动端两段全显 */
const mq_desktop = window.matchMedia('(min-width: 769px)');
const is_desktop = ref(mq_desktop.matches);

/**
 * 同步桌面断点状态（窗口跨断点拖动时共用同一数据源）
 * @param {MediaQueryListEvent} e 断点变化事件
 */
function on_mq_change(e) {
    is_desktop.value = e.matches;
}
onMounted(() => mq_desktop.addEventListener('change', on_mq_change));
onUnmounted(() => mq_desktop.removeEventListener('change', on_mq_change));

/* 右列当前视图（仅桌面生效）：spot 就餐足迹 / journal 美食手账 */
const r_tab = ref('spot');
const spot_limit = ref(SPOT_PAGE);
const j_limit = ref(J_PAGE);

/* 分页可见切片：未到上限时只展示前 N 条，避免右列被长列表无限拉高 */
const spots_shown = computed(() => spots.value.slice(0, spot_limit.value));
const j_shown = computed(() => j_filtered.value.slice(0, j_limit.value));

/**
 * 切换手账时间范围并重置分页
 * @param {string} r day 今日 / week 本周 / all 全部
 */
function set_range(r) {
    j_range.value = r;
    j_limit.value = J_PAGE;
}

/* ---------------- 当日食集弹窗 ---------------- */

// 本餐花费：所选菜品价格合计
const order_total = computed(() => (detail.value?.dishes || []).reduce((s, d) => s + (Number(d.price) || 0), 0));

/**
 * 打开「当日食集」弹窗
 * @param {object} rec 打卡记录
 */
function open_detail(rec) {
    detail.value = rec;
}

/* 弹窗店铺行可跳转：当前记录的食区 ID 在真实食区集合内（本地示例假 ID 置灰不可点） */
const can_jump = computed(() => !!detail.value && real_ids.value.has(Number(detail.value.canteenId)));

/**
 * 弹窗店铺行 → 食区详情（C12：打卡点位＝食区，canteenId 跳 /canteen/:id）
 */
function go_station() {
    if (!can_jump.value) return;
    router.push(`/canteen/${detail.value.canteenId}`);
}

/**
 * 足迹点位是否可进入详情（本地示例假 ID 无真实食区，置灰不可点）
 * @param {number|string} id 食区 ID
 * @returns {boolean}
 */
function can_spot(id) {
    return real_ids.value.has(Number(id));
}

/**
 * 点足迹点位卡 → 食区详情（与弹窗店铺行同一跳转口径）
 * @param {object} s 足迹点位（含 id/name）
 */
function go_spot(s) {
    if (!can_spot(s.id)) return;
    router.push(`/canteen/${s.id}`);
}

/* ---------------- 通用 ---------------- */

/**
 * 返回上一页
 */
function go_back() {
    router.back();
}

/**
 * 取记录展示图：优先本地照片 → 菜品图 → 自动抠图食物贴纸（手账贴纸兜底）
 * 贴纸按记录关键字段稳定哈希选取，同一条记录恒定同一张贴纸
 * @param {object} rec 打卡记录
 * @returns {string} 图片地址
 */
/* 兜底食物贴纸：仅用现存素材 food-02~food-08（food-01/food-09 为坏素材已剔除，引用会 404） */
const STICKERS = Array.from({ length: 7 }, (_, i) => `/assets/food-stickers/food-0${i + 2}.png`);

function cell_img(rec) {
    if (rec.photos?.[0]) return rec.photos[0];
    if (rec.dishes?.[0]?.img) return rec.dishes[0].img;
    const key = `${rec.date}|${rec.canteenId}|${(rec.dishes || []).map((d) => d.name).join(',')}`;
    let h = 0;
    for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return STICKERS[h % STICKERS.length];
}

/**
 * 日期转中文展示（10 月 3 日）
 * @param {string} date YYYY-MM-DD
 * @returns {string} 中文日期
 */
function cn_date(date) {
    const [, m, d] = date.split('-');
    return `${Number(m)} 月 ${Number(d)} 日`;
}
</script>

<style scoped>
/* 顶部返回头 */
.topbar { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; min-height: 44px; }
.t-title { font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }
.t-hold { width: 40px; flex-shrink: 0; }
.icircle.back { color: var(--ink); }

/* 三列纯数字统计（去外框去胶囊） */
.cum { display: flex; gap: 12px; padding: 18px 0 0; }
.cum .c { flex: 1; text-align: center; }
.cum b { font-size: 24px; font-weight: 800; color: var(--ink); }
.cum b small { font-size: 11px; color: var(--ink-2); font-weight: 400; }
.cum .c div { font-size: 10px; color: var(--ink-2); margin-top: 3px; }

/* 打卡直达主按钮：通栏琥珀实底，醒目常驻（该页此前无打卡入口） */
.ck-cta { width: 100%; margin-top: 18px; padding: 13px 0; font-size: 14px; }

/* 月历卡 */
.cal { margin-top: 24px; }
.calhead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.calhead b { font-size: 14px; }
.cal-nav { display: flex; align-items: center; gap: 8px; }
.cal-nav i { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; color: var(--ink-2); cursor: pointer; border-radius: 6px; }
.cal-nav i:hover { background: var(--brand-light); color: var(--brand-dark); }
.cal-nav em { font-style: normal; font-size: 10.5px; color: var(--ink-2); }
.calgrid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.wd { font-size: 9px; color: var(--ink-2); text-align: center; padding-bottom: 5px; }
.cell {
    position: relative; height: 36px; border-radius: 6px; overflow: hidden;
    background: transparent; border: 1px solid transparent;
}
.cell.hit { background: var(--brand-light); cursor: pointer; }
.cell.today { border-color: var(--brand); }
.cell .d { position: absolute; left: 4px; top: 2px; font-size: 9px; color: var(--ink-2); }
.cell.hit .d { color: var(--ink-3); }
.cell .sticker { position: absolute; right: 1px; bottom: 1px; width: 22px; height: 22px; }
.cell .sticker img { width: 100%; height: 100%; object-fit: cover; border-radius: 5px; }
.cell .dot { position: absolute; left: 50%; transform: translateX(-50%); bottom: 2px; width: 4px; height: 4px; border-radius: 50%; background: var(--star); }
.cell.empty { background: transparent; }
.monthtag { font-size: 9.5px; color: var(--ink-2); text-align: right; margin-top: 8px; }

/* 足迹点位卡 */
.spot-list { display: flex; flex-direction: column; gap: 12px; }
.spot-card { display: flex; align-items: center; gap: 12px; }
/* 可进入的点位卡：整卡可点进食区详情，右侧箭头提示 */
.spot-card.jump { cursor: pointer; }
.spot-card.jump:hover { border-color: var(--brand); }
.spot-arr { margin-left: auto; font-style: normal; font-size: 16px; color: var(--ink-2); flex-shrink: 0; }
.spot-thumb { width: 52px; height: 52px; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; }
.spot-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.spot-info { flex: 1; min-width: 0; }
.spot-line1 { display: flex; align-items: center; gap: 8px; }
.spot-line1 b { font-size: 13.5px; }
.lit-tag { background: var(--sun); color: #7A5514; opacity: 0.9; }
.spot-line2 { font-size: 10.5px; color: var(--ink-2); margin-top: 4px; }

/* 手账卡流 */
.j-list { display: flex; flex-direction: column; gap: 12px; }
/* 手账 日/周 切换：淡金分段控件（今日/本周/全部） */
.j-tabs { display: inline-flex; background: var(--paper); border-radius: 999px; padding: 2px; gap: 2px; }
.j-tabs i { font-style: normal; font-size: 10.5px; font-weight: 600; color: var(--ink-2); padding: 3px 10px; border-radius: 999px; cursor: pointer; }
.j-tabs i.on { background: var(--brand); color: #FFFDF5; }
.j-new { color: var(--brand-dark); }
.j-card { display: flex; gap: 12px; cursor: pointer; }
.j-thumb { width: 74px; height: 74px; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; }
/* 手账封面：贴纸白底完整显示（不裁切，手账贴纸感） */
.j-thumb.sticker-thumb { background: #FFFDF5; border: 1px solid var(--paper-line); display: grid; place-items: center; padding: 6px; }
.j-thumb.sticker-thumb img { width: 100%; height: 100%; object-fit: contain; }
.j-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.j-info { flex: 1; min-width: 0; }
.j-line1 { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.j-line1 b { font-size: 13px; }
.j-note {
    font-size: 11px; color: #5C4A2E; line-height: 1.7; margin: 5px 0 0;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.j-sub { font-size: 10px; color: var(--ink-2); margin-top: 5px; }

/* 打卡记录：全量流水列表（容器限高内部滚动） */
.rec-list { margin-top: 14px; padding: 14px 16px; }
.rec-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.rec-head b { font-size: 12.5px; }
.rec-head span { font-size: 10px; color: var(--ink-2); }
.rec-scroll { max-height: 264px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.rec-row {
    display: flex; align-items: center; gap: 8px;
    background: var(--brand-light); border-radius: var(--radius-sm);
    padding: 8px 10px; cursor: pointer; transition: filter .12s ease;
}
.rec-row:hover { filter: brightness(0.96); }
.rec-date { flex-shrink: 0; width: 96px; font-size: 10px; color: var(--ink-2); }
.rec-shop { flex-shrink: 0; font-size: 11px; font-weight: 700; }
.rec-dish { flex: 1; min-width: 0; font-size: 10.5px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rec-row i { margin-left: auto; font-style: normal; font-size: 11px; color: var(--ink-2); flex-shrink: 0; }

/* 空态 */
.empty-tip { font-size: 11px; color: var(--ink-2); text-align: center; padding: 18px 0; }

/* 右列视图切换 tabs（桌面端专用；移动端 display:none 隐藏） */
.r-tabs { display: none; }
/* 展示更多 / 收起：分页步进按钮（胶囊淡金底） */
.more-row {
    margin-top: 12px; text-align: center; font-size: 11px; font-weight: 600;
    color: var(--brand-dark); background: var(--brand-light);
    border-radius: 999px; padding: 9px 0; cursor: pointer; white-space: nowrap;
    transition: filter .12s ease;
}
.more-row:hover { filter: brightness(0.96); }
.more-row.ghost { background: transparent; color: var(--ink-2); font-weight: 400; }

/* 「当日食集」弹窗 */
.mask { position: fixed; inset: 0; background: rgba(58, 46, 26, 0.4); z-index: 30; display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal { width: 309px; max-width: 100%; background: var(--paper); border-radius: var(--radius); box-shadow: 0 8px 30px rgba(58, 46, 26, 0.3); padding: 16px; position: relative; }
.mclose {
    position: absolute; top: -8px; left: -8px; width: 28px; height: 28px; border-radius: 50%;
    background: var(--ink); color: #FFFDF5; display: flex; align-items: center; justify-content: center;
    font-size: 13px; cursor: pointer; z-index: 1;
}
.m-sub { font-size: 10px; color: var(--ink-2); }
.m-title { display: block; font-size: 17px; margin: 4px 0 10px; }
.m-pic { position: relative; border-radius: var(--radius-sm); overflow: hidden; height: 150px; }
.m-pic img { width: 100%; height: 100%; object-fit: cover; display: block; }
.m-dish { font-size: 11px; color: var(--ink-2); margin: 10px 0 12px; }

/* 本餐花费大数字 */
.m-kcal { text-align: center; padding: 2px 0 10px; }
.m-kcal b { display: block; font-size: 34px; font-weight: 800; color: #B85A2A; }
.m-kcal span { font-size: 9px; color: var(--ink-2); letter-spacing: 2px; }

/* 店铺行：整行可点（C12） */
.m-shop {
    display: flex; align-items: center; gap: 8px;
    background: #FBF4E4; border-radius: var(--radius-sm); padding: 10px 12px;
    cursor: pointer; transition: background .12s ease;
}
.m-shop:hover { background: var(--brand-light); }
/* 本地示例假 ID：置灰不可点，避免跳转 404 */
.m-shop.off { cursor: default; opacity: 0.55; }
.m-shop.off:hover { background: #FBF4E4; }
.m-shop-label { font-size: 10px; color: var(--ink-2); flex-shrink: 0; }
.m-shop b { font-size: 12.5px; color: var(--ink); flex: 1; }
.m-arr { width: 14px; height: 14px; color: var(--ink-2); flex-shrink: 0; }

/* 我的笔记 */
.m-note-wrap { margin-top: 12px; }
.m-note-label { font-size: 10px; color: var(--ink-2); margin-bottom: 5px; }
.m-note { border: 1px dashed var(--line); border-radius: var(--radius-sm); min-height: 56px; padding: 8px 10px; font-size: 11.5px; line-height: 1.8; color: #5C4A2E; }

/* 桌面分栏容器：移动端 display:contents，完全不影响现有流式布局 */
.split-l, .split-r { display: contents; }

/* ===== 桌面适配（≥769）===== */
@media (min-width: 769px) {
    /* 桌面单列下拉布局：内容限宽居中，通栏顺排（统计 → 日历+记录 → 切换 tabs + 列表），
       彻底消除左右分栏的高度差问题；列表容器限高内部滚动，页面不被拉长 */
    .page-wrap.footprint {
        display: block; max-width: 760px; margin: 0 auto;
    }
    .split-l, .split-r { display: block; }
    /* 列表容器限高：记录/足迹/手账超长内部滚动，不无限拉页 */
    .rec-scroll { max-height: 300px; }
    .spot-list, .j-list { max-height: 480px; overflow-y: auto; padding-right: 2px; }
    /* 右列切换 tabs：淡金分段控件，与移动端 j-tabs 视觉同族 */
    .r-tabs {
        display: inline-flex; width: fit-content;
        background: var(--paper); border-radius: 999px; padding: 3px; gap: 3px;
        box-shadow: inset 0 0 0 1px var(--paper-line);
        margin-top: 18px;   /* 与上方打卡记录卡拉开间距（截图反馈：贴太近） */
        margin-bottom: 10px;
    }
    .r-tabs i {
        font-style: normal; font-size: 12px; font-weight: 700; color: var(--ink-2);
        padding: 6px 18px; border-radius: 999px; cursor: pointer; white-space: nowrap;
    }
    .r-tabs i.on { background: var(--brand); color: #FFFDF5; }
}

/* ===== 桌面适配二档（≥1200）===== */
@media (min-width: 1200px) {
    /* 宽屏单列稍放宽 */
    .page-wrap.footprint { max-width: 820px; }
}
</style>
