/**
 * 前端入口：Pinia + Router + Element Plus（全量引入，课程规模够用）
 */
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import 'element-plus/dist/index.css';
import App from './App.vue';
import router from './router';
import './styles/global.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });
app.mount('#app');

// 构建版本标记（诊断用）：控制台可核对当前标签页加载的是否为最新构建，防旧标签页跑旧代码误判
console.info('[大福食刻] 前端构建 r56 · 2026-10-10');
