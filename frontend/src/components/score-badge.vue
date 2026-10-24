<template>
    <div class="score-badge">
        <span class="wr score-num" :style="{ color: score_color(score) }">{{ fmt_score(score) }}</span>
        <div class="side">
            <star-rating :model-value="Math.round(score)" readonly size="sm" />
            <span class="count">{{ count }} 人评</span>
        </div>
    </div>
</template>

<script setup>
/**
 * ScoreBadge：聚合均分大数字 + 星级 + 评价数（v2.0：聚合分只有 rating_avg）
 */
import StarRating from './star-rating.vue';
import { score_color, fmt_score } from '../utils/format';

defineProps({
    score: { type: Number, default: 0 },
    count: { type: Number, default: 0 },
});
</script>

<style scoped>
.score-badge { display: flex; align-items: center; gap: 8px; }
.wr { font-size: 26px; line-height: 1; }
.side { display: flex; flex-direction: column; gap: 1px; }
.count { font-size: 11px; color: var(--ink-2); }
</style>
