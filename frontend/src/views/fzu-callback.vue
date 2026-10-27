<template>
    <div class="page">
        <div class="cb-card card fade-up">
            <!-- 处理中：自绘 loading 圈；失败：自绘盾牌线性图标（G4 禁止汉字图标） -->
            <span v-if="state === 'working'" class="cb-ring" aria-hidden="true"></span>
            <span v-else class="cb-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 3l7 3v5c0 4.4-2.9 7.7-7 10-4.1-2.3-7-5.6-7-10V6l7-3z" />
                    <path d="M9.5 12.5l1.8 1.8 3.4-3.8" />
                </svg>
            </span>
            <template v-if="state === 'working'">
                <h2>统一身份认证回调中…</h2>
                <p class="cb-tip">正在校验福州大学统一身份认证（CAS）票据，请稍候。</p>
            </template>
            <template v-else>
                <h2>认证校验失败</h2>
                <p class="cb-tip">{{ error }}</p>
                <el-button type="primary" @click="$router.replace('/login')">返回重新登录</el-button>
            </template>
        </div>
    </div>
</template>

<script setup>
/**
 * CAS 回调页（r51，真实模式专用）：校方登录成功后 302 回本页（URL 带 ticket）。
 * 意图分流：intent=bind 且本地已登录 → 绑定认证身份后回个人中心；
 * 其余 → ticket 换取会话（SSO 登录/自动建号）后跳首页。票据一次性，校验失败给重试出口。
 */
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const state = ref('working');
const error = ref('');

onMounted(async () => {
    const ticket = String(route.query.ticket || '');
    if (!ticket) {
        state.value = 'error';
        error.value = '回调地址缺少认证票据（ticket），请从登录页重新发起授权。';
        return;
    }
    const intent = sessionStorage.getItem('fk_fzu_intent') || 'login';
    sessionStorage.removeItem('fk_fzu_intent');
    try {
        if (intent === 'bind' && auth.token) {
            // 已登录用户在个人中心发起的绑定流程
            await auth.fzu_bind_ticket(ticket);
            ElMessage.success('福大认证绑定成功！');
            router.replace('/me');
        } else {
            await auth.sso_ticket(ticket);
            ElMessage.success('统一身份认证成功，欢迎回来！');
            router.replace('/');
        }
    } catch (e) {
        state.value = 'error';
        error.value = e?.message || '统一身份认证校验失败，票据可能已过期，请重新授权。';
    }
});
</script>

<style scoped>
.page {
    display: flex;
    justify-content: center;
    padding: 60px 16px;
}
.cb-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 40px 48px;
    text-align: center;
}

/* 自绘 loading 圈：淡金轨道 + 琥珀转弧 */
.cb-ring {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 3px solid var(--brand-light);
    border-top-color: var(--brand);
    animation: cb_spin .8s linear infinite;
}
@keyframes cb_spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
    .cb-ring { animation: none; }
}

/* 失败态图标：圆形淡金底 + 线性盾牌 */
.cb-ico {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    color: var(--ink-3);
    background: var(--brand-light);
    border-radius: 50%;
}
.cb-ico svg { width: 24px; height: 24px; }

.cb-card h2 {
    margin: 4px 0 0;
    font-size: 18px;
    font-weight: 700;
}
.cb-tip {
    margin: 0 0 8px;
    color: var(--ink-2);
    font-size: 13px;
    max-width: 320px;
    line-height: 1.7;
}

/* ===== 桌面适配（≥769）：过渡页保持居中美观，改动从简 ===== */
@media (min-width: 769px) {
    /* 过场卡桌面垂直下沉：顶部留 12vh，弱化过场页突兀感 */
    .page { padding-top: 12vh; }
    /* 过场卡限宽 420 居中，避免宽屏下内容过散 */
    .cb-card { width: min(420px, 100%); }
}
</style>
