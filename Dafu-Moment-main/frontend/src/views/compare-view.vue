<template>
    <div class="page-wrap compare-page">
        <!-- 1. 顶部标题栏：返回 + 标题 -->
        <div class="titlebar">
            <span class="icircle back" @click="go_back">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3A2E1A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
            </span>
            <b class="title">横向对比</b>
        </div>

        <!-- 2. 对象选择器：从真实点位池点选，2~4 个 -->
        <div class="card picker fade-up">
            <b class="picker-title">选择对比对象（2~4 个）</b>
            <div v-if="pool.length" class="picker-chips">
                <span
                    v-for="p in pool" :key="p.id"
                    class="pchip" :class="{ on: selected.includes(p.id) }"
                    @click="toggle_obj(p.id)"
                >{{ p.name }}</span>
            </div>
            <div v-else class="picker-empty">暂无点位数据，请稍后重试</div>
        </div>

        <!-- 3. 对比表：表头对象 + 字段行（细横线分隔，缺数据显示 —） -->
        <div v-if="selected_objs.length >= 2" class="card cmp fade-up" :style="{ '--cols': selected_objs.length }">
            <!-- 表头：图片 + 名称 + 综合分，点击进详情 -->
            <div class="crow head">
                <span class="k"></span>
                <span v-for="o in selected_objs" :key="o.id" class="cobj" @click="go_detail(o)">
                    <img v-if="o.img" :src="o.img" :alt="o.name">
                    <span v-else class="cobj-ph">{{ o.name[0] }}</span>
                    <b>{{ o.name }}</b>
                    <span class="st">★ {{ o.score_text }}</span>
                </span>
            </div>
            <!-- 类型 -->
            <div class="crow">
                <span class="k">类型</span>
                <span v-for="o in selected_objs" :key="o.id" class="v">{{ o.type_text }}</span>
            </div>
            <!-- 位置 -->
            <div class="crow">
                <span class="k">位置</span>
                <span v-for="o in selected_objs" :key="o.id" class="v">{{ o.location_text }}</span>
            </div>
            <!-- 人均价（越低越好） -->
            <div class="crow">
                <span class="k">人均价</span>
                <span v-for="o in selected_objs" :key="o.id" class="v" :class="{ best: is_best('price', o) }">{{ o.price_text }}</span>
            </div>
            <!-- 综合分（越高越好） -->
            <div class="crow">
                <span class="k">综合分</span>
                <span v-for="o in selected_objs" :key="o.id" class="v" :class="{ best: is_best('score', o) }">{{ o.score_text }}</span>
            </div>
            <!-- 档口数（越多越好） -->
            <div class="crow">
                <span class="k">档口数</span>
                <span v-for="o in selected_objs" :key="o.id" class="v" :class="{ best: is_best('station_count', o) }">{{ o.station_count }}</span>
            </div>
            <!-- 标签 -->
            <div class="crow">
                <span class="k">标签</span>
                <span v-for="o in selected_objs" :key="o.id" class="v v-tags">{{ o.tags.length ? o.tags.join(' · ') : '—' }}</span>
            </div>
            <!-- 操作：详情 -->
            <div class="crow">
                <span class="k">操作</span>
                <span v-for="o in selected_objs" :key="o.id" class="v"><span class="go-link" @click="go_detail(o)">详情 ›</span></span>
            </div>
        </div>
        <div v-else class="empty-tip fade-up">请从上方选择 2~4 个对象开始对比</div>

        <!-- 4. 底部操作与说明 -->
        <div class="foot-actions fade-up">
            <span class="card act-btn" @click="clear_all">清空</span>
        </div>
        <div class="addtip">
            仅展示真实点位数据 · 最多对比 4 个<br>
            人均价越低越好 · 综合分与档口数越高越好 · 数据来源于全站已发布评价
        </div>
    </div>
</template>

<script setup>
/**
 * 横向对比（P07 暖纸奶油风）：2~4 个真实点位横向对比表
 * 数据源：api_content.canteens()（在校点位聚合：人均价 / 综合分 / 档口数 / 标签）；
 * 接口失败或数据不足时展示友好空态，不回退演示数据；详情跳转使用真实点位 id。
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api_content } from '../api';
import { fmt_score, cover_url, CANTEEN_TYPE_NAME } from '../utils/format';

const router = useRouter();

// 对比池（来自真实点位接口）
const pool = ref([]);
// 已选对比对象 id
const selected = ref([]);

/**
 * 点位原始行 → 对比模型（人均价 / 综合分为空时置 null，便于「最优」判断）
 * @param {Object} c - 点位列表行
 */
function map_point(c) {
    const price = c.avg_price != null && Number(c.avg_price) > 0 ? Number(c.avg_price) : null;
    const score = c.avg_score != null && Number(c.avg_score) > 0 ? Number(c.avg_score) : null;
    return {
        id: c.id,
        name: c.name,
        img: c.cover_object_key ? cover_url(c.cover_object_key) : '',
        type_text: CANTEEN_TYPE_NAME[Number(c.type)] ?? '点位',
        location_text: [c.campus, c.location].filter(Boolean).join(' · ') || '—',
        price,
        price_text: price != null ? `¥${price}/人` : '—',
        score,
        score_text: score != null ? fmt_score(score) : '—',
        station_count: Number(c.station_count) || 0,
        tags: Array.isArray(c.tags) ? c.tags : [],
    };
}

/**
 * 拉取真实点位作为对比池；接口失败时置空（展示空态，不复用假数据）
 */
async function load_pool() {
    try {
        const res = await api_content.canteens();
        const list = Array.isArray(res) ? res : (res && res.list) || [];
        pool.value = list.map(map_point);
        // 默认选中前 3 个，便于直接看到对比表
        selected.value = pool.value.slice(0, 3).map((p) => p.id);
    } catch {
        pool.value = [];
        selected.value = [];
    }
}

/** 已选对象模型列表（保持点选顺序） */
const selected_objs = computed(() => (
    selected.value.map((id) => pool.value.find((p) => p.id === id)).filter(Boolean)
));

/**
 * 点选 / 取消对比对象（上限 4 个）
 * @param {number} id - 点位 id
 */
function toggle_obj(id) {
    const i = selected.value.indexOf(id);
    if (i >= 0) {
        selected.value.splice(i, 1);
        return;
    }
    if (selected.value.length >= 4) return;
    selected.value.push(id);
}

/** 清空对比对象 */
function clear_all() {
    selected.value = [];
}

/**
 * 数值字段是否为本行最优（人均价取最小，其余取最大；空值不参与也不高亮）
 * @param {'price'|'score'|'station_count'} field
 * @param {Object} o
 */
function is_best(field, o) {
    if (selected_objs.value.length < 2 || o[field] == null) return false;
    const vals = selected_objs.value.map((x) => x[field]).filter((v) => v != null);
    if (vals.length < 2) return false;
    const best = field === 'price' ? Math.min(...vals) : Math.max(...vals);
    // best 为 0（如全员无档口 / 无评分）时不高亮
    return best > 0 && o[field] === best;
}

/**
 * 详情跳转：点位 → /canteen/:id（真实 id）
 * @param {{id:number}} o
 */
function go_detail(o) {
    router.push(`/canteen/${o.id}`);
}

/** 返回上一页 */
function go_back() {
    router.back();
}

onMounted(load_pool);
</script>

<style scoped>
/* ===== 顶部标题栏 ===== */
.titlebar {
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    margin-top: 8px;
}
.back { position: absolute; left: 0; }
.title { font-size: 16px; }

/* ===== 对象选择器 ===== */
.picker { margin-top: 14px; }
.picker-title { font-size: 12px; display: block; }
.picker-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.picker-empty { font-size: 12px; color: var(--ink-2); margin-top: 10px; }
.pchip {
    font-size: 11px;
    background: #FBF4E4;
    border: 1px solid #E8D5C0;
    color: var(--ink-3);
    padding: 5px 13px;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: background .12s ease, color .12s ease;
}
.pchip.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }

/* ===== 对比表：横向滚动，列数随对象数自适应 ===== */
.cmp { margin-top: 14px; padding: 6px 0 10px; overflow-x: auto; }
.crow {
    display: grid;
    grid-template-columns: 64px repeat(var(--cols), minmax(88px, 1fr));
    gap: 8px;
    padding: 9px 12px;
    align-items: center;
}
/* 细横线分隔行（替代封闭描边） */
.crow + .crow { border-top: 1px solid var(--line); }
.crow .k { font-size: 10px; color: var(--ink-2); font-weight: 600; }
.crow .v { font-size: 10.5px; text-align: center; color: var(--ink); word-break: break-all; }
.crow .v.best { color: var(--brand); font-weight: 800; }
.v-tags { font-size: 9px; color: var(--ink-3); }

/* 表头对象：图 + 名称 + 星分 */
.cobj { text-align: center; cursor: pointer; }
.cobj img {
    width: 52px;
    height: 52px;
    border-radius: var(--radius-sm);
    object-fit: cover;
    margin: 0 auto;
    display: block;
}
/* 无封面时的首字占位 */
.cobj-ph {
    display: flex; align-items: center; justify-content: center;
    width: 52px; height: 52px; margin: 0 auto;
    border-radius: var(--radius-sm); background: var(--brand-light);
    color: var(--ink-3); font-size: 20px; font-weight: 800;
}
.cobj b { font-size: 10.5px; display: block; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cobj .st { font-size: 9px; color: var(--star); font-weight: 800; }

/* 详情链接 */
.go-link { color: var(--brand); font-weight: 700; cursor: pointer; font-size: 10.5px; }
.go-link:hover { color: var(--brand-dark); }

/* ===== 底部操作与说明 ===== */
.empty-tip { text-align: center; color: var(--ink-2); font-size: 13px; padding: 40px 0; }
.foot-actions { display: flex; gap: 8px; justify-content: center; margin-top: 14px; }
.act-btn {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--ink-2);
    padding: 8px 20px;
    cursor: pointer;
}
.addtip { text-align: center; font-size: 10px; color: var(--ink-2); margin-top: 14px; line-height: 1.8; }

/* ===== 桌面适配（≥769）===== */
@media (min-width: 769px) {
    /* 整页限宽 1000 居中 */
    .compare-page { max-width: 1000px; }
    /* 对比表：行距与列间距加大，最小列宽放宽（4 对象时每列约 200px） */
    .crow {
        grid-template-columns: 88px repeat(var(--cols), minmax(150px, 1fr));
        gap: 12px; padding: 12px 16px;
    }
    /* 对比表字号整体上调一档 */
    .crow .k { font-size: 11px; }
    .crow .v { font-size: 12px; }
    .v-tags { font-size: 10.5px; }
    .cobj img { width: 64px; height: 64px; }
    .cobj-ph { width: 64px; height: 64px; }
    .cobj b { font-size: 12px; }
    .cobj .st { font-size: 10.5px; }
    /* 选择器 chips 与清空按钮同步放大 */
    .pchip { font-size: 12px; padding: 7px 16px; }
    .act-btn { font-size: 12.5px; padding: 10px 28px; }
}
</style>
