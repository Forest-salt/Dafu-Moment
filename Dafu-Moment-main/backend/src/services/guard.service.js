/**
 * 机审管线 guard.service（v2.0 收敛版）：仅 DFA 敏感词分流
 * 分流：无命中 → 直接发布；level1 命中 → 替换后发布；level2/3 命中 → 转人工
 */
const { dfa } = require('../utils/dfa');

/**
 * 机审主入口（同步、不落库）
 * @param {Object} input - {content}
 * @returns {{status: number, reason: string, maskedContent: string}} status: 0 已发布 / 1 待人工
 */
function moderate(input) {
    const content = (input && input.content) || '';

    // DFA 敏感词：level1 替换后放行 / level2、3 转人工
    const dfaRes = dfa.scan(content);
    const masked = dfaRes.masked;
    const hits = dfaRes.hits || [];
    if (hits.some((h) => h.level >= 2)) {
        return {
            status: 1,
            reason: '包含待人工确认的敏感词，已转入人工审核',
            maskedContent: masked,
        };
    }
    return { status: 0, reason: '', maskedContent: masked };
}

module.exports = { moderate };
