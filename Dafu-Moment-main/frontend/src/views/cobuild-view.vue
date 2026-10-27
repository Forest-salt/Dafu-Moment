<template>
    <div class="page-wrap cb">
        <!-- 顶部返回头 -->
        <div class="topbar">
            <span class="icircle back" aria-label="返回" @click="go_back">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
            </span>
            <b class="t-title">共建提交</b>
            <i class="t-hold"></i>
        </div>

        <!-- 1. 说明卡：共建是什么 + 审核后才进公共搜索（需求 5.1.8） -->
        <div class="card intro fade-up">
            <b>共建，让大福食刻更完整</b>
            <p>你发现的新点位 / 档口 / 菜品，或需要纠错的信息，提交后由平台审核；<b>审核通过前不会出现在公共搜索结果中</b>。</p>
        </div>

        <!-- 2. 提交类型四选一（选中型琥珀描边） -->
        <div class="tgrid fade-up">
            <div
                v-for="t in TYPES" :key="t.key"
                class="tg" :class="{ on: form.type === t.key }"
                @click="form.type = t.key"
            >
                <div class="tt">{{ t.name }}</div>
                <div class="dd">{{ t.desc }}</div>
            </div>
        </div>

        <!-- 3. 对应表单 -->
        <div class="card form-card fade-up">
            <label class="f-label">{{ name_label }}<i> · 必填</i></label>
            <el-input v-model="form.name" :placeholder="name_ph" maxlength="30" />

            <label class="f-label">所属位置<i> · 必填</i></label>
            <el-input v-model="form.location" placeholder="例：旗山校区 · 京元食堂三楼" maxlength="40" />

            <label class="f-label">营业状态</label>
            <el-select v-model="form.biz_status" class="status-sel">
                <el-option v-for="s in BIZ_STATUS" :key="s" :label="s" :value="s" />
            </el-select>

            <label class="f-label">说明与佐证<i> · 选填</i></label>
            <el-input v-model="form.desc" type="textarea" :rows="3" maxlength="200" show-word-limit
                placeholder="简单描述（如：三楼新开的麻辣烫窗口，中午 11 点开始营业）" />

            <!-- 照片佐证：本地预览（TODO: 待后端上传接口，暂不上传服务器） -->
            <label class="f-label">照片佐证</label>
            <div class="photo-zone">
                <div v-if="photo_url" class="photo-box">
                    <img class="photo-prev" :src="photo_url" alt="佐证照片预览" />
                    <span class="photo-del" @click="remove_photo">移除</span>
                </div>
                <label v-else class="chip add-photo">
                    ＋ 拍照佐证
                    <input type="file" accept="image/*" hidden @change="on_photo_change" />
                </label>
            </div>
        </div>

        <!-- 4. 我的提交记录与审核状态 -->
        <div class="rec-head">
            <b>我的提交记录</b><span>{{ records.length }} 条</span>
        </div>
        <div v-for="r in records" :key="r.id" class="card rec fade-up">
            <div class="rec-info">
                <b>{{ r.name }}</b>
                <span>{{ TYPE_MAP[r.type] }} · 提交于 {{ r.time }}<template v-if="r.reason"> · 驳回原因：{{ r.reason }}</template></span>
            </div>
            <span class="state" :class="r.status">{{ STATE_TEXT[r.status] }}</span>
        </div>
        <p class="rec-tip">通过审核前不会出现在公共搜索中。</p>

        <div class="hold"></div>

        <!-- 底部固定提交条 -->
        <div class="subbar">
            <button class="sub-btn" :disabled="submitting" @click="submit_form">
                {{ submitting ? '提交中…' : '提交审核' }}
            </button>
        </div>
    </div>
</template>

<script setup>
/**
 * 共建提交页（对齐 P28）：
 * 说明卡（共建是什么 + 审核后才进公共搜索，需求 5.1.8）→ 类型四选一
 * （新点位 / 新档口 / 新菜品 / 信息纠错，选中型琥珀描边）→ 表单
 * （名称、位置、营业状态、照片本地预览、说明）→ 提交接 api_content.submit_point，
 * 成功提示「已进入审核队列，审核前不进入公共搜索结果」→ 我的提交记录
 * （localStorage 保存本人提交：类型 / 名称 / 时间 / 状态）。
 */
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api_content } from '../api';
import { load_json, save_json } from '../utils/storage.js';

const router = useRouter();

/* ---------------- mock 常量 ---------------- */

// 提交类型四选一
const TYPES = [
    { key: 'point', name: '新点位', desc: '新的食堂 / 商圈 / 学生街店铺' },
    { key: 'station', name: '新档口', desc: '已有点位下的新档口' },
    { key: 'dish', name: '新菜品', desc: '档口里没收录的菜' },
    { key: 'correct', name: '信息纠错', desc: '价格 / 位置 / 营业时间有误' },
];
const TYPE_MAP = { point: '新点位', station: '新档口', dish: '新菜品', correct: '信息纠错' };

// 营业状态选项
const BIZ_STATUS = ['营业中', '已歇业', '待开业'];

// 审核状态文案
const STATE_TEXT = { pending: '待审核', passed: '已通过', rejected: '已驳回' };



/* ---------------- 状态 ---------------- */

const form = reactive({
    type: 'point',      // 提交类型
    name: '',           // 名称（必填）
    location: '',       // 所属位置（必填）
    biz_status: '营业中',
    desc: '',           // 说明
});
const photo_url = ref(''); // 照片本地预览地址
const submitting = ref(false);
const records = ref([]); // 我的提交记录

// 名称 label / 占位随类型切换
const name_label = computed(() => (TYPE_MAP[form.type] === '信息纠错' ? '纠错对象名称' : `${TYPE_MAP[form.type]}名称`));
const name_ph = computed(() => (form.type === 'dish' ? '例：三楼麻辣烫的宽粉' : '例：京元食堂三楼麻辣烫'));

/* ---------------- 生命周期 ---------------- */

onMounted(() => {
    // 仅读取本人历史提交记录；无记录时列表为空（不回退演示数据）
    records.value = load_json('dafu_cobuild_records', []);
});

/* ---------------- 交互 ---------------- */

/**
 * 返回上一页
 */
function go_back() {
    router.back();
}

/**
 * 选择佐证照片：仅本地预览（TODO: 待后端上传接口）
 * @param {Event} e 文件选择事件
 */
function on_photo_change(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    photo_url.value = URL.createObjectURL(file);
    e.target.value = ''; // 允许重复选择同一文件
}

/**
 * 移除已选照片
 */
function remove_photo() {
    photo_url.value = '';
}

/**
 * 当前日期中文串（提交记录展示用）
 * @returns {string} 形如 10 月 15 日
 */
function today_cn() {
    const d = new Date();
    return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

/**
 * 提交共建：接 api_content.submit_point（TODO: 图片上传待后端支持后随表单提交）
 * 成功 → 提示进入审核队列 + 本地记录追加「待审核」
 */
async function submit_form() {
    if (!form.name.trim() || !form.location.trim()) {
        ElMessage.warning('请填写名称与所属位置');
        return;
    }
    submitting.value = true;
    try {
        await api_content.submit_point({
            type: form.type,
            name: form.name.trim(),
            location: form.location.trim(),
            bizStatus: form.biz_status,
            description: form.desc.trim(),
        });
        // 成功反馈（需求 5.1.8：审核前不进入公共搜索结果）
        ElMessage.success({ message: '已进入审核队列，审核前不进入公共搜索结果', duration: 3000 });
        // 本地追加待审核记录并持久化
        records.value.unshift({
            id: Date.now(),
            type: form.type,
            name: form.name.trim(),
            time: today_cn(),
            status: 'pending',
            reason: '',
        });
        save_json('dafu_cobuild_records', records.value);
        // 清空表单（保留类型便于连续提交）
        form.name = '';
        form.location = '';
        form.biz_status = '营业中';
        form.desc = '';
        photo_url.value = '';
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

/* 说明卡 */
.intro { margin-top: 10px; }
.intro b { font-size: 13px; }
.intro p { font-size: 11px; color: #5C4A2E; line-height: 1.8; margin: 6px 0 0; }
.intro p b { font-size: 11px; color: var(--brand-dark); }

/* 类型四选一：选中型琥珀描边 */
.tgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
.tg {
    background: var(--paper); border: 1.5px solid #E8D5C0;
    border-radius: var(--radius); padding: 12px 12px; cursor: pointer;
    transition: border-color .12s ease, box-shadow .12s ease;
}
.tg.on { border-color: var(--brand); box-shadow: 0 1px 8px rgba(201, 138, 30, .18); }
.tg .tt { font-size: 13px; font-weight: 800; }
.tg .dd { font-size: 9.5px; color: var(--ink-2); margin-top: 4px; line-height: 1.5; }

/* 表单卡 */
.form-card { margin-top: 12px; }
.f-label { display: block; font-size: 12.5px; font-weight: 700; margin: 12px 0 0; }
.f-label:first-child { margin-top: 0; }
.f-label i { font-style: normal; font-size: 10px; color: var(--ink-2); font-weight: 400; }
.status-sel { width: 140px; }

/* 照片佐证：本地预览 */
.photo-zone { margin-top: 8px; }
.add-photo { cursor: pointer; }
.photo-box { display: inline-flex; align-items: center; gap: 8px; }
.photo-prev { width: 76px; height: 76px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--line); }
.photo-del { font-size: 10.5px; color: var(--bad); cursor: pointer; }

/* 提交记录 */
.rec-head { display: flex; align-items: baseline; justify-content: space-between; padding: 20px 2px 0; }
.rec-head b { font-size: 14px; }
.rec-head span { font-size: 10px; color: var(--ink-2); }
.rec { margin-top: 10px; padding: 11px 13px; display: flex; align-items: center; gap: 9px; }
.rec-info { flex: 1; min-width: 0; }
.rec-info b { display: block; font-size: 12.5px; }
.rec-info span { display: block; font-size: 9.5px; color: var(--ink-2); margin-top: 3px; line-height: 1.6; }

/* 审核状态签 */
.state { font-size: 9px; padding: 3px 9px; border-radius: var(--radius-sm); font-weight: 700; flex-shrink: 0; }
.state.pending { background: #FBF0D8; color: #a06a10; }
.state.passed { background: #E8F3E4; color: #3E7C3A; }
.state.rejected { background: #FDEEEA; color: #B03A2E; }
.rec-tip { text-align: center; font-size: 10px; color: var(--ink-2); margin: 10px 0 0; line-height: 1.7; }

/* 给底部固定提交条让位 */
.hold { height: 84px; }
.cb { padding-bottom: 140px; } /* 页尾让位 固定提交条 + tabbar */

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
    /* 桌面：共建列收窄至 680px 并保持居中 */
    .cb { max-width: 680px; }
    /* 桌面：底部固定提交条与 680 内容列对齐（移动端仍为 480 手机档） */
    .subbar { max-width: 680px; }
}
</style>
