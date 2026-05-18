/**
 * worker.js - TETRIS BATTLE AI & 計算用 Web Worker
 *
 * メインスレッドから AI 思考や重い計算を分離し、
 * ゲームのパフォーマンス (FPS) を安定させます。
 */

import { PIECES, COLS, ROWS } from './engine.js';


self.onmessage = function(e) {
    const { type, pieceId } = e.data;

    switch (type) {
        case 'THINK':
            const result = findBestMove(e.data);
            self.postMessage({ type: 'MOVE', action: result, pieceId: pieceId });
            break;
        case 'PING':
            self.postMessage({ type: 'PONG' });
            break;
    }
};


/**
 * 簡易的な決定論的乱数 (Mulberry32)
 */
function nextRandom(state) {
    let t = state += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return [((t ^ (t >>> 14)) >>> 0) / 4294967296, state];
}

/**
 * AI 思考ロジック (El-Tetris ヘリスティクス)
 */


function findBestMove(data) {
    const { board, current, next, hold, canHold, difficulty, noise = 0, seed = 0 } = data;
    const WEIGHTS = { height: -0.51, holes: -0.40, bump: -0.18 };
    const NOISE_VAL = [0.4, 0.15, 0.05, 0][(difficulty || 2) - 1] * 10;
    let rngState = seed;

    const evaluate = (pName, nName) => {
        let bestScore = -Infinity;
        let bestRot = 0;
        let bestX = 3;

        for (let r = 0; r < 4; r++) {
            for (let x = -2; x < COLS + 2; x++) {
                const sim = simulate(board, pName, r, x);
                if (!sim) continue;
                let score = calculateHeuristic(sim.nb, WEIGHTS, sim.cleared);
                let rand;
                [rand, rngState] = nextRandom(rngState);
                score += (rand * 2 - 1) * NOISE_VAL;
                if (score > bestScore) { bestScore = score; bestRot = r; bestX = x; }
            }
        }
        return { score: bestScore, rot: bestRot, x: bestX };
    };

    const currentMove = evaluate(current, next);
    let best = { ...currentMove, isHold: false };

    if (canHold) {
        const hName = hold || next;
        const holdMove = evaluate(hName, hold ? next : (data.nextNext || next));
        if (holdMove.score > currentMove.score) {
            best = { ...holdMove, isHold: true };
        }
    }

    if (best.isHold) return ['HOLD'];
    const actions = [];
    for(let i=0; i<best.rot; i++) actions.push('ROT_R');
    const dx = best.x - 3;
    for(let i=0; i<Math.abs(dx); i++) actions.push(dx > 0 ? 'MOVE_R' : 'MOVE_L');
    actions.push('HARD_DROP');
    return actions;
}



/**
 * 指定されたミノを特定の位置に落とした後の盤面をシミュレート
 */


function simulate(board, pName, rot, sx) {
    const m = PIECES[pName][rot];
    if (!m) return null;

    for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
            if (m[r][c] && (sx + c < 0 || sx + c >= COLS)) return null;
        }
    }

    let py = -2;
    while (true) {
        let canGoDown = true;
        for (let r = 0; r < m.length; r++) {
            for (let c = 0; c < m[r].length; c++) {
                if (!m[r][c]) continue;
                const nx = sx + c;
                const ny = py + r + 1;
                if (ny >= ROWS || (ny >= -2 && board[ny + 2] && board[ny + 2][nx])) {
                    canGoDown = false;
                    break;
                }
            }
            if (!canGoDown) break;
        }
        if (canGoDown) py++;
        else break;
    }

    if (py < -2) return null;

    const nb = board.map(row => [...row]);
    for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
            if (m[r][c]) {
                const ny = py + r;
                if (ny < -2 || ny >= ROWS) return null;
                nb[ny + 2][sx + c] = pName;
            }
        }
    }

    const filtered = nb.filter(row => !row.every(cell => cell !== null));
    const cleared = nb.length - filtered.length;
    while (filtered.length < ROWS + 2) {
        filtered.unshift(Array(COLS).fill(null));
    }

    return { nb: filtered, cleared };
}



/**
 * 盤面の評価値を計算
 */

function calculateHeuristic(board, weights, cleared = 0) {
    const gameBoard = board.slice(2);
    const heights = new Array(COLS).fill(0);
    let holes = 0;
    let bumpiness = 0;

    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            if (gameBoard[r][c]) {
                heights[c] = ROWS - r;
                break;
            }
        }
    }

    for (let c = 0; c < COLS; c++) {
        let found = false;
        for (let r = 0; r < ROWS; r++) {
            if (gameBoard[r][c]) found = true;
            else if (found) holes++;
        }
    }

    for (let c = 0; c < COLS - 1; c++) {
        bumpiness += Math.abs(heights[c] - heights[c + 1]);
    }

    const aggHeight = heights.reduce((a, b) => a + b, 0);

    // 基本評価
    let score = (aggHeight * weights.height) +
                (holes * weights.holes) +
                (bumpiness * weights.bump);

    // 消去ボーナス
    if (cleared === 4) score += 100;
    else if (cleared > 0) score += cleared * 20;

    return score;
}

        }
    }

    for (let c = 0; c < COLS; c++) {
        let found = false;
        for (let r = 0; r < ROWS; r++) {
            if (gameBoard[r][c]) found = true;
            else if (found) holes++;
        }
    }

    for (let c = 0; c < COLS - 1; c++) {
        bumpiness += Math.abs(heights[c] - heights[c + 1]);
    }

    const aggHeight = heights.reduce((a, b) => a + b, 0);

    return (aggHeight * weights.height) +
           (holes * weights.holes) +
           (bumpiness * weights.bump);
}
