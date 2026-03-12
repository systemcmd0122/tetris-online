import { PIECES, COLS, ROWS } from './constants.js';

export const BOT_NAMES = ['EasyBot', 'NormalBot', 'HardBot'];

export class BotController {
  constructor(game, difficulty) {
    this.game = game;
    this.difficulty = difficulty;
    this.lastAction = 0;
    this.targetX = 0;
    this.targetRot = 0;
    this.think();
  }

  think() {
    if (!this.game.cur) return;
    const name = this.game.cur.name;
    if (!PIECES[name]) return;
    const rots = PIECES[name].length;
    let bestScore = -Infinity;

    for (let r = 0; r < rots; r++) {
      for (let x = -2; x < COLS; x++) {
        const score = this.evaluate(x, r);
        if (score > bestScore) { bestScore = score; this.targetX = x; this.targetRot = r; }
      }
    }
    // Add noise based on difficulty
    if (Math.random() > [0.4, 0.7, 0.95][this.difficulty-1]) {
      this.targetX = Math.floor(Math.random() * COLS);
      this.targetRot = Math.floor(Math.random() * 4);
    }
  }

  evaluate(x, rot) {
    const rots = PIECES[this.game.cur.name];
    const mat = rots[rot % rots.length];
    let y = 0;
    while (!this.botCollide(x, y + 1, mat)) { y++; }
    if (y < 0) return -10000;

    // Simulate placing piece
    const tempBoard = this.game.board.map(row => [...row]);
    mat.forEach((row, r) => row.forEach((cell, c) => {
        if (cell) {
            const py = y + r;
            if (py >= 0 && py < ROWS) tempBoard[py][x + c] = 1;
        }
    }));

    // El-Tetris inspired heuristics
    let holes = 0;
    let aggregateHeight = 0;
    let bumpiness = 0;
    let completedLines = 0;

    const heights = new Array(COLS).fill(0);
    for (let c = 0; c < COLS; c++) {
        let h = 0;
        for (let r = 0; r < ROWS; r++) {
            if (tempBoard[r][c]) {
                h = ROWS - r;
                break;
            }
        }
        heights[c] = h;
        aggregateHeight += h;
    }

    for (let c = 0; c < COLS; c++) {
        let blockFound = false;
        for (let r = 0; r < ROWS; r++) {
            if (tempBoard[r][c]) blockFound = true;
            else if (blockFound) holes++;
        }
        if (c < COLS - 1) bumpiness += Math.abs(heights[c] - heights[c + 1]);
    }

    for (let r = 0; r < ROWS; r++) {
        if (tempBoard[r].every(cell => cell)) completedLines++;
    }

    // Weights (can be tuned)
    const a = -0.51, b = 0.76, c = -0.35, d = -0.18;
    return a * aggregateHeight + b * completedLines + c * holes + d * bumpiness;
  }

  botCollide(x, y, mat) {
    for (let r = 0; r < mat.length; r++) {
      for (let c = 0; c < mat[r].length; c++) {
        if (!mat[r][c]) continue;
        const nx = x + c, ny = y + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && this.game.board[ny][nx])) return true;
      }
    }
    return false;
  }

  tick(ts) {
    if (this.game.gameOver || !this.game.cur) return;
    const delay = [600, 300, 100][this.difficulty-1];
    if (ts - this.lastAction > delay) {
      if (this.game.cur.rot !== this.targetRot) { this.game.rotate(1); }
      else if (this.game.cur.x < this.targetX) { this.game.move(1); }
      else if (this.game.cur.x > this.targetX) { this.game.move(-1); }
      else { this.game.hardDrop(); this.think(); }
      this.lastAction = ts;
    }
  }

  drawVisualization() {}
}
