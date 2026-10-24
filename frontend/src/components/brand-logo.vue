<template>
    <!-- 品牌图标：大福包子形象（抱「福」字），素材为透明底 PNG -->
    <span
        class="brand-logo"
        :style="{ width: size + 'px', height: size + 'px' }"
        aria-hidden="true"
    >
        <img src="/assets/icons/logo-bun.png" alt="大福食刻" />
    </span>
</template>

<script setup>
/**
 * 全站唯一品牌 Logo 组件（大福包子吉祥物）
 * 素材 /assets/icons/logo-bun.png 已是透明背景（由黑底 JPG 去底生成），
 * 直接等比缩放展示即可，无需裁切与底色兜底；
 * favicon 同步指向该 PNG（index.html）
 */
defineProps({
    /** 渲染尺寸（px，正方形） */
    size: { type: Number, default: 24 },
});
</script>

<style scoped>
.brand-logo {
    display: block;
    flex-shrink: 0;
}
.brand-logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
}
</style>
