/**
 * auth store：token / 用户信息 / 登录登出
 */
import { defineStore } from 'pinia';
import { api_auth } from '../api';

export const useAuthStore = defineStore('auth', {
    state: () => ({
        token: localStorage.getItem('fk_token') || '',
        user: JSON.parse(localStorage.getItem('fk_user') || 'null'),
    }),
    getters: {
        is_login: (s) => !!s.token,
        is_admin: (s) => !!s.user && s.user.role === 1,
    },
    actions: {
        /**
         * 登录并持久化（验证码错误由拦截器统一提示，调用方负责刷新图形码）
         * @param {string} username
         * @param {string} password
         * @param {{captchaId: string, captchaCode: string}} [captcha] - 图形验证码
         */
        async login(username, password, captcha) {
            const data = await api_auth.login({
                username,
                password,
                captchaId: captcha?.captchaId,
                captchaCode: captcha?.captchaCode,
            });
            this.token = data.token;
            this.user = data.user;
            localStorage.setItem('fk_token', data.token);
            localStorage.setItem('fk_user', JSON.stringify(data.user));
        },
        /**
         * 注册并自动登录（表单对象透传，验证码字段由登录页注入 captchaId/captchaCode）
         * @param {Object} form - {username, password, nickname, captchaId, captchaCode}
         */
        async register(form) {
            const data = await api_auth.register(form);
            this.token = data.token;
            this.user = data.user;
            localStorage.setItem('fk_token', data.token);
            localStorage.setItem('fk_user', JSON.stringify(data.user));
        },
        /**
         * 福大统一身份认证（SSO）登录并持久化：后端模拟 CAS 校验，
         * 已绑定直接签发，全新学号自动建号（r50）
         * @param {string} studentId - 学号/工号
         * @param {string} password - 统一身份认证口令
         */
        async sso_login(studentId, password) {
            const data = await api_auth.fzu_sso({ studentId, password });
            this.token = data.token;
            this.user = data.user;
            localStorage.setItem('fk_token', data.token);
            localStorage.setItem('fk_user', JSON.stringify(data.user));
        },
        /**
         * 真实 CAS 回调登录（r51）：校方 302 回调带回 ticket，换取 token 并持久化
         * @param {string} ticket - CAS 服务票据（ST-xxx，一次性）
         */
        async sso_ticket(ticket) {
            const data = await api_auth.fzu_sso({ ticket });
            this.token = data.token;
            this.user = data.user;
            localStorage.setItem('fk_token', data.token);
            localStorage.setItem('fk_user', JSON.stringify(data.user));
        },
        /**
         * 真实 CAS 回调绑定（r51）：已登录用户在校方授权后凭 ticket 绑定认证身份
         * @param {string} ticket - CAS 服务票据（ST-xxx，一次性）
         */
        async fzu_bind_ticket(ticket) {
            const data = await api_auth.fzu_bind({ ticket });
            this.apply_user(data);
        },
        /**
         * 合并刷新本地用户信息（个人资料修改后同步顶栏/档案页）
         * @param {Object} patch - 需要合并的用户字段
         */
        apply_user(patch) {
            if (!this.user) return;
            this.user = { ...this.user, ...patch };
            localStorage.setItem('fk_user', JSON.stringify(this.user));
        },
        /**
         * 退出登录
         */
        logout() {
            this.token = '';
            this.user = null;
            localStorage.removeItem('fk_token');
            localStorage.removeItem('fk_user');
        },
    },
});
