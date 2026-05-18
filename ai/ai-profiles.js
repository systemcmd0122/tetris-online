/**
 * ai-profiles.js - AI パーソナリティと進化 (Mutation) 定義
 */

export const AI_ARCHETYPES = {
    AGGRESSIVE: {
        id: 'AGGRESSIVE',
        name: 'AGGRESSIVE',
        baseWeights: { height: -0.5, holes: -0.8, bump: -0.2, clear: 2.0, tetris: 15.0 },
        thinkInterval: 4, // 4フレームごと
        color: '#ff0080',
        description: '攻撃的：火力と T-Spin を優先'
    },
    DEFENSIVE: {
        id: 'DEFENSIVE',
        name: 'DEFENSIVE',
        baseWeights: { height: -0.8, holes: -2.0, bump: -0.4, clear: 1.0, tetris: 5.0 },
        thinkInterval: 6,
        color: '#00ff88',
        description: '防御的：安定した構築と穴の少なさを優先'
    },
    CHAOTIC: {
        id: 'CHAOTIC',
        name: 'CHAOTIC',
        baseWeights: { height: -0.3, holes: -0.5, bump: -0.1, clear: 3.0, tetris: 8.0 },
        thinkInterval: 3,
        color: '#00f5ff',
        description: '混沌：高速だが高リスクな配置'
    },
    PERFECT: {
        id: 'PERFECT',
        name: 'PERFECT',
        baseWeights: { height: -0.6, holes: -2.5, bump: -0.5, clear: 1.5, tetris: 20.0 },
        thinkInterval: 2,
        color: '#cc00ff',
        description: '精密：理論上最適な配置を追求'
    },
    MACHINE_GOD: {
        id: 'MACHINE_GOD',
        name: 'MACHINE GOD',
        baseWeights: { height: -0.5, holes: -3.0, bump: -0.3, clear: 2.5, tetris: 30.0 },
        thinkInterval: 1,
        color: '#ffaa00',
        description: '機械神：非人間的な反応速度と火力'
    }
};

/**
 * AI のパーソナリティを進化 (変異) させる
 */
export function mutateProfile(profile, rate = 0.1) {
    const mutated = JSON.parse(JSON.stringify(profile));
    for (let key in mutated.baseWeights) {
        mutated.baseWeights[key] += (Math.random() * 2 - 1) * rate;
    }
    // thinkInterval も稀に変化
    if (Math.random() < 0.05) {
        mutated.thinkInterval = Math.max(1, mutated.thinkInterval + (Math.random() > 0.5 ? 1 : -1));
    }
    return mutated;
}
