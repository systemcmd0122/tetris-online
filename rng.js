/**
 * rng.js - 決定論的乱数生成器 (PRNG)
 * Mulberry32 アルゴリズムを使用して、シード値に基づいた再現可能な乱数を提供します。
 */

export class RNG {
    /**
     * @param {number} seed - 初期シード値
     */
    constructor(seed = Date.now()) {
        this.seed = seed;
        this.state = seed;
    }

    /**
     * 0以上1未満の浮動小数点数を生成します。
     * @returns {number}
     */
    next() {
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /**
     * 指定された範囲内の整数を生成します [min, max]
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    /**
     * 配列を決定論的にシャッフルします (Fisher-Yates)
     * @param {Array} array
     * @returns {Array}
     */
    shuffle(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i);
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}
