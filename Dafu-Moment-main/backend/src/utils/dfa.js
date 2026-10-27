/**
 * DFA 敏感词匹配（机审第一道关）
 * 词库来源 banned_word 表：level 1 替换 / 2 进人工 / 3 拦截
 */
const { of } = require('./logger');

const log = of('[dfa]');

class Dfa {
    constructor() {
        this.root = {}; // Trie 根节点
    }

    /**
     * 重建词库（管理员维护敏感词后调用）
     * @param {Array<{word: string, level: number}>} words - 词库
     */
    rebuild(words) {
        this.root = {};
        for (const { word, level } of words) {
            if (!word) continue;
            let node = this.root;
            for (const ch of word.toLowerCase()) {
                if (!node[ch]) node[ch] = {};
                node = node[ch];
            }
            node.__end__ = { level, word };
        }
        log.info(`[dfa] 词库重建完成，共 ${words.length} 词`);
    }

    /**
     * 扫描文本：返回命中词列表与打码后文本
     * @param {string} text - 待检文本
     * @returns {{hits: Array<{word: string, level: number}>, masked: string, maxLevel: number}}
     */
    scan(text) {
        const hits = [];
        let masked = text;
        let maxLevel = 0;
        if (!text || Object.keys(this.root).length === 0) {
            return { hits, masked, maxLevel };
        }
        const lower = text.toLowerCase();
        for (let i = 0; i < lower.length; i++) {
            let node = this.root;
            let j = i;
            // 从 i 开始的最长匹配
            let lastHit = null;
            while (j < lower.length && node[lower[j]]) {
                node = node[lower[j]];
                j++;
                if (node.__end__) lastHit = { ...node.__end__, start: i, end: j };
            }
            if (lastHit) {
                hits.push({ word: lastHit.word, level: lastHit.level });
                maxLevel = Math.max(maxLevel, lastHit.level);
                masked = masked.slice(0, lastHit.start) + '*'.repeat(lastHit.end - lastHit.start) + masked.slice(lastHit.end);
                i = lastHit.end - 1;
            }
        }
        return { hits, masked, maxLevel };
    }
}

// 全局单例（jobs/管理员接口通过 rebuild 刷新）
const dfa = new Dfa();

/**
 * 从 DB 加载词库并重建
 * @param {Function} query_fn - 查询函数
 * @returns {Promise<void>}
 */
async function load_dfa_from_db(query_fn) {
    const words = await query_fn('SELECT word, level FROM banned_word');
    dfa.rebuild(words);
}

module.exports = { dfa, load_dfa_from_db };
