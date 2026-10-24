<template>
    <div class="page-wrap collection-page">
        <!-- 标题行：返回 + 居中标题（P22） -->
        <div class="titlebar">
            <button class="icircle back" aria-label="返回" @click="go_back">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <b class="title">我的收藏</b>
        </div>

        <!-- 分组 Tab：想吃[默认] / 常吃 / 自定义（可切 + 数量徽记） -->
        <div class="grouptabs">
            <span
                v-for="g in group_tabs" :key="g.key"
                :class="{ on: active_tab === g.key }"
                @click="switch_tab(g.key)"
            >{{ g.label }} {{ groups[g.key].length }}</span>
        </div>

        <!-- 收藏列表（档口/菜品行卡，素材图 + 类型签 + ★分）；fav-grid 仅为网格化容器，移动端 display:contents 不影响原布局 -->
        <template v-if="cur_list.length">
            <div class="fav-grid">
                <div
                    v-for="(f, i) in cur_list" :key="`${active_tab}_${f.subject_type}_${f.subject_id}`"
                    class="card favrow fade-up" :style="{ animationDelay: `${i * 0.04}s` }"
                    @click="go_object(f)"
                >
                    <img v-if="f.img" class="fav-img" :src="f.img" alt="" />
                    <div v-else class="fav-img img-fallback">{{ f.name?.slice(0, 1) }}</div>
                    <div class="fav-info">
                        <b class="fav-name">{{ f.name }} <span class="chip">{{ f.type_name }}</span></b>
                        <div class="fav-sub">{{ f.canteen }}<template v-if="f.price"> · {{ f.price }}</template></div>
                        <div class="fav-score-row">
                            <span class="star-score">★ {{ f.score }}</span>
                            <span class="cnt">{{ f.reviews }} 条评价</span>
                        </div>
                    </div>
                    <button class="unfav" @click.stop="unset_fav(f)">取消收藏</button>
                </div>
            </div>
        </template>

        <!-- 空态插画 -->
        <div v-else class="empty fade-up">
            <img src="/assets/spare/R21.png" alt="空空如也" />
            <p>{{ EMPTY_TEXT[active_tab] }}</p>
        </div>

        <div v-if="active_tab === 'want' && cur_list.length" class="foot-hint">「想吃」分组将作为餐品转盘的随机池</div>
    </div>
</template>

<script setup>
/**
 * 我的收藏（/collection）：对齐 P22 原型
 * - 分组 Tab「想吃 / 常吃 / 自定义」可切换 + 数量徽记
 * - 行卡：food 素材图 / 名称 + 类型签 / 档口·人均 / ★分 / 取消收藏
 * - 行点击 → /dish/:id 或 /station/:id（食堂 → /canteen/:id）
 * - 数据：api_favorite.mine()，接口失败或空数据展示空态（不使用页内假数据）
 * - 取消收藏接 api_favorite.remove(targetType, targetId)，成功后才移除本地行
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api_favorite } from '../api';

const router = useRouter();

const group_tabs = [
    { key: 'want', label: '想吃' },
    { key: 'often', label: '常吃' },
    { key: 'custom', label: '自定义' },
];
const active_tab = ref('want');

/** 空态文案（按分组） */
const EMPTY_TEXT = {
    want: '还没有想吃的东西，去首页逛逛吧',
    often: '常吃清单还是空的，多吃几家就有了',
    custom: '这个分组还没有收藏内容',
};

/** 三分组数据（接口成功后按 listType 覆盖） */
const groups = ref({ want: [], often: [], custom: [] });

/** 当前分组列表 */
const cur_list = computed(() => groups.value[active_tab.value]);

/**
 * 切换分组
 * @param {string} k - want / often / custom
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
 * 行点击 → 对象详情（0 菜品 / 1 窗口 / 2 食堂）
 * @param {Object} f
 */
function go_object(f) {
    const t = Number(f.subject_type);
    router.push(t === 0 ? `/dish/${f.subject_id}` : t === 1 ? `/station/${f.subject_id}` : `/canteen/${f.subject_id}`);
}

/**
 * 取消收藏：调 api_favorite.remove(targetType, targetId)，成功后才移除本地行（失败由拦截器提示）
 * @param {Object} f
 */
async function unset_fav(f) {
    try {
        await api_favorite.remove(Number(f.subject_type), f.subject_id);
    } catch {
        return;
    }
    const list = groups.value[active_tab.value];
    groups.value[active_tab.value] = list.filter(
        (x) => !(x.subject_type === f.subject_type && x.subject_id === f.subject_id)
    );
    ElMessage.success('已取消收藏');
}

/**
 * 装载收藏：接 api_favorite.mine()，按 listType 分组（0 想吃 / 1 常吃 / 其他归自定义）；
 * 接口失败或空数据均为空态，不使用页内假数据
 */
async function load_favorites() {
    try {
        const raw = await api_favorite.mine();
        const list = Array.isArray(raw) ? raw : [];
        const next = { want: [], often: [], custom: [] };
        for (const it of list) {
            // 兼容蛇形 / 驼峰两种字段名
            const st = it.subject_type ?? it.subjectType;
            const sid = it.subject_id ?? it.subjectId;
            const lt = Number(it.list_type ?? it.listType ?? 0);
            const key = lt === 0 ? 'want' : lt === 1 ? 'often' : 'custom';
            next[key].push({
                subject_type: st,
                subject_id: sid,
                name: it.subject_name ?? it.subjectName ?? '未知对象',
                type_name: Number(st) === 0 ? '菜品' : Number(st) === 1 ? '档口' : '食堂',
                canteen: it.canteen_name ?? it.canteenName ?? '',
                price: it.price ?? '',
                score: it.rating_avg != null ? Number(it.rating_avg).toFixed(1) : '—',
                reviews: it.review_count ?? it.reviewCount ?? 0,
                img: '',
            });
        }
        groups.value = next;
    } catch {
        groups.value = { want: [], often: [], custom: [] };
    }
}

onMounted(load_favorites);
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

/* 分组 Tab：琥珀下划指示（P22） */
.grouptabs {
    display: flex;
    gap: 16px;
    padding: 8px 2px 0;
    align-items: baseline;
}
.grouptabs span {
    font-size: 13px;
    color: var(--ink-2);
    font-weight: 600;
    position: relative;
    padding-bottom: 6px;
    cursor: pointer;
}
.grouptabs span.on { color: var(--ink); font-weight: 800; }
.grouptabs span.on::after {
    content: '';
    position: absolute;
    left: 20%; right: 20%; bottom: 0;
    height: 2.5px;
    border-radius: 2px;
    background: var(--brand);
}

/* 收藏行卡（P22）：无框卡 + 弥散阴影 */
.favrow {
    margin-top: 10px;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 11px 12px;
    cursor: pointer;
}
.fav-img {
    width: 58px;
    height: 58px;
    border-radius: 11px;
    object-fit: cover;
    flex-shrink: 0;
    font-size: 18px;
}
.fav-info { flex: 1; min-width: 0; }
.fav-name {
    font-size: 13.5px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    overflow: hidden;
}
.fav-name .chip { padding: 1px 7px; flex-shrink: 0; }
.fav-sub { font-size: 10.5px; color: var(--ink-2); margin-top: 3px; font-weight: 400; }
.fav-score-row { margin-top: 5px; display: flex; align-items: baseline; gap: 6px; }
.star-score { color: var(--star); font-weight: 700; font-size: 11.5px; }
.cnt { font-size: 10px; color: var(--ink-2); }

/* 取消收藏：淡描边轻按钮（微圆角，禁胶囊） */
.unfav {
    font-size: 10px;
    color: var(--ink-2);
    border: 1px solid #E0D4B8;
    border-radius: var(--radius-sm);
    padding: 3px 10px;
    background: var(--paper);
    cursor: pointer;
    flex-shrink: 0;
    font-weight: 600;
    transition: color .12s ease, border-color .12s ease;
}
.unfav:hover { color: var(--bad); border-color: #f2c9c9; }

/* 空态插画 */
.empty { text-align: center; padding: 40px 0 12px; }
.empty img { width: 180px; margin: 0 auto; opacity: .9; }
.empty p { font-size: 12px; color: var(--ink-2); margin-top: 10px; }

.foot-hint { text-align: center; font-size: 10px; color: var(--ink-2); margin-top: 14px; }

/* ===== 桌面适配（≥769）：收藏列表双列网格，标题/Tab/空态/页脚跨全宽 ===== */
/* 网格化容器：移动端 display:contents 不产生任何盒影响，桌面才变 grid */
.fav-grid { display: contents; }
@media (min-width: 769px) {
    /* 收藏卡桌面 2 列网格，纵向间距由网格接管 */
    .fav-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 16px; }
    .favrow { margin-top: 0; }
}

/* ===== 桌面适配（≥1200）：行卡与图片再加一档 ===== */
@media (min-width: 1200px) {
    /* 超宽屏：收藏卡 3 列铺满，封面图加大 */
    .fav-grid { grid-template-columns: repeat(3, 1fr); }
    .fav-img { width: 64px; height: 64px; }
}
</style>
