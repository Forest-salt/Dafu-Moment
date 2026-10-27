/**
 * 统一日志：时间戳 + 级别 + 模块前缀 + 级别开关
 * 设计依据：§3.9（日志：模块前缀 + 分级）
 */
const LEVEL = { debug: 10, info: 20, warn: 30, error: 40 };
const level_name = (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug')).toLowerCase();
const min_level = LEVEL[level_name] ?? 20;

/**
 * 输出一行日志
 * @param {string} level 日志级别
 * @param {string} tag 模块前缀
 * @param {Array<*>} args 日志参数
 * @returns {void}
 */
function emit(level, tag, args) {
    if (LEVEL[level] < min_level) return;
    const body = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    const line = `[${new Date().toISOString()}] [${level}] ${tag} ${body}`;
    (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}

/**
 * 取一个带模块前缀的 logger
 * @param {string} tag 模块前缀，如 '[boot]'、'[ai]'
 * @returns {{debug:Function,info:Function,warn:Function,error:Function}}
 */
function of(tag) {
    return {
        debug: (...args) => emit('debug', tag, args),
        info: (...args) => emit('info', tag, args),
        warn: (...args) => emit('warn', tag, args),
        error: (...args) => emit('error', tag, args),
    };
}

module.exports = { of, log: of('[app]') };
