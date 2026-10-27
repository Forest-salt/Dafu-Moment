<template>
    <div class="page-wrap mbti-page">
        <!-- 顶部标题栏：返回 + 页名 -->
        <div class="titlebar">
            <span class="icircle back" role="button" aria-label="返回" @click="go_back">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3A2E1A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
            </span>
            <b class="tb-title">测一测 饭MBTI</b>
        </div>

        <!-- ===== 未测：答题态 ===== -->
        <template v-if="!result">
            <!-- 头卡：功能插画 + 进度条 -->
            <div class="card head-card fade-up">
                <img class="head-ill" src="/assets/icons/ill-mbti.png" alt="饭MBTI" />
                <b class="head-title">答题生成你的口味画像</b>
                <p class="head-sub">5 道小题，测出属于你的「饭 MBTI」，并生成可复用的口味画像</p>
                <div class="bar"><i :style="{ width: progress + '%' }"></i></div>
                <span class="bar-label">{{ answered_count }}/5 已答 · 数据不足 3 题暂不生成</span>
            </div>

            <!-- 题目卡：辣度 / 口味 / 场景 / 预算 / 排队 -->
            <div v-for="(q, qi) in QUESTIONS" :key="q.key" class="card q-card fade-up" :style="{ animationDelay: qi * 0.04 + 's' }">
                <b class="q-title">{{ qi + 1 }}. {{ q.title }}</b>
                <div class="chips">
                    <span
                        v-for="opt in q.options" :key="opt.label"
                        class="pchip" :class="{ on: answers[q.key] === opt.label }"
                        @click="pick(q.key, opt.label)"
                    >{{ opt.label }}</span>
                </div>
            </div>

            <div class="ops">
                <button class="btn-primary gen-btn" :disabled="generating" @click="generate">{{ generating ? '生成中…' : '生成我的饭MBTI' }}</button>
            </div>
            <p v-if="hint_lack" class="lack-tip">画像数据还不够，再答 {{ 3 - answered_count }} 题会更准，继续积累不着急~</p>
        </template>

        <!-- ===== 已测：结果态（同时承担「口味画像」输出） ===== -->
        <template v-else>
            <!-- 口味人格大卡（对齐 P17 结果卡） -->
            <div class="card result-card fade-up">
                <img class="res-img" :src="result.img" :alt="`${result.code} ${result.name}`" />
                <div class="res-cap">我的口味人格是</div>
                <div class="res-name">{{ result.name }}</div>
                <span class="tag res-code">{{ result.code }} · {{ result.sub }}</span>
                <p class="res-desc">{{ result.desc }}</p>
            </div>

            <!-- 五维口味画像（辣度/口味风格/消费倾向/常见场景/排队接受度） -->
            <div class="card trait-card fade-up" style="animation-delay:.06s">
                <b class="card-title">口味画像</b>
                <div v-for="t in result.traits" :key="t.label" class="trow">
                    <span class="tlabel">{{ t.label }}</span>
                    <span class="stars">
                        <svg v-for="n in 5" :key="n" viewBox="0 0 24 24" :fill="n <= t.stars ? '#D89A2A' : 'none'" :stroke="n <= t.stars ? 'none' : '#D8CBB0'" stroke-width="1.6"><path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z"/></svg>
                    </span>
                    <span class="tval">{{ t.text }}</span>
                </div>
            </div>

            <!-- 操作：分享海报 / 重新测试 / 删除画像 -->
            <div class="ops fade-up" style="animation-delay:.12s">
                <button class="btn-primary op-main" @click="share_open = true">分享海报</button>
                <button class="btn-ghost" @click="retest">重新测试</button>
                <button class="btn-ghost danger" @click="remove_profile">删除画像</button>
            </div>
        </template>

        <!-- 分享海报弹窗：简洁分享卡（插画 + 类型名），可复制文案 / 保存图片 -->
        <el-dialog v-model="share_open" title="分享我的饭MBTI" width="320px">
            <div v-if="result" class="poster">
                <span class="poster-brand">大福食刻 · 饭MBTI</span>
                <img class="poster-img" :src="result.img" :alt="result.name" />
                <b class="poster-name">{{ result.name }}</b>
                <span class="tag">{{ result.code }} · {{ result.sub }}</span>
                <p class="poster-line">我在大福食刻测出了口味人格，快来测测你的！</p>
            </div>
            <template #footer>
                <div class="share-ops">
                    <el-button @click="copy_share_text">复制文案</el-button>
                    <el-button type="primary" @click="save_poster">保存图片</el-button>
                </div>
            </template>
        </el-dialog>

        <!-- 合规声明（AC24；画像由本地问答规则即时计算，如实说明仅作娱乐参考） -->
        <p class="compliance">以上内容仅供参考，不替代专业医生、营养师的医疗诊断与营养方案。<br>画像由本地问答规则生成，仅作娱乐参考。</p>
    </div>
</template>

<script setup>
/**
 * 测一测 饭MBTI（对齐 P17，同时承担「口味画像」输出）
 * 未测：5 道单选（辣度/口味/场景/预算/排队）+ 进度条，答题数 < 3 不生成并提示继续积累；
 * 结果：16 型映射 + 大图 + 五维画像 + 分享海报（复制文案/保存图片）+ 重新测试 + 删除画像；
 * 结果存 localStorage(dafu_mbti)，下次进入直接显示。
 * TODO: 待后端接口（当前为页内规则映射 + 本地持久化）
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
/** 本地持久化键（题目映射与画像均为前端规则，TODO: 待后端接口后迁移） */
const STORAGE_KEY = 'dafu_mbti';

// 16 型人格档案（与 /assets/mbti 素材一一对应）
const MBTI_TYPES = [
    { code: 'INTP', name: '分析家', sub: '冷静拆解派', img: '/assets/mbti/01_INTP_分析家.png', desc: '点单前先看遍测评，配料表都研究明白了。' },
    { code: 'ISFJ', name: '清甜守护者', sub: '温柔甜品挂', img: '/assets/mbti/02_ISFJ_清甜守护者.png', desc: '胃的角落永远留给一份温柔的甜品。' },
    { code: 'ESTJ', name: '辣爽探险家', sub: '重辣爱好者', img: '/assets/mbti/03_ESTJ_辣爽探险家.png', desc: '无辣不欢，微辣在你这里等于没放。' },
    { code: 'ESFP', name: '派对星光', sub: '聚餐气氛组', img: '/assets/mbti/04_ESFP_派对星光.png', desc: '干饭必呼朋引伴，热闹的桌才香。' },
    { code: 'ENFJ', name: '新菜灵感', sub: '新品首发官', img: '/assets/mbti/05_ENFJ_新菜灵感.png', desc: '档口一上新，你永远是第一个冲的。' },
    { code: 'ENTJ', name: '工程专家', sub: '干饭计划通', img: '/assets/mbti/06_ENTJ_工程专家.png', desc: '一周食谱提前排好，效率与美味兼得。' },
    { code: 'INFP', name: '梦境云朵', sub: '氛围感食客', img: '/assets/mbti/07_INFP_梦境云朵.png', desc: '吃饭吃的是心情，窗边座位优先。' },
    { code: 'ISFP', name: '花艺甜品', sub: '颜值至上者', img: '/assets/mbti/08_ISFP_花艺甜品.png', desc: '先拍照后开动，摆盘不好看直接劝退。' },
    { code: 'ENFP', name: '好奇美食家', sub: '万物皆可试', img: '/assets/mbti/09_ENFP_好奇美食家.png', desc: '没吃过的都想来一口，冒险精神满分。' },
    { code: 'ISTJ', name: '牛仔品鉴官', sub: '老字号忠实粉', img: '/assets/mbti/10_ISTJ_牛仔品鉴官.png', desc: '认准一家老店，十年如一日的信任。' },
    { code: 'ESTP', name: '墨镜飞行者', sub: '说走就走型', img: '/assets/mbti/11_ESTP_墨镜飞行者.png', desc: '说吃就吃，绝不内耗，出门就是干。' },
    { code: 'ENTP', name: '船长认证官', sub: '隐藏菜单猎人', img: '/assets/mbti/12_ENTP_船长认证官.png', desc: '专攻菜单上没有的隐藏吃法。' },
    { code: 'INFJ', name: '紫斗篷云朵', sub: '深夜食堂党', img: '/assets/mbti/13_INFJ_紫斗篷云朵.png', desc: '夜宵时段的灵魂食客，越晚越清醒。' },
    { code: 'INTJ', name: '皇冠星星', sub: '效率干饭人', img: '/assets/mbti/14_INTJ_皇冠星星.png', desc: '出餐速度和口味都写在你的评分表里。' },
    { code: 'ESFJ', name: '爱心厨师', sub: '投喂型选手', img: '/assets/mbti/15_ESFJ_爱心厨师.png', desc: '最大的快乐是看朋友吃光你推荐的菜。' },
    { code: 'ISTP', name: '贝雷帽菜单', sub: '极简点单流', img: '/assets/mbti/16_ISTP_贝雷帽菜单.png', desc: '点单不超过三十秒，招牌菜直接拿下。' },
];

// 5 道题（辣度/口味/场景/预算/排队），score 为各 MBTI 类型积分（纯前端规则映射）
const QUESTIONS = [
    { key: 'spicy', title: '你的辣度容忍是？', options: [
        { label: '完全不辣', stars: 1, score: { ISFJ: 2, INFP: 1 } },
        { label: '微辣刚好', stars: 2, score: { ESFJ: 2, ISFJ: 1 } },
        { label: '中辣过瘾', stars: 4, score: { ESFP: 2, ENTP: 1 } },
        { label: '重辣才爽', stars: 5, score: { ESTJ: 2, ESTP: 1 } },
    ] },
    { key: 'flavor', title: '更偏爱的口味风格？', options: [
        { label: '清淡本味', stars: 1, score: { ISTJ: 2, ISFJ: 1 } },
        { label: '家常下饭', stars: 2, score: { ESFJ: 2, ESTJ: 1 } },
        { label: '酸甜脑洞', stars: 3, score: { INFP: 2, ISFP: 1 } },
        { label: '猎奇混搭', stars: 5, score: { ENTP: 2, ENFP: 1 } },
    ] },
    { key: 'scene', title: '最常见的就餐场景？', options: [
        { label: '一人食安静干饭', stars: 2, score: { INTP: 2, ISTJ: 1, INFJ: 1 } },
        { label: '好友围桌热闹', stars: 5, score: { ESFJ: 2, ESFP: 1, ENFJ: 1 } },
        { label: '掐点快取不停留', stars: 1, score: { ISTP: 2, INTJ: 1 } },
        { label: '周末慢慢探店', stars: 4, score: { ENFP: 2, ENFJ: 1 } },
    ] },
    { key: 'budget', title: '单餐预算更多是？', options: [
        { label: '¥10 内精打细算', stars: 1, score: { ISTJ: 2, INTP: 1 } },
        { label: '¥15 左右刚刚好', stars: 2, score: { ISFJ: 1, ESFJ: 1 } },
        { label: '¥20 想吃点好的', stars: 4, score: { ENTJ: 2, ESTP: 1 } },
        { label: '遇到好吃的价格不限', stars: 5, score: { ENFP: 2, ESFP: 1 } },
    ] },
    { key: 'queue', title: '遇到网红店你一般？', options: [
        { label: '绝不排队绕道走', stars: 1, score: { ISTP: 2, INTJ: 1 } },
        { label: '10 分钟内可以等', stars: 2, score: { ISTJ: 2, ISFJ: 1 } },
        { label: '30 分钟看情况', stars: 3, score: { ESTP: 2, ENTP: 1 } },
        { label: '必打卡绝不错过', stars: 5, score: { ESFP: 2, ENFJ: 1 } },
    ] },
];

const answers = ref({});
const result = ref(null);
const generating = ref(false);
const hint_lack = ref(false);
const share_open = ref(false);

/** 已答题数与进度条百分比 */
const answered_count = computed(() => QUESTIONS.filter((q) => answers.value[q.key]).length);
const progress = computed(() => Math.round((answered_count.value / QUESTIONS.length) * 100));

/**
 * 选择某题选项
 * @param {string} key - 题目键
 * @param {string} label - 选项文案
 */
function pick(key, label) {
    answers.value[key] = label;
    // 重新作答后撤销「数据不足」提示
    if (answered_count.value >= 3) hint_lack.value = false;
}

/**
 * 按已选答案生成五维口味画像（辣度偏好/口味风格/消费倾向/常见场景/排队接受度）
 */
function build_traits() {
    const find_opt = (key) => {
        const q = QUESTIONS.find((x) => x.key === key);
        return q ? q.options.find((o) => o.label === answers.value[key]) : null;
    };
    const spicy = find_opt('spicy');
    const flavor = find_opt('flavor');
    const scene = find_opt('scene');
    const budget = find_opt('budget');
    const queue = find_opt('queue');
    return [
        { label: '辣度偏好', stars: spicy ? spicy.stars : 3, text: spicy ? spicy.label : '待积累' },
        { label: '口味风格', stars: flavor ? flavor.stars : 3, text: flavor ? flavor.label : '待积累' },
        { label: '消费倾向', stars: budget ? budget.stars : 3, text: budget ? budget.label : '待积累' },
        { label: '常见场景', stars: scene ? scene.stars : 3, text: scene ? scene.label : '待积累' },
        { label: '排队接受度', stars: queue ? queue.stars : 3, text: queue ? queue.label : '待积累' },
    ];
}

/**
 * 生成饭MBTI：积分法映射 16 型（累加各题选项分数取最高）；
 * 答题数 < 3 时提示继续积累，不强制生成
 */
function generate() {
    if (answered_count.value < 3) {
        hint_lack.value = true;
        ElMessage.warning(`画像数据还不够（已答 ${answered_count.value}/5），继续积累会更准哦`);
        return;
    }
    generating.value = true;
    // 模拟短耗时，增强「生成」反馈
    setTimeout(() => {
        const total = {};
        for (const q of QUESTIONS) {
            const opt = q.options.find((o) => o.label === answers.value[q.key]);
            if (!opt) continue;
            for (const [code, s] of Object.entries(opt.score)) {
                total[code] = (total[code] || 0) + s;
            }
        }
        let best = MBTI_TYPES[0];
        let best_score = -1;
        for (const t of MBTI_TYPES) {
            const s = total[t.code] || 0;
            if (s > best_score) { best_score = s; best = t; }
        }
        result.value = { ...best, traits: build_traits(), created_at: Date.now() };
        // TODO: 待后端接口，当前仅本地持久化
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result.value));
        generating.value = false;
        ElMessage.success(`测出来啦：${best.name} ${best.code}`);
    }, 500);
}

/**
 * 重新测试：清空作答回到题目态（旧画像保留到重新生成时覆盖）
 */
function retest() {
    answers.value = {};
    result.value = null;
    hint_lack.value = false;
}

/**
 * 删除画像：清空 localStorage(dafu_mbti) 并回到答题态
 */
async function remove_profile() {
    try {
        await ElMessageBox.confirm('删除后画像与本地记录都会清空，需要重新测试。确定删除吗？', '删除口味画像', {
            confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
        });
    } catch { return; /* 取消 */ }
    localStorage.removeItem(STORAGE_KEY);
    result.value = null;
    answers.value = {};
    ElMessage.success('口味画像已删除');
}

/** 分享文案（复制文案用） */
const share_text = computed(() => {
    if (!result.value) return '';
    return `我在大福食刻测出了饭MBTI：${result.value.name} ${result.value.code}（${result.value.sub}）！快来测测你的口味人格~`;
});

/**
 * 复制分享文案到剪贴板
 */
async function copy_share_text() {
    try {
        await navigator.clipboard.writeText(share_text.value);
        ElMessage.success('文案已复制，去粘贴给同学吧');
    } catch {
        ElMessage.error('复制失败，请手动选择文字复制');
    }
}

/**
 * 手绘圆角矩形（canvas 2D 兼容写法）
 */
function round_rect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

/**
 * 用 canvas 合成分享海报（插画 + 类型名 + 品牌与声明小字），返回 PNG dataURL
 */
function draw_poster() {
    return new Promise((resolve, reject) => {
        const c = document.createElement('canvas');
        c.width = 640;
        c.height = 800;
        const ctx = c.getContext('2d');
        // 页底纸色
        ctx.fillStyle = '#FAF4E3';
        ctx.fillRect(0, 0, 640, 800);
        // 卡面
        ctx.fillStyle = '#FFFDF5';
        round_rect(ctx, 40, 60, 560, 620, 24);
        ctx.fill();
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 200, 120, 240, 240);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#B0A18A';
            ctx.font = '24px "PingFang SC","Microsoft YaHei",sans-serif';
            ctx.fillText('我的口味人格是', 320, 424);
            ctx.fillStyle = '#3A2E1A';
            ctx.font = '800 52px "PingFang SC","Microsoft YaHei",sans-serif';
            ctx.fillText(result.value.name, 320, 496);
            ctx.fillStyle = '#8A6A3A';
            ctx.font = '600 28px "PingFang SC","Microsoft YaHei",sans-serif';
            ctx.fillText(`${result.value.code} · ${result.value.sub}`, 320, 552);
            ctx.fillStyle = '#B0A18A';
            ctx.font = '22px "PingFang SC","Microsoft YaHei",sans-serif';
            ctx.fillText('大福食刻 · 饭MBTI', 320, 646);
            ctx.font = '18px "PingFang SC","Microsoft YaHei",sans-serif';
            ctx.fillText('以上内容仅供参考，不替代专业建议', 320, 762);
            resolve(c.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = result.value.img;
    });
}

/**
 * 保存海报：canvas 合成后触发下载
 */
async function save_poster() {
    try {
        const url = await draw_poster();
        const a = document.createElement('a');
        a.href = url;
        a.download = `饭MBTI_${result.value.code}.png`;
        a.click();
        ElMessage.success('海报已保存');
    } catch {
        ElMessage.error('海报生成失败，试试复制文案分享');
    }
}

/**
 * 返回 AI 助手主页
 */
function go_back() {
    router.push('/ai');
}

onMounted(() => {
    // 已有画像则直接展示结果（下次进入不再答题）
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (saved && saved.code && saved.traits) result.value = saved;
    } catch { /* 本地数据损坏时按未测处理 */ }
});
</script>

<style scoped>
.mbti-page { padding-bottom: 8px; }

/* 顶部标题栏 */
.titlebar { height: 48px; display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.tb-title { font-size: 16px; font-weight: 700; }

/* ===== 头卡：插画 + 进度条 ===== */
.head-card { text-align: center; margin-top: 6px; }
.head-ill { width: 84px; height: 84px; object-fit: contain; margin: 0 auto; }
.head-title { display: block; font-size: 15px; font-weight: 700; margin-top: 6px; }
.head-sub { margin: 5px auto 0; font-size: 11.5px; color: var(--ink-2); line-height: 1.7; font-weight: 400; max-width: 280px; }
.bar { height: 4px; border-radius: 4px; background: var(--line); overflow: hidden; margin-top: 14px; }
.bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--sun), var(--star)); border-radius: 4px; transition: width .25s ease; }
.bar-label { display: block; font-size: 10px; color: var(--ink-2); margin-top: 6px; font-weight: 400; }

/* ===== 题目卡 ===== */
.q-card { margin-top: 12px; }
.q-title { display: block; font-size: 13.5px; font-weight: 700; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 11px; }
/* 选项 chip：微圆角 + 墨色选中（对齐 P21 chips） */
.pchip {
    font-size: 12px; padding: 6px 14px; border-radius: var(--radius-sm);
    border: 1px solid var(--line); background: var(--paper); color: var(--ink-3);
    font-weight: 600; cursor: pointer; transition: background .12s ease, color .12s ease;
}
.pchip:hover { background: #FBF3DC; }
.pchip.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }

/* 生成按钮 */
.ops { display: flex; gap: 10px; margin-top: 20px; }
.ops .btn-primary, .ops .btn-ghost { flex: 1; }
.gen-btn { width: 100%; padding: 12px 18px; font-size: 14px; }
.lack-tip { text-align: center; font-size: 11.5px; color: #a06a10; margin-top: 10px; font-weight: 400; }

/* ===== 结果卡 ===== */
.result-card { text-align: center; margin-top: 6px; }
.res-img { width: 108px; height: 108px; object-fit: cover; border-radius: var(--radius); margin: 0 auto; display: block; }
.res-cap { font-size: 11px; color: var(--ink-2); margin-top: 8px; font-weight: 400; }
.res-name { font-size: 26px; font-weight: 800; letter-spacing: 2px; margin-top: 2px; }
.res-code { margin-top: 8px; }
.res-desc { margin: 8px 0 0; font-size: 11.5px; color: var(--ink-2); font-weight: 400; }

/* ===== 五维画像卡 ===== */
.trait-card { margin-top: 12px; }
.card-title { display: block; font-size: 14px; font-weight: 700; margin-bottom: 4px; }
.trow { display: flex; align-items: center; gap: 10px; padding: 9px 0; }
.trow + .trow { border-top: 1px solid var(--line); }
.tlabel { width: 74px; flex-shrink: 0; font-size: 11.5px; color: var(--ink-3); font-weight: 600; }
.stars { display: flex; gap: 3px; flex: 1; }
.stars svg { width: 14px; height: 14px; flex-shrink: 0; }
.tval { width: 108px; flex-shrink: 0; text-align: right; font-size: 11px; color: var(--ink-2); font-weight: 400; }

/* 结果操作行 */
.ops .op-main { flex: 1.4; }
.btn-ghost {
    background: var(--paper); border: 1px solid var(--line); color: var(--ink-3);
    border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; padding: 10px 14px; cursor: pointer;
    transition: background .12s ease, color .12s ease;
}
.btn-ghost:hover { background: #FBF3DC; color: var(--brand-dark); }
.btn-ghost.danger { background: #fde8e8; border-color: #fde8e8; color: var(--bad); }
.btn-ghost.danger:hover { background: #fbdcdc; color: var(--bad); }

/* ===== 分享海报卡 ===== */
.poster { text-align: center; background: var(--page); border-radius: var(--radius); padding: 18px; }
.poster-brand { display: block; font-size: 10.5px; color: var(--ink-2); letter-spacing: 1px; }
.poster-img { width: 120px; height: 120px; object-fit: cover; border-radius: var(--radius); margin: 12px auto 0; display: block; }
.poster-name { display: block; font-size: 22px; font-weight: 800; margin-top: 8px; }
.poster-line { margin: 10px 0 0; font-size: 11px; color: var(--ink-2); font-weight: 400; }
.share-ops { display: flex; justify-content: flex-end; gap: 8px; }

/* 合规声明（AC24） */
.compliance { text-align: center; font-size: 10.5px; color: var(--ink-2); margin: 26px 0 8px; line-height: 1.7; }

/* ===== 桌面适配（≥769）===== */
@media (min-width: 769px) {
    /* 整页限宽 720 居中：题目卡与结果卡同列宽，选项 chips 保持横排换行 */
    .mbti-page { max-width: 720px; }
    /* 题目与选项桌面字号放大一档 */
    .q-title { font-size: 15px; }
    .pchip { font-size: 13px; padding: 8px 18px; }
    /* 结果卡标题与描述同步放大 */
    .res-name { font-size: 30px; }
    .res-desc { font-size: 12.5px; }
}
</style>
