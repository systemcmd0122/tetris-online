import {
  COLS, ROWS, CELL, COLORS, PIECES, NAMES, KICKS_JLSTZ, KICKS_I, ROT_NAMES,
  LINE_SCORES, TSPIN_SCORES, B2B_MULT, LOCK_DELAY, MAX_RESETS
} from './constants.js';
import { playSound } from './sound-engine.js';

export class Bag {
  constructor() { this.q = []; }
  _refill() {
    const b = [...NAMES];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    this.q.push(...b);
  }
  next() { if (this.q.length < 4) this._refill(); return this.q.shift(); }
  peek(n = 1) { while (this.q.length < n + 4) this._refill(); return this.q.slice(0, n); }
}

export function makePiece(name) { return { name, rot: 0, x: 3, y: -1 }; }

export class TetrisGame {
  constructor(cvsId, holdId, nextId) {
    this.cvs = document.getElementById(cvsId); this.ctx = this.cvs.getContext('2d');
    this.hCvs = holdId ? document.getElementById(holdId) : null; this.hCtx = this.hCvs ? this.hCvs.getContext('2d') : null;
    this.nCvs = nextId ? document.getElementById(nextId) : null; this.nCtx = this.nCvs ? this.nCvs.getContext('2d') : null;
    this.isWaitingNext = false; this.nextSpawnTs = 0;
    this.reset();
  }
  reset() {
    this.board = Array.from({ length: ROWS + 2 }, () => Array(COLS).fill(null));
    this.bag = new Bag(); this.current = makePiece(this.bag.next());
    this.heldPiece = null; this.canHold = true;
    this.score = 0; this.lines = 0; this.level = 1; this.combo = 0; this.b2b = false;
    this.gameOver = false; this.dropSpeed = 800; this.lastDropTs = 0;
    this.lockTimer = null; this.lockResets = 0; this.isOnGround = false;
    this.isWaitingNext = false; this.nextSpawnTs = 0;
    this.boardDirty = true;
    this.lastAction = null; this.pendingGarbage = 0;
    this.results = [];
  }
  _get(x, y) { if (x < 0 || x >= COLS || y < -2 || y >= ROWS) return y >= ROWS ? 'WALL' : null; return this.board[y + 2][x]; }
  _set(x, y, v) { if (y < -2 || y >= ROWS || x < 0 || x >= COLS) return; this.board[y + 2][x] = v; this.boardDirty = true; }
  matrix(p = this.current) { return PIECES[p.name][p.rot]; }
  cells(p = this.current) { const m = this.matrix(p), out = []; for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) if (m[r][c]) out.push([p.x + c, p.y + r]); return out; }
  valid(p, dx = 0, dy = 0, rot = null) {
    const m = rot !== null ? PIECES[p.name][rot] : this.matrix(p);
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
      if (!m[r][c]) continue;
      const nx = p.x + c + dx, ny = p.y + r + dy;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
      if (ny >= -2 && this._get(nx, ny)) return false;
    }
    return true;
  }
  rotate(dir = 1) {
    const from = this.current.rot, to = (from + (dir > 0 ? 1 : 3)) % 4, key = `${ROT_NAMES[from]}->${ROT_NAMES[to]}`;
    const kicks = this.current.name === 'I' ? KICKS_I[key] : KICKS_JLSTZ[key];
    if (!kicks) return false;
    for (const [kdx, kdy] of kicks) { if (this.valid(this.current, kdx, -kdy, to)) { this.current.x += kdx; this.current.y += -kdy; this.current.rot = to; this.lastAction = { type: 'rotate', dir, kick: kdx !== 0 || kdy !== 0 }; this._resetLock(); playSound('rotate'); return true; } }
    return false;
  }
  move(dx) { if (this.valid(this.current, dx)) { this.current.x += dx; this.lastAction = { type: 'move' }; this._resetLock(); playSound('move'); return true; } return false; }
  softDrop() { if (this.valid(this.current, 0, 1)) { this.current.y++; this.score++; this.lastAction = { type: 'move' }; this.isOnGround = false; this.lockTimer = null; return true; } return false; }
  hardDrop() { let d = 0; while (this.valid(this.current, 0, 1)) { this.current.y++; d++; } this.score += d * 2; this.lastAction = { type: 'hard' }; playSound('harddrop'); return this._lock(); }
  ghostY() { let g = this.current.y; while (this.valid(this.current, 0, g - this.current.y + 1)) g++; return g; }
  _resetLock() { if (this.isOnGround && this.lockResets < MAX_RESETS) { this.lockTimer = null; this.lockResets++; } }
  _isTSpin() { if (this.current.name !== 'T' || !this.lastAction || this.lastAction.type !== 'rotate') return false; const { x, y } = this.current; const corners = [[x, y], [x + 2, y], [x, y + 2], [x + 2, y + 2]]; const filled = corners.filter(([cx, cy]) => cy < 0 || cy >= ROWS || cx < 0 || cx >= COLS || !!this._get(cx, cy)); return filled.length >= 3; }
  _lock() {
    for (const [cx, cy] of this.cells()) { if (cy >= 0) this._set(cx, cy, this.current.name); else { this.gameOver = true; } }
    const tspin = this._isTSpin(), cleared = this._clearLines();
    let pts = 0, garbageOut = 0, actionLabel = '';
    const isSpecial = tspin || cleared === 4;
    if (tspin) { pts = TSPIN_SCORES[cleared] * this.level; const labels = ['T-SPIN!', 'T-SPIN SINGLE!', 'T-SPIN DOUBLE!', 'T-SPIN TRIPLE!']; actionLabel = labels[cleared] || 'T-SPIN!'; garbageOut = [0, 2, 4, 6][cleared] || 0; }
    else if (cleared > 0) { pts = LINE_SCORES[cleared] * this.level; const labels = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS!!']; actionLabel = labels[cleared]; garbageOut = [0, 0, 1, 2, 4][cleared] || 0; }
    if (isSpecial && cleared > 0) { if (this.b2b) { pts = Math.floor(pts * B2B_MULT); garbageOut += 1; actionLabel += '\nBACK-TO-BACK!'; } this.b2b = true; }
    else if (cleared > 0 && !tspin) { this.b2b = false; }
    if (cleared > 0) { this.combo++; if (this.combo > 1) { pts += 50 * (this.combo - 1) * this.level; garbageOut += Math.floor(this.combo / 2); if (!actionLabel) actionLabel = `COMBO x${this.combo}!`; else actionLabel += `\nCOMBO x${this.combo}!`; } } else { this.combo = 0; }
    this.score += pts;
    if (cleared > 0) { this.lines += cleared; this.level = Math.floor(this.lines / 10) + 1; this.dropSpeed = Math.max(50, 800 - (this.level - 1) * 70); if (cleared === 4) playSound('tetris'); else playSound('clear1'); } else { playSound('lock'); }
    if (this.pendingGarbage > 0) { const cancel = Math.min(garbageOut, this.pendingGarbage); garbageOut -= cancel; this.pendingGarbage -= cancel; if (this.pendingGarbage > 0) { this._addGarbage(this.pendingGarbage); this.pendingGarbage = 0; } }
    this.isWaitingNext = true; this.nextSpawnTs = performance.now() + 200;
    this.canHold = true; this.lockTimer = null; this.lockResets = 0; this.isOnGround = false; this.lastAction = null;
    const res = { cleared, garbageOut, actionLabel };
    this.results.push(res);
    return res;
  }
  _clearLines() { let n = 0; for (let r = ROWS - 1; r >= 0; r--) { if (this.board[r + 2].every(c => c !== null)) { this.board.splice(r + 2, 1); this.board.unshift(Array(COLS).fill(null)); n++; r++; this.boardDirty = true; } } return n; }
  _addGarbage(lines) { if (lines <= 0) return; const hole = Math.floor(Math.random() * COLS); for (let i = 0; i < lines; i++) { this.board.shift(); const row = Array(COLS).fill('G'); row[hole] = null; this.board.push(row); } this.boardDirty = true; }
  hold() {
    if (!this.canHold) return false;
    const name = this.current.name;
    if (this.heldPiece) { this.current = makePiece(this.heldPiece); }
    else { this.current = makePiece(this.bag.next()); }
    this.heldPiece = name; this.canHold = false; this.lockTimer = null; this.lockResets = 0; this.isOnGround = false;
    this.lastDropTs = performance.now();
    playSound('move');
    return true;
  }
  update(ts) {
    if (this.gameOver) return null;
    if (this.isWaitingNext) {
      if (ts >= this.nextSpawnTs) {
        this.isWaitingNext = false;
        this.current = makePiece(this.bag.next());
        while (!this.valid(this.current) && this.current.y > -4) this.current.y--;
        if (!this.valid(this.current)) this.gameOver = true;
      }
      return null;
    }
    const onGround = !this.valid(this.current, 0, 1);
    if (onGround) { if (!this.isOnGround) { this.isOnGround = true; this.lockTimer = ts; } if (ts - this.lockTimer >= LOCK_DELAY) { this.isOnGround = false; return this._lock(); } }
    else { this.isOnGround = false; this.lockTimer = null; if (ts - this.lastDropTs >= this.dropSpeed) { this.lastDropTs = ts; this.current.y++; } }
    return null;
  }
  serialize() {
    if (this.boardDirty || !this._cachedBoard) { this._cachedBoard = this.board.slice(2).map(row => row.map(c => c || '')); this.boardDirty = false; }
    return { board: this._cachedBoard, score: this.score, lines: this.lines, level: this.level, gameOver: this.gameOver, cur: { name: this.current.name, rot: this.current.rot, x: this.current.x, y: this.current.y } };
  }
  draw() {
    const ctx = this.ctx; ctx.clearRect(0, 0, this.cvs.width, this.cvs.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const cell = this.board[r + 2][c]; if (cell) this._drawCell(ctx, c, r, cell === 'G' ? '#888888' : COLORS[cell]); }
    if (!this.isWaitingNext) {
      const gy = this.ghostY();
      this.matrix().forEach((row, r) => row.forEach((cell, c) => { if (cell) { const py = gy + r; if (py >= 0) { ctx.fillStyle = COLORS.GHOST; ctx.fillRect(c * CELL + this.current.x * CELL + 1, py * CELL + 1, CELL - 2, CELL - 2); } } }));
      if (this.isOnGround && this.lockTimer !== null) { const pct = 1 - Math.min(1, (performance.now() - this.lockTimer) / LOCK_DELAY); const cells = this.cells(); const maxY = Math.max(...cells.map(c => c[1])); cells.filter(([, cy]) => cy === maxY && cy >= 0).forEach(([cx, cy]) => { ctx.fillStyle = `rgba(255,255,255,${0.4 * pct})`; ctx.fillRect(cx * CELL + 1, cy * CELL + CELL - 3, Math.floor((CELL - 2) * pct), 2); }); }
      this.matrix().forEach((row, r) => row.forEach((cell, c) => { if (cell) { const py = this.current.y + r; if (py >= 0) this._drawCell(ctx, this.current.x + c, py, COLORS[this.current.name]); } }));
    }
    if (this.gameOver) { ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(0, 0, this.cvs.width, this.cvs.height); ctx.fillStyle = '#ff0080'; ctx.font = 'bold 13px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText('GAME', this.cvs.width / 2, this.cvs.height / 2 - 14); ctx.fillText('OVER', this.cvs.width / 2, this.cvs.height / 2 + 10); }
    if (this.nCtx) this._drawMini(this.nCtx, makePiece(this.bag.peek(1)[0]));
    if (this.hCtx) { this.hCtx.clearRect(0, 0, 80, 80); if (this.heldPiece) this._drawMini(this.hCtx, makePiece(this.heldPiece), this.canHold ? 1.0 : 0.4); }
  }
  _drawCell(ctx, x, y, color) { ctx.fillStyle = color + 'dd'; ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, 3); ctx.fillRect(x * CELL + 1, y * CELL + 1, 3, CELL - 2); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x * CELL + 3, y * CELL + CELL - 3, CELL - 3, 2); ctx.fillRect(x * CELL + CELL - 3, y * CELL + 3, 2, CELL - 3); }
  _drawMini(ctx, piece, alpha = 1) { const s = 80, cs = 16; ctx.clearRect(0, 0, s, s); ctx.globalAlpha = alpha; const m = PIECES[piece.name][0]; const ox = Math.floor((4 - m[0].length) / 2), oy = Math.floor((4 - m.length) / 2); m.forEach((row, r) => row.forEach((cell, c) => { if (cell) { ctx.fillStyle = COLORS[piece.name] + 'dd'; ctx.fillRect((ox + c) * cs + 1, (oy + r) * cs + 1, cs - 2, cs - 2); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect((ox + c) * cs + 1, (oy + r) * cs + 1, cs - 2, 3); } })); ctx.globalAlpha = 1; }

  static drawOpponent(canvas, data) {
    if (!data || !data.board) return;
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
    data.board.forEach((row, r) => row.forEach((cell, c) => { if (!cell) return; const color = cell === 'G' ? '#888888' : (COLORS[cell] || '#888'); ctx.fillStyle = color + 'cc'; ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2); ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, 3); }));
    if (data.cur && PIECES[data.cur.name]) { const m = PIECES[data.cur.name][data.cur.rot || 0]; const color = COLORS[data.cur.name] || '#888'; m.forEach((row, r) => row.forEach((cell, c) => { if (cell) { const py = data.cur.y + r; if (py >= 0) { ctx.fillStyle = color + '99'; ctx.fillRect((data.cur.x + c) * CELL + 1, py * CELL + 1, CELL - 2, CELL - 2); } } })); }
    if (data.gameOver) { ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#ff0080'; ctx.font = 'bold 11px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2); }
  }
}
