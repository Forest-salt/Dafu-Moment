<template>
    <div class="radar-wrap">
        <svg :viewBox="`0 0 ${SIZE} ${SIZE}`" class="radar-svg">
            <!-- 背景网格：5 层多边形 -->
            <polygon
                v-for="l in LEVELS" :key="l"
                :points="poly_points(l / LEVELS)" class="grid"
            />
            <!-- 轴线 -->
            <line v-for="(d, i) in dims" :key="`a${i}`" :x1="SIZE / 2" :y1="SIZE / 2" :x2="axis_pt(i)[0]" :y2="axis_pt(i)[1]" class="axis" />
            <!-- 数据面 -->
            <polygon v-if="data_points.length >= 3" :points="data_points.map((p) => p.join(',')).join(' ')" class="data" />
            <!-- 维度名 + 数值 -->
            <text v-for="(d, i) in dims" :key="`t${i}`" :x="label_pt(i)[0]" :y="label_pt(i)[1]" :text-anchor="label_anchor(i)" class="dim-label">
                {{ d.name }} {{ values[d.key] != null ? values[d.key].toFixed(1) : '' }}
            </text>
        </svg>
        <div v-if="dims.length === 0" class="radar-empty">暂无维度数据</div>
    </div>
</template>

<script setup>
/**
 * 维度雷达图（v2.0：维度配置动态化）
 * props.dims 维度配置数组 [{key, name}]；props.values 各维均分对象 {taste: 4.5, ...}
 */
import { computed } from 'vue';

const props = defineProps({
    dims: { type: Array, default: () => [] },
    values: { type: Object, default: () => ({}) },
});

const SIZE = 220;
const R = 70;
const LEVELS = 5;
const MAX = 5;

/**
 * 第 i 维的轴角度
 * @param {number} i
 */
function angle(i) {
    return (Math.PI * 2 * i) / Math.max(props.dims.length, 1) - Math.PI / 2;
}

/**
 * 网格多边形各层顶点
 * @param {number} ratio 0-1
 */
function poly_points(ratio) {
    return props.dims.map((_, i) => {
        const x = SIZE / 2 + Math.cos(angle(i)) * R * ratio;
        const y = SIZE / 2 + Math.sin(angle(i)) * R * ratio;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
}

/**
 * 轴线端点
 * @param {number} i
 */
function axis_pt(i) {
    return [SIZE / 2 + Math.cos(angle(i)) * R, SIZE / 2 + Math.sin(angle(i)) * R];
}

/**
 * 数据面顶点（值缺失按 0 处理）
 * @param {number} i
 */
function data_vertex(i) {
    const v = Math.min(MAX, Math.max(0, Number(props.values[props.dims[i].key]) || 0)) / MAX;
    return [SIZE / 2 + Math.cos(angle(i)) * R * v, SIZE / 2 + Math.sin(angle(i)) * R * v];
}
const data_points = computed(() => props.dims.map((_, i) => data_vertex(i).map((n) => n.toFixed(1))));

/**
 * 维度标签位置（轴向外延 18px）
 * @param {number} i
 */
function label_pt(i) {
    return [SIZE / 2 + Math.cos(angle(i)) * (R + 20), SIZE / 2 + Math.sin(angle(i)) * (R + 20) + 3];
}

/**
 * 维度标签对齐方式
 * @param {number} i
 */
function label_anchor(i) {
    const c = Math.cos(angle(i));
    if (c > 0.3) return 'start';
    if (c < -0.3) return 'end';
    return 'middle';
}
</script>

<style scoped>
.radar-wrap { position: relative; display: flex; justify-content: center; }
.radar-svg { width: 220px; height: 220px; }
.grid { fill: none; stroke: var(--line); stroke-width: 1; }
.axis { stroke: var(--line); stroke-width: 1; }
.data {
    fill: rgba(255, 102, 51, 0.28); stroke: var(--brand); stroke-width: 2;
    stroke-linejoin: round;
}
.dim-label { font-size: 10px; fill: var(--ink-2); }
.radar-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--ink-2); font-size: 13px; }
</style>
