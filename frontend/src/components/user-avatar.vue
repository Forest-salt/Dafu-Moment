<template>
    <span class="uav" :style="box_style">
        <img v-if="custom_url" :src="custom_url" class="uav-img" alt="" />
        <el-icon v-else :size="icon_size"><component :is="variant.icon" /></el-icon>
    </span>
</template>

<script setup>
/**
 * 通用默认头像（暖纸奶油风）：食物图标 + 主题色底 + 1px 淡描边（无墨线/无错位阴影）
 * - 自定义头像 → user.avatar_object_key 有值时优先显示上传图
 * - 未登录 → UserFilled 牛皮纸灰
 * - 匿名 → Hide 面罩图标（隐藏昵称与头像的口径一致）
 * - 登录用户 → user.avatar 1-8 显式选定的预设头像；0/未选时按 id 确定性映射 8 款食物头像（Burger/Chicken/MilkTea/IceCream/Watermelon/Fries/Grape/Apple）
 */
import { computed } from 'vue';
import {
    UserFilled, Hide, Burger, Chicken, MilkTea, IceCreamRound,
    Watermelon, Fries, Grape, Apple,
} from '@element-plus/icons-vue';
import { cover_url } from '../utils/format';

const props = defineProps({
    /** 登录用户对象 { id, nickname }；null 视为游客 */
    user: { type: Object, default: null },
    /** 匿名态（点评匿名同学） */
    anon: { type: Boolean, default: false },
    /** 直径 px */
    size: { type: Number, default: 32 },
});

/* 8 款基础食物头像：图标 + 底色 + 图标色（品牌暖色族） */
const VARIANTS = [
    { icon: Burger, bg: '#ffc93c', fg: '#3d2f1e' },
    { icon: Chicken, bg: 'var(--brand)', fg: '#fffdf4' },
    { icon: MilkTea, bg: '#b08954', fg: '#fffdf4' },
    { icon: IceCreamRound, bg: '#7cc7e8', fg: '#3d2f1e' },
    { icon: Watermelon, bg: '#e5484d', fg: '#fffdf4' },
    { icon: Fries, bg: '#f59e4c', fg: '#3d2f1e' },
    { icon: Grape, bg: '#9a7ed9', fg: '#fffdf4' },
    { icon: Apple, bg: '#58b368', fg: '#fffdf4' },
];

/** 头像变体：匿名 → Hide；游客 → UserFilled；用户 → 显式 avatar(1-8) 优先，0/缺省则按 id 确定性取款 */
const variant = computed(() => {
    if (props.anon) return { icon: Hide, bg: '#efe2c4', fg: '#9a8b72' };
    if (!props.user) return { icon: UserFilled, bg: '#f1e4c8', fg: '#9a8b72' };
    const av = Number(props.user.avatar);
    if (av >= 1 && av <= VARIANTS.length) return VARIANTS[av - 1];
    return VARIANTS[(props.user.id || 0) % VARIANTS.length];
});

/** 自定义头像 URL（avatar_object_key 优先，兼容蛇形/驼峰两种字段名） */
const custom_url = computed(() => cover_url(props.user?.avatar_object_key || props.user?.avatarObjectKey || ''));

const icon_size = computed(() => Math.max(12, Math.round(props.size * 0.52)));

const box_style = computed(() => ({
    width: `${props.size}px`,
    height: `${props.size}px`,
    background: custom_url.value ? 'var(--paper)' : variant.value.bg,
    color: variant.value.fg,
    border: '1px solid var(--line)',
    boxShadow: 'none',
    flexShrink: 0,
}));
</script>

<style scoped>
.uav {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1px solid var(--line);
    overflow: hidden;
}
.uav-img { width: 100%; height: 100%; object-fit: cover; display: block; }
</style>
