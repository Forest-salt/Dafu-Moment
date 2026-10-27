<template>
    <div class="page-wrap user-page">
        <!-- 头部：大头像 + 昵称/认证签 + 关注/私信钮 -->
        <div v-if="user" class="profile-head card fade-up">
            <div class="head-top">
                <user-avatar :user="user" :size="60" class="avatar-fix" />
                <div class="info">
                    <div class="nick-row">
                        <span class="nick">{{ user.nickname }}</span>
                        <span v-if="user.fzu_verified" class="cert-tag">校内已认证</span>
                    </div>
                    <div class="sub">加入于 {{ joined_date }}</div>
                </div>
            </div>

            <!-- 统计行：纯文字 + 数字（修改说明 C18）；关注/粉丝后端暂无数据，不展示 -->
            <div class="statrow">
                <div class="stat"><b class="score-num">{{ liked_total }}</b><span>获赞</span></div>
            </div>

            <div class="head-ops">
                <button class="op-btn follow" :class="{ on: followed }" @click="toggle_follow">
                    {{ followed ? '已关注' : '关注' }}
                </button>
                <button class="op-btn msg" @click="do_message">私信</button>
            </div>
        </div>

        <!-- 用户不存在/加载失败兜底（拦截器已提示具体原因） -->
        <div v-if="failed" class="empty-tip card">这位同学的主页走丢了…</div>

        <!-- 公开点评流（新版式：行卡片 → /post/:id） -->
        <template v-else>
            <div class="sec"><b>TA 的点评</b></div>
            <el-skeleton :loading="loading" animated :count="3">
                <template #template>
                    <div class="skel"><el-skeleton-item variant="rect" style="height: 120px; border-radius: 12px" /></div>
                </template>
                <template #default>
                    <!-- 桌面网格 wrapper：移动端 display:contents 不产生任何盒影响，桌面点评卡变 2 列 -->
                    <div class="rev-grid">
                        <div
                            v-for="r in reviews" :key="r.id" class="review-row card fade-up"
                            @click="go_detail(r)"
                        >
                            <div class="r-head">
                                <b class="r-subject">{{ r.subjectName }}</b>
                                <span class="tag">{{ SUBJECT_TYPE_NAME[r.subjectType] }}</span>
                                <span class="time">{{ time_ago(r.createdAt) }}</span>
                            </div>
                            <p class="r-content">{{ r.content || '（纯图点评）' }}</p>
                            <div v-if="(r.images || []).length" class="r-imgs">
                                <img v-for="k in (r.images || []).slice(0, 3)" :key="k" :src="`/img/${k}`" loading="lazy" alt="" />
                            </div>
                            <div class="r-foot">
                                <span class="r-score score-num">★ {{ r.overallScore }}</span>
                                <span class="r-likes">
                                    <img class="like-img" src="/assets/icons/icon-like.png" alt="赞" />{{ r.likeCount || 0 }}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div v-if="!loading && reviews.length === 0" class="empty-tip card">还没有公开点评</div>
                    <div class="pager" v-if="review_total > page_size">
                        <el-pagination
                            layout="prev, pager, next" :total="review_total" :page-size="page_size"
                            v-model:current-page="page" @current-change="load_reviews"
                        />
                    </div>
                </template>
            </el-skeleton>
        </template>
    </div>
</template>

<script setup>
/**
 * 他人公开主页（/user/:id）：暖纸奶油风改版
 * - 头部：大头像 + 昵称/校内已认证签 + 关注/私信钮（私信暂未开放）
 * - 统计行：获赞由公开点评点赞数汇总；后端暂无关注/粉丝数据，故不展示关注/粉丝数
 * - TA 的点评：复用 api_user.profile 数据字段按新版式渲染，行 → /post/:id
 */
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api_user } from '../api';
import UserAvatar from '../components/user-avatar.vue';
import { time_ago, SUBJECT_TYPE_NAME } from '../utils/format';

const route = useRoute();
const router = useRouter();
const user = ref(null);
const reviews = ref([]);
const review_total = ref(0);
const page_size = ref(10);
const page = ref(1);
const loading = ref(false);
const failed = ref(false);

// 关注态为页内视觉态（后端暂无关注关系接口，不展示关注/粉丝数字）
const followed = ref(false);

// 获赞：当前页点评点赞数汇总（弱信号，仅作展示）
const liked_total = computed(() => reviews.value.reduce((s, r) => s + (Number(r.likeCount) || 0), 0));

// 注册时间格式化 YYYY-MM-DD（createdAt 缺省防御）
const joined_date = computed(() => String(user.value?.createdAt || user.value?.created_at || '').slice(0, 10) || '—');

/**
 * 拉取公开主页数据（用户卡只在首次成功后填充；评价流随分页刷新）
 */
async function load_profile() {
    loading.value = true;
    failed.value = false;
    try {
        const d = await api_user.profile(Number(route.params.id), { page: page.value });
        user.value = d.user;
        const rv = d.reviews || {};
        reviews.value = rv.list || [];
        review_total.value = Number(rv.total) || 0;
        if (rv.size) page_size.value = Number(rv.size) || 10;
    } catch {
        failed.value = true;
        user.value = null;
        reviews.value = [];
    } finally {
        loading.value = false;
    }
}

/**
 * 评价流独立刷新（点赞等操作后只重拉当前页）
 */
async function load_reviews() {
    try {
        const d = await api_user.profile(Number(route.params.id), { page: page.value });
        const rv = d.reviews || {};
        reviews.value = rv.list || [];
        review_total.value = Number(rv.total) || 0;
    } catch { /* 拦截器已提示 */ }
}

/**
 * 跳点评详情
 * @param {Object} r
 */
function go_detail(r) {
    router.push(`/post/${r.id}`);
}

/**
 * 关注/取关切换（页内 mock）
 * TODO: 待后端关注关系接口
 */
function toggle_follow() {
    followed.value = !followed.value;
}

/**
 * 私信：暂未开放
 */
function do_message() {
    ElMessage.info('私信功能暂未开放');
}

// 主页间跳转（/user/1 → /user/2）组件复用，监听参数变化重载
watch(() => route.params.id, (v, old) => {
    if (v && v !== old && route.name === 'user-profile') {
        page.value = 1;
        user.value = null;
        load_profile();
    }
});

onMounted(load_profile);
</script>

<style scoped>
/* 头部卡：头像行 + 统计行 + 操作钮 */
.profile-head { padding: 18px; }
.head-top { display: flex; align-items: center; gap: 14px; }
.info { flex: 1; min-width: 0; }
.nick-row { display: flex; align-items: center; gap: 8px; }
.nick { font-size: 18px; font-weight: 800; }
.cert-tag {
    font-size: 9.5px;
    font-weight: 700;
    color: #FFFDF5;
    background: var(--brand);
    padding: 2px 7px;
    border-radius: 6px;
    flex-shrink: 0;
}
.sub { font-size: 11px; color: var(--ink-2); margin-top: 5px; font-weight: 400; }

/* 统计行：纯文字 + 数字，留白分隔（C18 去胶囊） */
.statrow {
    display: flex;
    justify-content: space-around;
    padding: 16px 8px 2px;
}
.stat { text-align: center; }
.stat b { display: block; font-size: 16px; font-weight: 800; color: var(--ink); }
.stat span { display: block; font-size: 10.5px; color: var(--ink-2); margin-top: 2px; font-weight: 400; }

.head-ops { display: flex; gap: 10px; margin-top: 14px; }
.op-btn {
    flex: 1;
    height: 36px;
    font-size: 12.5px;
    font-weight: 700;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background .12s ease, color .12s ease;
}
.op-btn.follow { border: 1px solid var(--brand); background: var(--brand); color: #FFFDF5; }
.op-btn.follow.on { background: var(--paper); border-color: var(--line); color: var(--ink-2); }
.op-btn.msg { border: 1px solid var(--line); background: var(--paper); color: var(--ink); }
.op-btn.msg:hover { background: #FBF3DC; }

/* 点评流：行卡片 */
.skel { margin-bottom: 12px; }
.review-row { margin-bottom: 12px; cursor: pointer; }
.r-head { display: flex; align-items: center; gap: 8px; }
.r-subject { font-size: 14px; font-weight: 700; }
.time { margin-left: auto; font-size: 10.5px; color: var(--ink-2); font-weight: 400; }
.r-content { margin: 8px 0 0; font-size: 13px; line-height: 1.7; font-weight: 400; white-space: pre-wrap; }
.r-imgs { display: flex; gap: 7px; margin-top: 9px; }
.r-imgs img { width: 76px; height: 76px; object-fit: cover; border-radius: var(--radius-sm); }
.r-foot {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 10px;
    padding-top: 9px;
    border-top: 1px solid var(--line);
    font-size: 12px;
}
.r-score { color: var(--star); font-weight: 700; }
.r-likes { display: inline-flex; align-items: center; gap: 4px; color: var(--ink-2); }
.like-img { width: 14px; height: 14px; object-fit: contain; opacity: .7; }

.empty-tip { text-align: center; color: var(--ink-2); padding: 44px 0; }
.pager { display: flex; justify-content: center; margin-top: 14px; }

/* 点评网格 wrapper：移动端 display:contents 不产生任何盒影响 */
.rev-grid { display: contents; }

/* ===== 桌面适配（≥769）===== */
@media (min-width: 769px) {
    /* 页面列宽：主页统一 920px 宽幅档（覆盖全局 1080） */
    .page-wrap { max-width: 920px; }
    /* 用户头卡：头像昵称 | 统计 | 操作钮 横向一行铺开 */
    .profile-head { display: grid; grid-template-columns: 1fr auto auto; align-items: center; column-gap: 28px; }
    /* 统计行：横向布局下改为紧凑间距 */
    .statrow { padding: 0; justify-content: flex-start; gap: 26px; }
    /* 操作钮：取消撑满整行，紧贴统计右侧 */
    .head-ops { margin-top: 0; }
    /* TA 的点评：单列卡片流改 2 列网格，顶部对齐防止单卡拉伸 */
    .rev-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 20px; align-items: start; }
    /* 网格行距由 gap 接管，取消卡片自带下边距 */
    .rev-grid .review-row { margin-bottom: 0; }
}
</style>
