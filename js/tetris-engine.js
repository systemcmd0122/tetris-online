import { COLS, ROWS, COLORS, PIECES, CELL, KICK_DATA, KICK_DATA_I } from './constants.js';

export class TetrisGame {
  constructor(canvasId, holdId, nextId, soundFn) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.holdCanvas = holdId ? document.getElementById(holdId) : null;
    this.nextCanvas = nextId ? document.getElementById(nextId) : null;
    this.soundFn = soundFn || (() => {});
    this.reset();
  }

  reset() {
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    this.score = 0; this.lines = 0; this.level = 1; this.combo = 0; this.b2b = false;
    this.gameOver = false; this.bag = []; this.holdPiece = null; this.canHold = true;
    this.pendingGarbage = 0; this.results = [];
    this.spawn();
    this.lastDrop = performance.now();
    this.clearAnimTimer = 0; this.clearingRows = [];
    this.shakeTimer = 0;
  }

  getBag() { if (this.bag.length === 0) { this.bag = Object.keys(PIECES).sort(() => Math.random() - 0.5); } return this.bag.pop(); }

  spawn() {
    const name = this.getBag();
    this.cur = { name, x: Math.floor(COLS / 2) - 2, y: name === 'I' ? -1 : 0, rot: 0 };
    if (this.collide(0, 0)) this.gameOver = true;
    this.canHold = true;
  }

  collide(dx, dy, dr = 0) {
    const rots = PIECES[this.cur.name];
    const rotIdx = (this.cur.rot + dr + 4) % rots.length;
    const mat = rots[rotIdx];
    for (let r = 0; r < mat.length; r++) {
      for (let c = 0; c < mat[r].length; c++) {
        if (!mat[r][c]) continue;
        const nx = this.cur.x + c + dx, ny = this.cur.y + r + dy;
        if (nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && this.board[ny][nx])) return true;
      }
    }
    return false;
  }

  move(dx) { if (!this.collide(dx, 0)) { this.cur.x += dx; this.soundFn('move'); return true; } return false; }
  rotate(dr) {
    const prevRot = this.cur.rot;
    const nextRot = (this.cur.rot + dr + 4) % PIECES[this.cur.name].length;
    const table = this.cur.name === 'I' ? KICK_DATA_I : KICK_DATA;
    const kicks = table[`${prevRot}-${nextRot}`] || [[0,0]];

    for (let i = 0; i < kicks.length; i++) {
        const [kx, ky] = kicks[i];
        if (!this.collide(kx, -ky, dr)) {
            this.cur.x += kx;
            this.cur.y -= ky;
            this.cur.rot = nextRot;
            this.soundFn('rotate');
            return true;
        }
    }
    return false;
  }
  softDrop() { if (!this.collide(0, 1)) { this.cur.y++; this.score++; return true; } return false; }
  hardDrop() {
    let d = 0; while (!this.collide(0, 1)) { this.cur.y++; d++; }
    this.score += d * 2; this.lock(); this.soundFn('drop');
  }

  lock() {
    const rots = PIECES[this.cur.name];
    const mat = rots[this.cur.rot % rots.length];
    mat.forEach((row, r) => row.forEach((cell, c) => { if (cell) { const py = this.cur.y + r; if (py >= 0) this.board[py][this.cur.x + c] = this.cur.name; } }));
    this.clearLines();
    if (!this.gameOver) this.spawn();
  }

  hold() {
    if (!this.canHold) return;
    const old = this.holdPiece;
    this.holdPiece = this.cur.name;
    if (old) { this.cur = { name: old, x: Math.floor(COLS / 2) - 2, y: old === 'I' ? -1 : 0, rot: 0 }; }
    else { this.spawn(); }
    this.canHold = false; this.soundFn('rotate');
  }

  clearLines() {
    let cleared = 0;
    const rowsToClear = [];
    for (let r = ROWS - 1; r >= 0; r--) { if (this.board[r].every(c => c && c !== 'G')) { cleared++; rowsToClear.push(r); } }
    if (cleared > 0) {
      this.lines += cleared; this.level = Math.floor(this.lines / 10) + 1;
      this.combo++;
      let atk = [0, 0, 1, 2, 4][cleared];
      if (cleared === 4) { if (this.b2b) atk += 1; this.b2b = true; } else { this.b2b = false; }
      if (this.combo > 1) atk += Math.floor(this.combo / 2);

      const garbageResolved = Math.min(this.pendingGarbage, atk);
      this.pendingGarbage -= garbageResolved;
      const finalAtk = atk - garbageResolved;

      this.results.push({ cleared, garbageOut: finalAtk, actionLabel: cleared === 4 ? 'TETRIS!' : (this.combo > 1 ? `COMBO ${this.combo}` : '') });
      this.clearingRows = rowsToClear;
      this.clearAnimTimer = 250;
      this.soundFn('clear');
    } else {
      this.combo = 0;
      if (this.pendingGarbage > 0) {
        const n = Math.min(this.pendingGarbage, 8); this.pendingGarbage -= n;
        for (let i = 0; i < n; i++) {
          this.board.shift();
          const hole = Math.floor(Math.random() * COLS);
          this.board.push(Array.from({ length: COLS }, (_, j) => j === hole ? 0 : 'G'));
        }
        this.shakeTimer = 200;
      }
    }
  }

  update(ts) {
    if (this.gameOver || this.clearAnimTimer > 0) {
        if (this.clearAnimTimer > 0) {
            this.clearAnimTimer -= 16;
            if (this.clearAnimTimer <= 0) {
                this.clearingRows.sort((a,b)=>a-b).forEach(r => { this.board.splice(r, 1); this.board.unshift(Array(COLS).fill(0)); });
                this.clearingRows = [];
            }
        }
        return;
    }
    const speed = Math.max(100, 1000 - (this.level - 1) * 100);
    if (ts - this.lastDrop > speed) { this.softDrop(); this.lastDrop = ts; }
    if (this.shakeTimer > 0) this.shakeTimer -= 16;
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.board.forEach((row, r) => row.forEach((cell, c) => {
      if (!cell) return;
      if (this.clearingRows.includes(r)) {
          this.ctx.fillStyle = '#fff';
          this.ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
          return;
      }
      this.ctx.fillStyle = (cell === 'G' ? '#333' : COLORS[cell]);
      this.ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
    }));
    if (!this.gameOver && this.cur && PIECES[this.cur.name]) {
      const rots = PIECES[this.cur.name];
      const mat = rots[this.cur.rot % rots.length];
      mat.forEach((row, r) => row.forEach((cell, c) => {
        if (cell) {
          this.ctx.fillStyle = COLORS[this.cur.name];
          this.ctx.fillRect((this.cur.x + c) * CELL + 1, (this.cur.y + r) * CELL + 1, CELL - 2, CELL - 2);
        }
      }));
    }
    if (this.holdCanvas && this.holdPiece) this.drawPiece(this.holdCanvas, this.holdPiece);
    if (this.nextCanvas && this.bag.length > 0) this.drawPiece(this.nextCanvas, this.bag[this.bag.length-1]);
  }

  drawPiece(cv, name) {
    const ctx = cv.getContext('2d'); ctx.clearRect(0,0,cv.width,cv.height);
    const mat = PIECES[name][0];
    const sz = cv.width / 4;
    mat.forEach((row, r) => row.forEach((cell, c) => {
      if (cell) { ctx.fillStyle = COLORS[name]; ctx.fillRect(c * sz, r * sz, sz-1, sz-1); }
    }));
  }

  serialize() {
    return { board: this.board, cur: this.cur, score: this.score, lines: this.lines, gameOver: this.gameOver, clearAnimTimer: this.clearAnimTimer, clearingRows: this.clearingRows, shakeTimer: this.shakeTimer };
  }

  static drawOpponent(cv, d) {
    if (!cv || !d || !d.board) return;
    const ctx = cv.getContext('2d'); ctx.clearRect(0,0,cv.width,cv.height);
    d.board.forEach((row, r) => {
      if (!row) return;
      row.forEach((cell, c) => {
        if (!cell) return;
        if (d.clearingRows && d.clearingRows.includes(r)) { ctx.fillStyle = '#fff'; ctx.fillRect(c * (CELL/2), r * (CELL/2), CELL/2, CELL/2); return; }
        ctx.fillStyle = (cell === 'G' ? '#222' : (COLORS[cell] || '#888'));
        ctx.fillRect(c * (CELL/2), r * (CELL/2), CELL/2 - 1, CELL/2 - 1);
      });
    });
    if (d.cur && PIECES[d.cur.name] && !d.gameOver) {
        const rots = PIECES[d.cur.name];
        const rotIdx = (d.cur.rot || 0) % rots.length;
        const mat = rots[rotIdx];
        mat.forEach((row, r) => row.forEach((cell, c) => {
            if (cell) { ctx.fillStyle = COLORS[d.cur.name] || '#888'; ctx.fillRect((d.cur.x + c) * (CELL/2), (d.cur.y + r) * (CELL/2), CELL/2 - 1, CELL/2 - 1); }
        }));
    }
    if (d.gameOver) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,cv.width,cv.height); }
  }
}
