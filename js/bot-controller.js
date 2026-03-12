import { PIECES, COLS, ROWS, CELL } from './constants.js';

export const BOT_NAMES = ['BOT-EASY', 'BOT-NORMAL', 'BOT-HARD'];
export let BOT_DELAYS = [250, 120, 40];    // ms between actions
export let BOT_NOISE = [0.12, 0.04, 0.0];  // evaluation noise (mistake rate)

export function updateBotConfig(delays, noise) {
  if (delays) BOT_DELAYS = delays;
  if (noise) BOT_NOISE = noise;
}

export class BotController {
  constructor(game, difficulty = 2) {
    this.game = game;
    this.difficulty = difficulty;
    this.actionDelay = BOT_DELAYS[difficulty - 1];
    this.noise = BOT_NOISE[difficulty - 1];
    this.lastActionTs = 0;
    this.moveQueue = [];
    this.lastEval = null;
  }

  // Simulate piece placement and score the resulting board
  _simulate(boardRows, pieceName, rot, startX) {
    const m = PIECES[pieceName][rot];
    if (!m) return null;
    // Bounds check
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
      if (m[r][c] && (startX + c < 0 || startX + c >= COLS)) return null;
    }
    // Drop piece
    let py = -2;
    let stopped = false;
    while (!stopped) {
      py++;
      for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const ny = py + r; const nx = startX + c;
        if (ny >= ROWS) { py--; stopped = true; break; }
        if (ny >= 0 && boardRows[ny][nx]) { py--; stopped = true; break; }
      }
      if (py > ROWS) return null; // sanity
    }
    // Place
    const nb = boardRows.map(r => [...r]);
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
      if (m[r][c]) { const ny = py + r; const nx = startX + c; if (ny < 0 || ny >= ROWS) return null; nb[ny][nx] = pieceName; }
    }
    // Clear lines
    let cleared = 0;
    const filt = nb.filter(row => !row.every(c => c !== null));
    cleared = ROWS - filt.length;
    while (filt.length < ROWS) filt.unshift(new Array(COLS).fill(null));
    // Evaluate
    const heights = new Array(COLS).fill(0);
    for (let col = 0; col < COLS; col++) for (let row = 0; row < ROWS; row++) { if (filt[row][col]) { heights[col] = ROWS - row; break; } }
    const aH = heights.reduce((a, b) => a + b, 0);
    let holes = 0;
    for (let col = 0; col < COLS; col++) { let found = false; for (let row = 0; row < ROWS; row++) { if (filt[row][col]) found = true; else if (found) holes++; } }
    let bump = 0;
    for (let col = 0; col < COLS - 1; col++) bump += Math.abs(heights[col] - heights[col + 1]);
    // Enhanced weight for cleared lines to encourage bot to send garbage (especially Tetris)
    const clearedWeight = cleared === 4 ? 12.0 : (cleared * 1.5);
    const score = -0.51 * aH + clearedWeight - 0.40 * holes - 0.20 * bump;
    return { score, aH, cleared, holes, bump, clearedWeight, nb: filt };
  }

  findBestMove() {
    const board = this.game.board.slice(2).map(r => r.map(c => c || null));
    const bag = this.game.bag;
    const canHold = this.game.canHold;

    const evaluate = (pName, nName, isHold) => {
      let bestS = -Infinity, bestR = 0, bestX = 3, bestRes = null;
      for (let r = 0; r < 4; r++) {
        for (let x = -2; x < COLS + 2; x++) {
          const res = this._simulate(board, pName, r, x);
          if (!res) continue;
          let totalS = res.score;
          // Look-ahead
          let bestNext = -Infinity;
          for (let nr = 0; nr < 4; nr++) {
            for (let nx = -2; nx < COLS + 2; nx++) {
              const nres = this._simulate(res.nb, nName, nr, nx);
              if (nres && nres.score > bestNext) bestNext = nres.score;
            }
          }
          if (bestNext !== -Infinity) totalS += bestNext;
          totalS += (Math.random() * 2 - 1) * this.noise * 4;
          if (totalS > bestS) { bestS = totalS; bestR = r; bestX = x; bestRes = res; }
        }
      }
      return { score: bestS, rot: bestR, x: bestX, res: bestRes, isHold };
    };

    const curEval = evaluate(this.game.current.name, bag.peek(1)[0], false);
    let bestEval = curEval;

    if (canHold) {
      let hName, nName;
      if (this.game.heldPiece) { hName = this.game.heldPiece; nName = bag.peek(1)[0]; }
      else { hName = bag.peek(1)[0]; nName = bag.peek(2)[1]; }
      const holdEval = evaluate(hName, nName, true);
      if (holdEval.score > curEval.score) bestEval = holdEval;
    }

    this.lastEval = { x: bestEval.x, rot: bestEval.rot, score: bestEval.score, details: bestEval.res, hold: bestEval.isHold };
    return this.lastEval;
  }

  planMoves(targetRot, targetX) {
    const moves = [];
    const curRot = this.game.current.rot, curX = this.game.current.x;
    const rd = ((targetRot - curRot) + 4) % 4;
    if (rd === 1) moves.push('rr');
    else if (rd === 2) { moves.push('rr'); moves.push('rr'); }
    else if (rd === 3) moves.push('rl');
    const dx = targetX - curX, dir = dx > 0 ? 'mr' : 'ml';
    for (let i = 0; i < Math.abs(dx); i++) moves.push(dir);
    moves.push('hd');
    return moves;
  }

  tick(ts) {
    if (!this.game || this.game.gameOver) return;
    if (this.game.isWaitingNext) { this.moveQueue = []; return; }
    if (ts - this.lastActionTs < this.actionDelay) return;
    this.lastActionTs = ts;
    if (this.moveQueue.length === 0) {
      const b = this.findBestMove();
      if (b.hold) { this.moveQueue = ['hold']; }
      else { this.moveQueue = this.planMoves(b.rot, b.x); }
    }
    const action = this.moveQueue.shift();
    if (!action) return;
    switch (action) {
      case 'rr': this.game.rotate(1); break;
      case 'rl': this.game.rotate(-1); break;
      case 'mr': this.game.move(1); break;
      case 'ml': this.game.move(-1); break;
      case 'hd': this.game.hardDrop(); this.moveQueue = []; break;
      case 'hold': this.game.hold(); this.moveQueue = []; break;
    }
  }

  drawVisualization() {
    if (!this.lastEval || !this.lastEval.details) return;
    const ctx = this.game.ctx;
    const ev = this.lastEval;
    // Draw target ghost
    const m = PIECES[this.game.current.name][ev.rot];
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    // Find landing Y for target
    let ty = -2;
    while (this.game.valid({ name: this.game.current.name, rot: ev.rot, x: ev.x, y: ty + 1 })) ty++;
    m.forEach((row, r) => row.forEach((cell, c) => {
      if (cell) {
        const py = ty + r;
        if (py >= 0) ctx.fillRect((ev.x + c) * CELL + 2, py * CELL + 2, CELL - 4, CELL - 4);
      }
    }));
    ctx.globalAlpha = 1;

    // Draw heuristics
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(5, 5, 110, 75);
    ctx.strokeStyle = this.difficulty === 3 ? '#ff3355' : (this.difficulty === 2 ? '#ffaa00' : '#aaff00');
    ctx.lineWidth = 1;
    ctx.strokeRect(5, 5, 110, 75);
    ctx.fillStyle = '#fff';
    ctx.font = '7px monospace';
    const d = ev.details;
    ctx.fillText(`SCORE: ${ev.score.toFixed(1)}`, 10, 15);
    ctx.fillText(`HEIGHT: ${d.aH}`, 10, 25);
    ctx.fillText(`HOLES: ${d.holes}`, 10, 35);
    ctx.fillText(`BUMP: ${d.bump}`, 10, 45);
    ctx.fillText(`CLEAR: ${d.cleared}`, 10, 55);
    ctx.fillText(`C_WGT: ${d.clearedWeight.toFixed(1)}`, 10, 65);
    ctx.fillText(`QUEUE: ${this.moveQueue.length}`, 10, 75);
  }
}
