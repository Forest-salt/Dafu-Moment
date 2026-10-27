<template>
    <div class="hist">
        <div v-for="star in [5, 4, 3, 2, 1]" :key="star" class="hist-row">
            <span class="hist-label">{{ star }} 星</span>
            <div class="hist-track">
                <div
                    class="hist-bar"
                    :style="{ width: pct(hist[star]) + '%' }"
                    :title="`${hist[star] || 0} 条`"
                ></div>
            </div>
            <span class="hist-count">{{ hist[star] || 0 }}</span>
        </div>
    </div>
</template>

<script setup>
/**
 * RatingHistogram：1-5 星占比横条直方图（纯 CSS，04 §四）
 */
const props = defineProps({
    hist: { type: Object, default: () => ({}) },
});

/**
 * 占比计算
 * @param {number} v
 * @returns {number}
 */
function pct(v) {
    const total = Object.values(props.hist).reduce((a, b) => a + Number(b || 0), 0);
    if (!total) return 0;
    return Math.round((Number(v || 0) / total) * 100);
}
</script>

<style scoped>
.hist { display: flex; flex-direction: column; gap: 5px; }
.hist-row { display: flex; align-items: center; gap: 8px; }
.hist-label { width: 30px; font-size: 12px; color: var(--ink-2); text-align: right; }
.hist-track { flex: 1; height: 10px; background: #f0f0f0; border-radius: 5px; overflow: hidden; }
.hist-bar { height: 100%; background: var(--star); border-radius: 5px; transition: width 0.4s; }
.hist-count { width: 28px; font-size: 11px; color: var(--ink-2); }
</style>
