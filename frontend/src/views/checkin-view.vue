<template>
    <div class="page-wrap checkin">
        <!-- 顶部返回头 -->
        <div class="topbar">
            <span class="icircle back" aria-label="返回" @click="go_back">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
            </span>
            <b class="t-title">今天吃什么 · 打个卡</b>
            <i class="t-hold"></i>
        </div>

        <!-- 顶部打卡插画 -->
        <div class="hero fade-up">
            <img src="/assets/icons/ill-checkin.png" alt="打卡插画" />
        </div>

        <!-- 表单：通栏分组 + hairline 分隔（G3-1 去封闭卡） -->
        <section class="form-sec fade-up">
            <!-- 选点位 -->
            <div class="f-row">
                <label class="f-label">今天在哪吃</label>
                <el-select v-model="form.canteenId" placeholder="选择食堂 / 点位" style="width: 100%" @change="on_canteen_change">
                    <el-option v-for="c in canteen_options" :key="c.value" :label="c.label" :value="c.value" />
                </el-select>
            </div>

            <hr class="hairline" />

            <!-- 选实际消费菜品（随点位联动） -->
            <div class="f-row">
                <label class="f-label">吃了什么（可多选）</label>
                <div v-if="dish_options.length" class="dish-chips">
                    <span
                        v-for="d in dish_options" :key="d.name"
                        class="chip dish-chip" :class="{ on: form.dish_names.includes(d.name) }"
                        @click="toggle_dish(d)"
                    >{{ d.name }}<i class="dish-price">¥{{ d.price }}</i></span>
                </div>
                <div v-else class="f-hint">{{ form.canteenId ? '这个点位暂时没有在售菜品' : '先选一个点位，看看这里有什么好吃的' }}</div>
            </div>

            <hr class="hairline" />

            <!-- 日期 -->
            <div class="f-row">
                <label class="f-label">哪一天的</label>
                <el-date-picker
                    v-model="form.date" type="date" value-format="YYYY-MM-DD"
                    :clearable="false" placeholder="选择日期" style="width: 100%"
                />
            </div>

            <hr class="hairline" />

            <!-- 照片上传（本地预览多图） -->
            <div class="f-row">
                <label class="f-label">拍几张</label>
                <div class="photos">
                    <div v-for="(p, i) in form.photos" :key="i" class="ph">
                        <img :src="p" alt="打卡照片" />
                        <span class="ph-x" aria-label="删除照片" @click="remove_photo(i)">×</span>
                    </div>
                    <label v-if="form.photos.length < 9" class="ph add">
                        <input type="file" accept="image/*" multiple hidden @change="on_pick_photos" />
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </label>
                </div>
            </div>

            <hr class="hairline" />

            <!-- 随笔 -->
            <div class="f-row">
                <label class="f-label">随笔一句</label>
                <el-input
                    v-model="form.note" type="textarea" :rows="3" maxlength="200"
                    show-word-limit placeholder="今天这顿怎么样？排队久吗？阿姨手抖了吗……"
                />
            </div>

            <hr class="hairline" />

            <!-- 可见范围 -->
            <div class="f-row">
                <label class="f-label">谁能看到</label>
                <div class="vis-seg">
                    <span :class="{ on: form.visibility === 'public' }" @click="form.visibility = 'public'">公开</span>
                    <span :class="{ on: form.visibility === 'private' }" @click="form.visibility = 'private'">仅自己</span>
                </div>
                <div class="f-hint">手账默认仅自己可见，转社区帖子后会进入审核</div>
            </div>
        </section>

        <!-- 操作按钮：仅记录 / 发布打卡 -->
        <div class="ops fade-up">
            <button class="ghost-btn" @click="save(false)">仅记录</button>
            <button class="btn-primary main-btn" @click="save(true)">发布打卡</button>
        </div>
        <p class="ops-tip">发布打卡会同步点亮足迹、推进成就并获得投喂道具；仅记录只保存在本机</p>

        <!-- 成功反馈弹层：一次打卡联动清单（需求 5.1.4） -->
        <div v-if="success_open" class="mask" @click.self="success_open = false">
            <div class="success-card fade-up">
                <img class="suc-pet" src="/assets/pet/e-calm2.png" alt="福宝很满足" />
                <b class="suc-title">打卡成功！</b>
                <div class="suc-list">
                    <div class="suc-item">
                        <svg class="ck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                        写入打卡日历
                    </div>
                    <div class="suc-item">
                        <svg class="ck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                        {{ lit_text }}
                    </div>
                    <div class="suc-item">
                        <svg class="ck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                        成就进度 +1
                    </div>
                    <div class="suc-item">
                        <svg class="ck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                        获得宠物投喂道具 ×1
                    </div>
                </div>
                <button class="btn-primary suc-btn" @click="$router.push('/pet')">去喂福宝 ›</button>
                <span class="suc-later" @click="success_open = false">留在本页</span>
            </div>
        </div>
    </div>
</template>

<script setup>
/**
 * 一体化打卡页（需求 5.1.4 / AC10-AC13）：
 * 一次打卡联动 打卡日历 + 足迹点亮（首次）+ 成就进度 + 宠物投喂道具；
 * 同日同点位重复打卡需确认；「仅记录」只存本机不入公开流水。
 * 打卡/日历/宠物后端暂无写入接口 → 打卡流水存 localStorage（TODO: 待后端接口）
 */
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api_content } from '../api';
import { img_url } from '../utils/format';
import { load_json, save_json } from '../utils/storage.js';

const router = useRouter();

/* ---------------- 常量 ---------------- */

// 宠物默认档案（首次打卡时初始化；仅 props 为打卡实际发放的投喂道具数）
const DEFAULT_PET = { props: 0 };



/* ---------------- 状态 ---------------- */

// 点位下拉选项：来自后端 /canteens；拉取失败则留空并提示（不再回退假点位）
const canteen_options = ref([]);
const checkins = ref([]); // 本机打卡流水（用于重复检测）
const success_open = ref(false);
const lit_text = ref('点亮足迹');

const form = reactive({
    canteenId: null,
    date: '',
    dish_names: [],
    photos: [],
    note: '',
    visibility: 'private', // 手账默认私有
});

// 当前所选点位的在售菜品：选点位后从后端 /dishes 拉取
const dish_options = ref([]);

/* ---------------- 生命周期 ---------------- */

onMounted(() => {
    form.date = fmt_date(new Date()); // 日期默认今天
    load_canteens();
    checkins.value = load_json('dafu_checkins', []);
});

/* ---------------- 数据加载 ---------------- */

/**
 * 拉取点位列表：api_content.canteens()；失败留空并提示（不回退假点位）
 */
async function load_canteens() {
    try {
        const res = await api_content.canteens();
        // 兼容三种解包形态：数组直返 / {data:[...]} / {data:{list:[...]}}
        const list = Array.isArray(res) ? res : res?.data?.list || res?.data || [];
        if (Array.isArray(list) && list.length) {
            canteen_options.value = list.map((c) => ({ value: c.id, label: c.name }));
            return;
        }
        throw new Error('empty');
    } catch {
        canteen_options.value = [];
        ElMessage.warning('点位加载失败，请稍后重试');
    }
}

/**
 * 拉取所选点位的在售菜品：/dishes?canteenId=，供「吃了什么」chips 使用
 */
async function load_dishes() {
    dish_options.value = [];
    if (!form.canteenId) return;
    try {
        const res = await api_content.dishes({ canteenId: form.canteenId, pageSize: 60 });
        const list = Array.isArray(res) ? res : res?.list || [];
        dish_options.value = list.map((d) => ({
            id: d.id,
            name: d.name,
            price: Number(d.price) || 0,
            img: d.cover_object_key ? img_url(d.cover_object_key) : '',
        }));
    } catch { /* 错误提示由 http 拦截器统一处理 */ }
}

/* ---------------- 表单交互 ---------------- */

/**
 * 返回上一页
 */
function go_back() {
    router.back();
}

/**
 * 切换点位后清空已选菜品并重新拉取该点位菜品
 */
function on_canteen_change() {
    form.dish_names = [];
    load_dishes();
}

/**
 * 勾选 / 取消一道菜
 * @param {{name: string}} dish 菜品对象
 */
function toggle_dish(dish) {
    const i = form.dish_names.indexOf(dish.name);
    if (i >= 0) form.dish_names.splice(i, 1);
    else form.dish_names.push(dish.name);
}

/**
 * 选择照片：生成本地预览地址（最多 9 张）
 * @param {Event} e 文件选择事件
 */
function on_pick_photos(e) {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
        if (form.photos.length >= 9) break;
        form.photos.push(URL.createObjectURL(f));
    }
    e.target.value = ''; // 允许重复选择同一文件
}

/**
 * 移除一张预览照片
 * @param {number} i 下标
 */
function remove_photo(i) {
    form.photos.splice(i, 1);
}

/* ---------------- 保存与联动 ---------------- */

/**
 * 保存打卡
 * @param {boolean} publish true=发布打卡（完整联动）；false=仅记录（只存本机）
 */
async function save(publish) {
    if (!form.canteenId) { ElMessage.warning('先选一个点位'); return; }
    if (form.dish_names.length === 0) { ElMessage.warning('至少选一样今天吃到的'); return; }

    const canteen_label = canteen_options.value.find((c) => c.value === form.canteenId)?.label || '该点位';

    // 重复打卡：同一自然日同一店铺需确认（需求 AC 口径）
    const dup = checkins.value.some((c) => c.date === form.date && c.canteenId === form.canteenId);
    if (dup) {
        try {
            await ElMessageBox.confirm(
                `${form.date} 已经在「${canteen_label}」打过卡啦，再记一条吗？`,
                '重复打卡确认',
                { confirmButtonText: '继续打卡', cancelButtonText: '再想想', type: 'warning' },
            );
        } catch {
            return; // 用户取消
        }
    }

    // 组装流水记录
    const dishes = dish_options.value.filter((d) => form.dish_names.includes(d.name));
    const rec = {
        id: `ck_${Date.now()}`,
        date: form.date,
        meal: guess_meal(),
        canteenId: form.canteenId,
        canteenName: canteen_label,
        dishes,
        photos: [...form.photos],
        note: form.note.trim(),
        visibility: publish ? form.visibility : 'private', // 仅记录一律私有
        createdAt: new Date().toISOString(),
    };

    // 写入打卡流水（打卡日历 / 足迹 / 手账共同数据源）
    checkins.value.unshift(rec);
    save_json('dafu_checkins', checkins.value);

    if (!publish) {
        // 仅记录：只存 localStorage，不触发联动
        ElMessage.success('已记到本机手账（仅自己可见）');
        return;
    }

    // ---- 一体化联动（TODO: 待后端接口）----
    // 1) 足迹点亮：该点位本机首次打卡 → 「首次点亮」，否则 +1
    const first_lit = !checkins.value.some((c) => c.id !== rec.id && c.canteenId === rec.canteenId);
    lit_text.value = first_lit ? `点亮足迹 · ${rec.canteenName}` : '足迹打卡 +1';

    // 2) 成就进度 +1（键名 checkins 与成就页/任务中心读取口径一致）
    const achv = load_json('dafu_achv_progress', {});
    achv.checkins = (achv.checkins || 0) + 1;
    save_json('dafu_achv_progress', achv);

    // 3) 宠物投喂道具 +1
    const pet = load_json('dafu_pet', { ...DEFAULT_PET });
    pet.props = (pet.props || 0) + 1;
    save_json('dafu_pet', pet);

    // 4) 成功反馈弹层（含联动清单 + 去喂福宝入口）
    success_open.value = true;
}

/* ---------------- 工具函数 ---------------- */

/**
 * 日期格式化 YYYY-MM-DD（本地时区）
 * @param {Date} d 日期对象
 * @returns {string} 格式化结果
 */
function fmt_date(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * 按当前时段猜餐次
 * @returns {string} 早餐/午餐/下午茶/晚餐/夜宵
 */
function guess_meal() {
    const h = new Date().getHours();
    if (h < 10) return '早餐';
    if (h < 14) return '午餐';
    if (h < 17) return '下午茶';
    if (h < 21) return '晚餐';
    return '夜宵';
}
</script>

<style scoped>
/* 顶部返回头 */
.topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 12px;
    min-height: 44px;
}
.t-title { font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }
.t-hold { width: 40px; flex-shrink: 0; }
.icircle.back { color: var(--ink); }

/* 插画区 */
.hero { display: flex; justify-content: center; padding: 14px 0 2px; }
.hero img { height: 104px; object-fit: contain; }

/* 表单分组：通栏 + hairline，行距放大（G2-2） */
.form-sec { padding-top: 14px; }
.f-row { padding: 10px 0 4px; }
.f-label {
    display: block;
    font-size: 10.5px;
    color: var(--ink-2);
    font-weight: 400;
    margin-bottom: 9px;
    letter-spacing: 1px;
}
.f-hint { font-size: 10px; color: var(--ink-2); margin-top: 7px; line-height: 1.7; }

/* 菜品 chips（去胶囊：8px 圆角） */
.dish-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.dish-chip { font-size: 11.5px; padding: 7px 12px; cursor: pointer; background: var(--paper); border: 1px solid var(--line); font-weight: 600; transition: background .12s ease, color .12s ease, border-color .12s ease; }
.dish-chip .dish-price { font-style: normal; font-size: 10px; color: var(--ink-2); margin-left: 5px; font-weight: 400; }
.dish-chip.on { background: var(--brand); border-color: var(--brand); color: #FFFDF5; }
.dish-chip.on .dish-price { color: rgba(255, 253, 245, 0.8); }

/* 照片九宫格 */
.photos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.ph { position: relative; width: 100%; aspect-ratio: 1; border-radius: var(--radius-sm); overflow: hidden; }
.ph img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ph.add {
    display: flex; align-items: center; justify-content: center;
    background: var(--paper); border: 1px dashed var(--line); color: var(--ink-2);
    cursor: pointer;
}
.ph-x {
    position: absolute; top: 0; right: 0; width: 20px; height: 20px;
    background: rgba(58, 46, 26, 0.72); color: #FFFDF5;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; cursor: pointer; border-radius: 0 0 0 8px;
}

/* 可见范围分段（8px 微圆角，无胶囊） */
.vis-seg { display: flex; background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 3px; gap: 3px; }
.vis-seg span {
    flex: 1; text-align: center; font-size: 12px; font-weight: 600;
    padding: 7px 0; border-radius: 6px; color: var(--ink-2); cursor: pointer;
    transition: background .12s ease, color .12s ease;
}
.vis-seg span.on { background: var(--brand); color: #FFFDF5; }

/* 操作按钮 */
.ops { display: flex; gap: 10px; margin-top: 26px; }
.ghost-btn {
    flex: 1; height: 45px; border-radius: var(--radius-sm);
    background: var(--paper); color: var(--ink-3);
    border: 1px solid var(--line); font-size: 13px; font-weight: 700; cursor: pointer;
    transition: background .12s ease;
}
.ghost-btn:hover { background: #FBF3DC; }
.main-btn { flex: 1.6; height: 45px; font-size: 14px; }
.ops-tip { font-size: 10px; color: var(--ink-2); text-align: center; line-height: 1.7; margin: 10px 0 0; }

/* 成功反馈弹层 */
.mask { position: fixed; inset: 0; background: rgba(58, 46, 26, 0.4); z-index: 30; display: flex; align-items: center; justify-content: center; padding: 20px; }
.success-card { width: 309px; max-width: 100%; background: var(--paper); border-radius: var(--radius); box-shadow: 0 8px 30px rgba(58, 46, 26, 0.3); padding: 18px; text-align: center; }
.suc-pet { width: 92px; height: 92px; object-fit: contain; margin: 0 auto; }
.suc-title { display: block; font-size: 16px; font-weight: 800; margin-top: 4px; }
.suc-list { margin: 14px 0 16px; text-align: left; display: flex; flex-direction: column; gap: 9px; }
.suc-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #5C4A2E; }
.suc-item .ck { width: 16px; height: 16px; flex-shrink: 0; color: var(--brand); background: var(--brand-light); border-radius: 50%; padding: 2.5px; }
.suc-btn { width: 100%; height: 42px; }
.suc-later { display: inline-block; font-size: 11px; color: var(--ink-2); margin-top: 11px; cursor: pointer; }
.suc-later:hover { color: var(--brand-dark); }

/* ===== 桌面适配（≥769）===== */
@media (min-width: 769px) {
    /* 打卡表单页限宽 720 居中：长表单在宽幅下更易填写（页面为表单流，无日历/统计卡可分栏） */
    .page-wrap.checkin { max-width: 720px; }
    /* 照片九宫格桌面 4 列改 6 列，减少纵向占用 */
    .photos { grid-template-columns: repeat(6, 1fr); }
}
</style>
