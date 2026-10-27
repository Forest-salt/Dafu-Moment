<template>
    <div class="uploader">
        <div v-for="(img, i) in previews" :key="i" class="preview">
            <img :src="img.url" alt="" />
            <span class="remove" @click="remove_img(i)">×</span>
        </div>
        <label v-if="previews.length < 3" class="add-btn">
            <el-icon :size="22"><Plus /></el-icon>
            <span>{{ previews.length }}/3</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden @change="on_pick" />
        </label>
        <div class="tip">自动压缩 · 最多 3 张</div>
    </div>
</template>

<script setup>
/**
 * ImageUploader：Canvas 压缩（长边 1280/q0.8）→ 上传 → 预览（04 §四）
 */
import { ref } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { api_upload } from '../api';
import { compress_image } from '../utils/compress';

const previews = ref([]); // {objectKey, url}
const emit = defineEmits(['update:keys']);

/**
 * 选择图片：压缩 → 上传 → 加入预览
 * @param {Event} e
 */
async function on_pick(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
        ElMessage.warning('图片不能超过 3MB');
        return;
    }
    try {
        const blob = await compress_image(file);
        const fd = new FormData();
        fd.append('file', blob, 'upload.jpg');
        fd.append('scene', 'review');
        const data = await api_upload.image(fd);
        previews.value.push(data);
        emit('update:keys', previews.value.map((p) => p.objectKey));
    } catch { /* 拦截器已提示（含 409 判重） */ }
}

/**
 * 移除已选图片
 * @param {number} i
 */
function remove_img(i) {
    previews.value.splice(i, 1);
    emit('update:keys', previews.value.map((p) => p.objectKey));
}

/**
 * 回填已有图片（编辑模式）
 * @param {string[]} keys
 */
function fill(keys = []) {
    previews.value = keys.map((k) => ({ objectKey: k, url: `/img/${k}` }));
}

defineExpose({ fill });
</script>

<style scoped>
.uploader { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.preview { position: relative; width: 76px; height: 76px; border-radius: 8px; overflow: hidden; }
.preview img { width: 100%; height: 100%; object-fit: cover; }
.remove {
    position: absolute; top: 0; right: 0; width: 18px; height: 18px;
    background: rgba(255, 253, 244, 0.92); color: var(--ink); border-radius: 0 0 0 8px;
    display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 13px;
}
.add-btn {
    width: 76px; height: 76px; border: 1.5px dashed #d9d2ca; border-radius: 8px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: var(--ink-2); cursor: pointer; gap: 2px; font-size: 11px;
}
.add-btn:hover { border-color: var(--brand); color: var(--brand); }
.tip { width: 100%; font-size: 11px; color: var(--ink-2); }
</style>
