import { PIECES, COLS, ROWS } from './tetris-engine.js';

export const BOT_DELAYS = [750, 400, 80];
export const BOT_NOISE = [0.4, 0.15, 0.0];

export class BotController {
    constructor(game, difficulty = 2) {
        this.game = game; this.difficulty = difficulty;
        this.actionDelay = BOT_DELAYS[difficulty - 1];
        this.noise = BOT_NOISE[difficulty - 1];
        this.lastActionTs = 0; this.moveQueue = [];
    }
    _sim(board, pName, rot, sx) {
        const m = PIECES[pName][rot]; if (!m) return null;
        for (let r = 0; r < m.length; r++)for (let c = 0; c < m[r].length; c++) { if (m[r][c] && (sx + c < 0 || sx + c >= COLS)) return null; }
        let py = -2;
        dropLoop: for (; ;) { py++; if (py > ROWS) return null; for (let r = 0; r < m.length; r++) { for (let c = 0; c < m[r].length; c++) { if (!m[r][c]) continue; const ny = py + r, nx = sx + c; if (ny >= ROWS || (ny >= 0 && board[ny][nx])) { py--; break dropLoop; } } } }
        const nb = board.map(r => [...r]);
        for (let r = 0; r < m.length; r++)for (let c = 0; c < m[r].length; c++) { if (m[r][c]) { const ny = py + r, nx = sx + c; if (ny < 0 || ny >= ROWS) return null; nb[ny][nx] = pName; } }
        const filt = nb.filter(row => !row.every(c => c !== null)); const cleared = ROWS - filt.length; while (filt.length < ROWS) filt.unshift(new Array(COLS).fill(null));
        const heights = new Array(COLS).fill(0); for (let col = 0; col < COLS; col++)for (let row = 0; row < ROWS; row++) { if (filt[row][col]) { heights[col] = ROWS - row; break; } }
        const aH = heights.reduce((a, b) => a + b, 0); let holes = 0; for (let col = 0; col < COLS; col++) { let found = false; for (let row = 0; row < ROWS; row++) { if (filt[row][col]) found = true; else if (found) holes++; } }
        let bump = 0; for (let col = 0; col < COLS - 1; col++)bump += Math.abs(heights[col] - heights[col + 1]);
        return { score: -0.51 * aH + (cleared === 4 ? 12.0 : cleared * 1.5) - 0.40 * holes - 0.20 * bump, nb: filt };
    }
    findBest() {
        const board = this.game.board.slice(2).map(r => r.map(c => c || null));
        const bag = this.game.bag;
        const evaluate = (pName, nName) => {
            let bestS = -Infinity, bestR = 0, bestX = 3;
            for (let r = 0; r < 4; r++)for (let x = -2; x < COLS + 2; x++) {
                const res = this._sim(board, pName, r, x); if (!res) continue;
                let ts = res.score; let bN = -Infinity;
                for (let nr = 0; nr < 4; nr++)for (let nx = -2; nx < COLS + 2; nx++) { const nr2 = this._sim(res.nb, nName, nr, nx); if (nr2 && nr2.score > bN) bN = nr2.score; }
                if (bN !== -Infinity) ts += bN; ts += (Math.random() * 2 - 1) * this.noise * 4;
                if (ts > bestS) { bestS = ts; bestR = r; bestX = x; }
            }
            return { score: bestS, rot: bestR, x: bestX };
        };
        const curEval = evaluate(this.game.current.name, bag.peek(1)[0]);
        let best = { ...curEval, isHold: false };
        if (this.game.canHold) {
            const hName = this.game.held || bag.peek(1)[0];
            const nName = this.game.held ? bag.peek(1)[0] : bag.peek(2)[1];
            const hEval = evaluate(hName, nName);
            if (hEval.score > curEval.score) best = { ...hEval, isHold: true };
        }
        return best;
    }
    planMoves(targetRot, targetX) {
        const moves = []; const rd = ((targetRot - this.game.current.rot) + 4) % 4;
        if (rd === 1) moves.push('rr'); else if (rd === 2) { moves.push('rr'); moves.push('rr'); } else if (rd === 3) moves.push('rl');
        const dx = targetX - this.game.current.x, dir = dx > 0 ? 'mr' : 'ml';
        for (let i = 0; i < Math.abs(dx); i++)moves.push(dir);
        moves.push('hd'); return moves;
    }
    tick(ts) {
        if (!this.game || this.game.over) return;
        if (this.game.waiting) { this.moveQueue = []; return; }
        if (ts - this.lastActionTs < this.actionDelay) return;
        this.lastActionTs = ts;
        if (!this.moveQueue.length) { const b = this.findBest(); this.moveQueue = b.isHold ? ['hold'] : this.planMoves(b.rot, b.x); }
        const a = this.moveQueue.shift(); if (!a) return;
        if (a === 'rr') this.game.rotate(1); else if (a === 'rl') this.game.rotate(-1);
        else if (a === 'mr') this.game.move(1); else if (a === 'ml') this.game.move(-1);
        else if (a === 'hd') { this.game.hardDrop(); this.moveQueue = []; }
        else if (a === 'hold') { this.game.hold(); this.moveQueue = []; }
    }
}
