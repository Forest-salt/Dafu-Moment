/**
 * axios 封装：统一 {code,msg,data} 解包、401 跳登录、错误码→人话文案映射
 */
import axios from 'axios';
import { ElMessage } from 'element-plus';

const http = axios.create({ baseURL: '/api', timeout: 15000 });

// 请求拦截：附 JWT
http.interceptors.request.use((config) => {
    const token = localStorage.getItem('fk_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// 错误码 → 人话文案映射表（04 §六）
const MSG_MAP = {
    401: '请先登录',
    403: '没有权限操作',
    404: '内容不存在或已下架',
    409: '操作冲突，请刷新后重试',
    422: '填写的内容有误',
    429: '手速太快啦，休息一下再试',
    500: '服务器开小差了，请稍后重试',
};

http.interceptors.response.use(
    (resp) => {
        const body = resp.data;
        if (body && body.code === 0) return body.data;
        const msg = (body && body.msg) || MSG_MAP[resp.status] || '请求失败';
        ElMessage.warning(msg);
        return Promise.reject(new Error(msg));
    },
    (error) => {
        const status = error.response ? error.response.status : 0;
        const serverMsg = error.response && error.response.data ? error.response.data.msg : '';
        if (status === 401) {
            localStorage.removeItem('fk_token');
            localStorage.removeItem('fk_user');
            if (!location.pathname.startsWith('/login')) {
                location.href = '/login';
            }
        }
        ElMessage.warning(serverMsg || MSG_MAP[status] || '网络异常，请检查连接');
        return Promise.reject(error);
    }
);

export default http;
