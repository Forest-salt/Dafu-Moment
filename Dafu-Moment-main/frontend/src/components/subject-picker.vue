<template>
    <div class="subject-picker">
        <el-select v-model="canteen_id" placeholder="选食堂" style="width: 220px" @change="load_stations">
            <el-option v-for="c in canteens" :key="c.id" :value="c.id" :label="c.name" />
        </el-select>
        <el-select v-model="station_id" placeholder="选窗口（可选）" style="width: 200px" clearable @change="load_dishes">
            <el-option v-for="s in stations" :key="s.id" :value="s.id" :label="s.name" />
        </el-select>
        <el-select v-model="dish_id" placeholder="选菜品（可选，不选=评窗口）" style="width: 240px" clearable>
            <el-option v-for="d in dishes" :key="d.id" :value="d.id" :label="`${d.name} ¥${d.price}`" />
        </el-select>
    </div>
</template>

<script setup>
/**
 * SubjectPicker：点评对象三级联动（食堂→窗口→菜品，多态评价）
 */
import { ref, watch } from 'vue';
import { api_content } from '../api';

const canteen_id = ref(null);
const station_id = ref(null);
const dish_id = ref(null);
const canteens = ref([]);
const stations = ref([]);
const dishes = ref([]);

const emit = defineEmits(['change']);

/**
 * 初始化食堂列表
 */
async function init() {
    canteens.value = await api_content.canteens();
}

/**
 * 加载窗口列表
 */
async function load_stations() {
    station_id.value = null;
    dish_id.value = null;
    dishes.value = [];
    if (!canteen_id.value) return;
    const data = await api_content.canteen_detail(canteen_id.value);
    stations.value = data.stations;
}

/**
 * 加载菜品列表
 */
async function load_dishes() {
    dish_id.value = null;
    if (!station_id.value) {
        dishes.value = [];
        return;
    }
    const data = await api_content.station_detail(station_id.value);
    dishes.value = data.dishes;
}

watch([dish_id, station_id, canteen_id], () => {
    // 菜品 > 窗口 > 食堂（多态优先级）；canteen_id 必须入 watch——否则「仅评食堂」（subject_type=2）时两级本为 null 无变化、change 永不触发
    if (dish_id.value) emit('change', { subjectType: 0, subjectId: dish_id.value });
    else if (station_id.value) emit('change', { subjectType: 1, subjectId: station_id.value });
    else if (canteen_id.value) emit('change', { subjectType: 2, subjectId: canteen_id.value });
    else emit('change', null);
});

/**
 * 外部回填（编辑/带参进入）
 * @param {{subjectType:number, subjectId:number}} subject
 */
async function fill(subject) {
    if (!subject) return;
    // 由 subject 反查三级：菜品→窗口→食堂
    if (subject.subjectType === 0) {
        const d = await api_content.dish_detail(subject.subjectId);
        canteen_id.value = d.dish.canteen_id;
        await load_stations();
        station_id.value = d.dish.station_id;
        await load_dishes();
        dish_id.value = subject.subjectId;
    } else if (subject.subjectType === 1) {
        const s = await api_content.station_detail(subject.subjectId);
        canteen_id.value = s.station.canteen_id;
        await load_stations();
        station_id.value = subject.subjectId;
    } else {
        canteen_id.value = subject.subjectId;
    }
}

defineExpose({ fill });
init();
</script>

<style scoped>
.subject-picker { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
