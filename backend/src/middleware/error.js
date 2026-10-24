/**
 * 统一错误处理：ApiError/校验错误 → 规范 JSON；未知错误 → 500
 * 响应体 code 为五位业务码（03 §5.9），HTTP 状态码保持不变
 */
const { ApiError } = require('../utils/api-error');

/** 非 ApiError 场景的 HTTP 状态 → 业务码映射（assert 校验错误等普通 Error） */
const BIZ_BY_STATUS = {
    400: 40001, 401: 40101, 403: 40301, 404: 40401, 409: 40402, 422: 40001, 429: 42901,
};

/**
 * 404 兜底（路由未命中）
 * @returns {Function} express 中间件
 */
function not_found() {
    return (req, res) => {
        res.status(404).json({ code: 40401, msg: '接口不存在' });
    };
}

/**
 * 错误处理（四参签名）
 * @returns {Function} express 中间件
 */
function error_handler() {
    return (errObj, _req, res, _next) => {
        const status = errObj.status || (Number(errObj.code) >= 400 ? Number(errObj.code) : null);
        if (status && status < 500) {
            // ApiError 自带业务码；assert 等普通 Error 按状态码映射（40001 兜底）
            const biz = errObj instanceof ApiError && errObj.biz
                ? errObj.biz
                : (BIZ_BY_STATUS[status] || 40001);
            return res.status(status).json({ code: biz, msg: errObj.message || '请求失败' });
        }
        // mysql 重复键 → 409 重复操作（业务码 40402）
        if (errObj && errObj.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ code: 40402, msg: '重复操作：该记录已存在' });
        }
        // 未知异常 → 业务码 50001，日志排查
        console.error('[error]', errObj);
        res.status(500).json({ code: 50001, msg: '服务器开小差了，请稍后重试' });
    };
}

module.exports = { not_found, error_handler };
