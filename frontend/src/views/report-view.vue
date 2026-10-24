<template>
    <div class="page-wrap rp">
        <!-- 顶部返回头 -->
        <div class="topbar">
            <span class="icircle back" aria-label="返回" @click="go_back">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
            </span>
            <b class="t-title">举报</b>
            <i class="t-hold"></i>
        </div>

        <!-- 1. 被举报对象：路由 query 带入则展示对象卡，否则手动输入 -->
        <div v-if="query_target" class="card obj fade-up">
            <span class="obj-ico" v-html="ICO_WARN"></span>
            <div class="obj-info">
                <b>{{ query_target }}</b>
                <span>{{ query_type || '待举报内容' }}</span>
            </div>
            <span class="chip">{{ query_type_chip }}</span>
        </div>
        <template v-else>
            <label class="f-label fade-up">被举报对象<i> · 必填</i></label>
            <el-input v-model="target" class="obj-input fade-up" placeholder="例：某条点评 / 某个帖子 / 某位用户" maxlength="40" />
        </template>

        <!-- 2. 举报类型四选一（单选行，选中琥珀圆点） -->
        <div class="card reason fade-up">
            <div
                v-for="r in REASONS" :key="r"
                class="rrow" :class="{ on: reason === r }"
                @click="reason = r"
            >
                <span class="radio"></span>
                <span class="rn">{{ r }}</span>
            </div>
        </div>

        <!-- 3. 补充说明 -->
        <el-input v-model="desc" type="textarea" :rows="3" class="desc fade-up" maxlength="200" show-word-limit
            placeholder="补充说明（可选）…" />

        <!-- 4. 截图佐证：本地预览 -->
        <div class="shot-zone fade-up">
            <div v-if="shot_url" class="shot-box">
                <img class="shot-prev" :src="shot_url" alt="举报截图预览" />
                <span class="shot-del" @click="remove_shot">移除</span>
            </div>
            <label v-else class="chip add-shot">
                ＋ 添加截图
                <input type="file" accept="image/*" hidden @change="on_shot_change" />
            </label>
        </div>

        <!-- 5. 提交说明 -->
        <p class="tip fade-up">
            提交后由平台核实处理，处理结果将通过「获赞与消息」通知你；<br />重复举报同一内容会提示已受理。
        </p>

        <!-- 6. 我的举报记录（localStorage：本人提交的待处理 / 已处理 + 措施） -->
        <div class="rec-head"><b>我的举报记录</b><span>{{ records.length }} 条</span></div>
        <div v-for="r in records" :key="r.id" class="card rec fade-up">
            <div class="rec-info">
                <b>{{ r.target }}</b>
                <span>{{ r.reason }} · 提交于 {{ r.time }}<template v-if="r.action"> · 措施：{{ r.action }}</template></span>
            </div>
            <span class="state" :class="r.status">{{ r.status === 'pending' ? '待处理' : '已处理' }}</span>
        </div>

        <!-- 7. 管理处理说明 -->
        <p class="audit-note">管理处理保留时间、操作者、原因和处理结果，处理记录可追溯。</p>

        <div class="hold"></div>

        <!-- 底部固定提交条 -->
        <div class="subbar">
            <button class="sub-btn" :disabled="submitting" @click="submit_report">
                {{ submitting ? '提交中…' : '提交举报' }}
            </button>
        </div>
    </div>
</template>

<script setup>
/**
 * 举报提交页（对齐 P30）：
 * 被举报对象（支持 /report?target=xxx&type=点评 由他页带入，否则手动输入）→
 * 举报类型四选一（广告骚扰 / 辱骂攻击 / 虚假信息 / 隐私泄露）→ 补充说明 →
 * 截图本地预览 → 提交接 api_report.create，成功提示已受理 →
 * 我的举报记录（localStorage：本人提交的待处理 / 已处理 + 措施）→
 * 底部说明：管理处理保留时间、操作者、原因和处理结果。
 */
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api_report } from '../api';
import { load_json, save_json } from '../utils/storage.js';

const router = useRouter();
const route = useRoute();

/* ---------------- mock 常量 ---------------- */

// 举报类型四选一
const REASONS = ['广告骚扰', '辱骂攻击', '虚假信息', '隐私泄露'];

// 警示三角自绘 SVG（G4，对象卡与手动输入共用视觉）
const ICO_WARN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4L21 19H3z"/><path d="M12 10v4M12 16.5v.5"/></svg>';



/* ---------------- 状态 ---------------- */

const query_target = ref(''); // query 带入的举报对象（只读展示）
const query_type = ref(''); // query 带入的对象类型说明
const target = ref(''); // 手动输入的举报对象
const reason = ref(REASONS[0]);
const desc = ref('');
const shot_url = ref(''); // 截图本地预览地址
const submitting = ref(false);
const records = ref([]);

// query 对象卡右侧类型签
const query_type_chip = ref('点评');

/* ---------------- 生命周期 ---------------- */

onMounted(() => {
    // 支持他页通过 /report?target=xxx&type=点评 带入举报对象
    if (route.query.target) {
        query_target.value = String(route.query.target);
        query_type.value = route.query.type ? String(route.query.type) : '';
        query_type_chip.value = route.query.type ? String(route.query.type) : '内容';
    }
    records.value = load_json('dafu_report_records', []);
});

/* ---------------- 交互 ---------------- */

/**
 * 返回上一页
 */
function go_back() {
    router.back();
}

/**
 * 选择举报截图：仅本地预览（TODO: 待后端上传接口）
 * @param {Event} e 文件选择事件
 */
function on_shot_change(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    shot_url.value = URL.createObjectURL(file);
    e.target.value = ''; // 允许重复选择同一文件
}

/**
 * 移除已选截图
 */
function remove_shot() {
    shot_url.value = '';
}

/**
 * 当前日期中文串（举报记录展示用）
 * @returns {string} 形如 10 月 15 日
 */
function today_cn() {
    const d = new Date();
    return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

/**
 * 提交举报：接 api_report.create；成功 → 受理提示 + 本地记录追加「待处理」
 */
async function submit_report() {
    const final_target = query_target.value || target.value.trim();
    if (!final_target) {
        ElMessage.warning('请填写被举报对象');
        return;
    }
    submitting.value = true;
    try {
        await api_report.create({
            target: final_target,
            targetType: query_type.value || '内容',
            reason: reason.value,
            description: desc.value.trim(),
        });
        ElMessage.success({ message: '举报已受理，核实结果将通过「获赞与消息」通知', duration: 3000 });
        // 本地追加待处理记录并持久化
        records.value.unshift({
            id: Date.now(),
            target: final_target,
            reason: reason.value,
            time: today_cn(),
            status: 'pending',
            action: '',
        });
        save_json('dafu_report_records', records.value);
        // 重置表单（对象卡来自 query 保持不变）
        target.value = '';
        desc.value = '';
        shot_url.value = '';
    } catch {
        // 错误文案已由 http 拦截器统一提示，此处仅兜底
    } finally {
        submitting.value = false;
    }
}
</script>

<style scoped>
/* 顶部返回头 */
.topbar { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; min-height: 44px; }
.t-title { font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }
.t-hold { width: 40px; flex-shrink: 0; }
.icircle.back { color: var(--ink); }

/* 被举报对象卡 */
.obj { margin-top: 10px; display: flex; align-items: center; gap: 10px; }
.obj-ico {
    width: 34px; height: 34px; border-radius: 50%;
    background: #FBF0D8; color: var(--ink-3);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.obj-info { flex: 1; min-width: 0; }
.obj-info b { display: block; font-size: 12.5px; }
.obj-info span { display: block; font-size: 10px; color: var(--ink-2); margin-top: 2px; }

/* 手动输入对象 */
.f-label { display: block; font-size: 12.5px; font-weight: 700; margin: 12px 0 0; }
.f-label i { font-style: normal; font-size: 10px; color: var(--ink-2); font-weight: 400; }
.obj-input { margin-top: 8px; }

/* 举报类型单选行 */
.reason { margin-top: 12px; padding: 2px 14px; }
.rrow { display: flex; align-items: center; gap: 10px; padding: 13px 2px; cursor: pointer; }
.rrow + .rrow { border-top: 1px solid var(--line); }
.rrow .radio { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid #D8CBB0; flex-shrink: 0; position: relative; }
.rrow.on .radio { border-color: var(--brand); }
.rrow.on .radio::after { content: ''; position: absolute; inset: 3px; border-radius: 50%; background: var(--brand); }
.rrow .rn { font-size: 13px; font-weight: 600; }

/* 补充说明与截图 */
.desc { margin-top: 12px; }
.shot-zone { margin-top: 10px; }
.add-shot { cursor: pointer; }
.shot-box { display: inline-flex; align-items: center; gap: 8px; }
.shot-prev { width: 76px; height: 76px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--line); }
.shot-del { font-size: 10.5px; color: var(--bad); cursor: pointer; }

/* 提交说明 */
.tip { text-align: center; font-size: 9.5px; color: var(--ink-2); margin: 10px 0 0; line-height: 1.7; }

/* 举报记录 */
.rec-head { display: flex; align-items: baseline; justify-content: space-between; padding: 20px 2px 0; }
.rec-head b { font-size: 14px; }
.rec-head span { font-size: 10px; color: var(--ink-2); }
.rec { margin-top: 10px; padding: 11px 13px; display: flex; align-items: center; gap: 9px; }
.rec-info { flex: 1; min-width: 0; }
.rec-info b { display: block; font-size: 12.5px; }
.rec-info span { display: block; font-size: 9.5px; color: var(--ink-2); margin-top: 3px; line-height: 1.6; }

/* 处理状态签 */
.state { font-size: 9px; padding: 3px 9px; border-radius: var(--radius-sm); font-weight: 700; flex-shrink: 0; }
.state.pending { background: #FBF0D8; color: #a06a10; }
.state.done { background: #E8F3E4; color: #3E7C3A; }

/* 管理处理说明 */
.audit-note { text-align: center; font-size: 9.5px; color: var(--ink-2); margin: 12px 0 0; line-height: 1.7; }

/* 给底部固定提交条让位 */
.hold { height: 84px; }
.rp { padding-bottom: 140px; } /* 页尾让位 固定提交条 + tabbar */

/* 底部固定提交条（墨色按钮，对齐原型） */
.subbar {
    position: fixed; bottom: calc(72px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%);
    width: 100%; max-width: 480px; padding: 10px 16px;
    background: linear-gradient(transparent, var(--page) 30%); z-index: 8;
}
.sub-btn {
    display: block; width: 100%; height: 44px;
    background: var(--ink); color: var(--paper);
    border: none; border-radius: var(--radius-sm);
    font-size: 15px; font-weight: 800; cursor: pointer;
    transition: opacity .12s ease;
}
.sub-btn:disabled { opacity: .6; cursor: default; }
.sub-btn:not(:disabled):active { transform: translateY(1px); }

/* ===== 桌面适配（≥769）===== */
@media (min-width: 769px) {
    /* 桌面：举报列收窄至 640px 并保持居中 */
    .rp { max-width: 640px; }
    /* 桌面：底部固定提交条与 640 内容列对齐（移动端仍为 480 手机档） */
    .subbar { max-width: 640px; }
}
</style>
