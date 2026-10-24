<template>
    <span class="star-rating" :class="{ readonly }">
        <span
            v-for="i in 5"
            :key="i"
            class="star"
            :class="{ on: i <= modelValue }"
            @click="on_click(i)"
            role="img"
            :aria-label="`${i} 星`"
        >★</span>
        <span v-if="showValue" class="star-val score-num">{{ modelValue }}</span>
    </span>
</template>

<script setup>
/**
 * StarRating：只读/输入两态星级（1-5 整星，04 §四）
 */
const props = defineProps({
    modelValue: { type: Number, default: 0 },
    readonly: { type: Boolean, default: false },
    showValue: { type: Boolean, default: false },
    size: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

/**
 * 点击设星（只读态忽略）
 * @param {number} n
 */
function on_click(n) {
    if (!props.readonly) emit('update:modelValue', n);
}
</script>

<style scoped>
.star { cursor: pointer; font-size: 18px; color: #e5e5e5; transition: transform 0.15s; }
.star.on { color: var(--star); }
.readonly .star { cursor: default; }
.star:hover { transform: scale(1.15); }
.star-val { margin-left: 4px; color: var(--star); font-size: 13px; }
</style>
