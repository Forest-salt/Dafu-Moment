import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 开发代理：/api 与 /img → 本地后端 3000（生产由 Nginx 反代）
export default defineConfig({
    plugins: [vue()],
    server: {
        port: 5175,
        proxy: {
            '/api': { target: 'http://localhost:3000', changeOrigin: true },
            '/img': { target: 'http://localhost:3000', changeOrigin: true },
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    echarts: ['echarts'],
                    'element-plus': ['element-plus'],
                },
            },
        },
    },
});
