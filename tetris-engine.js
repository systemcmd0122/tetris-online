export const COLORS = {
  I: '#00f5ff',
  O: '#ffff00',
  T: '#cc00ff',
  S: '#aaff00',
  Z: '#ff0040',
  J: '#0066ff',
  L: '#ff8800',
  G: '#888888',
  GHOST: 'rgba(255,255,255,0.10)'
};

export const PIECES = {
  I: [[[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]], [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]], [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]]],
  O: [[[1, 1], [1, 1]], [[1, 1], [1, 1]], [[1, 1], [1, 1]], [[1, 1], [1, 1]]],
  T: [[[0, 1, 0], [1, 1, 1], [0, 0, 0]], [[0, 1, 0], [0, 1, 1], [0, 1, 0]], [[0, 0, 0], [1, 1, 1], [0, 1, 0]], [[0, 1, 0], [1, 1, 0], [0, 1, 0]]],
  S: [[[0, 1, 1], [1, 1, 0], [0, 0, 0]], [[0, 1, 0], [0, 1, 1], [0, 0, 1]], [[0, 0, 0], [0, 1, 1], [1, 1, 0]], [[1, 0, 0], [1, 1, 0], [0, 1, 0]]],
  Z: [[[1, 1, 0], [0, 1, 1], [0, 0, 0]], [[0, 0, 1], [0, 1, 1], [0, 1, 0]], [[0, 0, 0], [1, 1, 0], [0, 1, 1]], [[0, 1, 0], [1, 1, 0], [1, 0, 0]]],
  J: [[[1, 0, 0], [1, 1, 1], [0, 0, 0]], [[0, 1, 1], [0, 1, 0], [0, 1, 0]], [[0, 0, 0], [1, 1, 1], [0, 0, 1]], [[0, 1, 0], [0, 1, 0], [1, 1, 0]]],
  L: [[[0, 0, 1], [1, 1, 1], [0, 0, 0]], [[0, 1, 0], [0, 1, 0], [0, 1, 1]], [[0, 0, 0], [1, 1, 1], [1, 0, 0]], [[1, 1, 0], [0, 1, 0], [0, 1, 0]]]
};

const NAMES = Object.keys(PIECES);

const KICKS_JLSTZ = {
  '0->R': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], 'R->0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  'R->2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], '2->R': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2->L': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], 'L->2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  'L->0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], '0->L': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
};
const KICKS_I = {
  '0->R': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], 'R->0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  'R->2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], '2->R': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2->L': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], 'L->2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  'L->0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], '0->L': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
};
const ROT_NAMES = ['0', 'R', '2', 'L'];

export class Bag {
  constructor() { this.q = []; }
  _refill() { const b = [...NAMES]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[b[i], b[j]] = [b[j], b[i]]; } this.q.push(...b); }
  next() { if (this.q.length < 4) this._refill(); return this.q.shift(); }
  peek(n = 1) { while (this.q.length < n + 4) this._refill(); return this.q.slice(0, n); }
}

export function makePiece(name) { return { name, rot: 0, x: 3, y: -1 }; }

export class TetrisGame {
  constructor(cvsId, holdId, nextId, config, callbacks = {}) {
    this.cvs = document.getElementById(cvsId);
    this.ctx = this.cvs ? this.cvs.getContext('2d') : null;
    this.hCvs = holdId ? document.getElementById(holdId) : null;
    this.hCtx = this.hCvs ? this.hCvs.getContext('2d') : null;
    this.nCvs = nextId ? document.getElementById(nextId) : null;
    this.nCtx = this.nCvs ? this.nCvs.getContext('2d') : null;
    this.config = config;
    this.callbacks = callbacks; // onSound, onUIUpdate
    this.isWaitingNext = false;
    this.nextSpawnTs = 0;
    this.reset();
  }

  reset() {
    const { ROWS, COLS } = this.config;
    this.board = Array.from({ length: ROWS + 2 }, () => Array(COLS).fill(null));
    this.bag = new Bag();
    this.current = makePiece(this.bag.next());
    this.heldPiece = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.combo = 0;
    this.b2b = false;
    this.gameOver = false;
    this.dropSpeed = 800;
    this.lastDropTs = 0;
    this.lockTimer = null;
    this.lockResets = 0;
    this.isOnGround = false;
    this.isWaitingNext = false;
    this.nextSpawnTs = 0;
    this.boardDirty = true;
    this.lastAction = null;
    this.pendingGarbage = 0;
    this.results = [];
  }

  _get(x, y) {
    const { COLS, ROWS } = this.config;
    if (x < 0 || x >= COLS || y < -2 || y >= ROWS) return y >= ROWS ? 'WALL' : null;
    return this.board[y + 2][x];
  }

  _set(x, y, v) {
    const { COLS, ROWS } = this.config;
    if (y < -2 || y >= ROWS || x < 0 || x >= COLS) return;
    this.board[y + 2][x] = v;
    this.boardDirty = true;
  }

  matrix(p = this.current) { return PIECES[p.name][p.rot]; }

  cells(p = this.current) {
    const m = this.matrix(p), out = [];
    for (let r = 0; r < m.length; r++)
      for (let c = 0; c < m[r].length; c++)
        if (m[r][c]) out.push([p.x + c, p.y + r]);
    return out;
  }

  valid(p, dx = 0, dy = 0, rot = null) {
    const { COLS, ROWS } = this.config;
    const m = rot !== null ? PIECES[p.name][rot] : this.matrix(p);
    for (let r = 0; r < m.length; r++)
      for (let c = 0; c < m[r].length; c++) {
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
    for (const [kdx, kdy] of kicks) {
      if (this.valid(this.current, kdx, -kdy, to)) {
        this.current.x += kdx;
        this.current.y += -kdy;
        this.current.rot = to;
        this.lastAction = { type: 'rotate', dir, kick: kdx !== 0 || kdy !== 0 };
        this._resetLock();
        this.callbacks.onSound?.('rotate');
        return true;
      }
    }
    return false;
  }

  move(dx) {
    if (this.valid(this.current, dx)) {
      this.current.x += dx;
      this.lastAction = { type: 'move' };
      this._resetLock();
      this.callbacks.onSound?.('move');
      return true;
    }
    return false;
  }

  softDrop() {
    if (this.valid(this.current, 0, 1)) {
      this.current.y++;
      this.score++;
      this.lastAction = { type: 'move' };
      this.isOnGround = false;
      this.lockTimer = null;
      return true;
    }
    return false;
  }

  hardDrop() {
    let d = 0;
    while (this.valid(this.current, 0, 1)) {
      this.current.y++;
      d++;
    }
    this.score += d * 2;
    this.lastAction = { type: 'hard' };
    this.callbacks.onSound?.('harddrop');
    return this._lock();
  }

  ghostY() {
    let g = this.current.y;
    while (this.valid(this.current, 0, g - this.current.y + 1)) g++;
    return g;
  }

  _resetLock() {
    if (this.isOnGround && this.lockResets < this.config.MAX_RESETS) {
      this.lockTimer = null;
      this.lockResets++;
    }
  }

  _isTSpin() {
    const { COLS, ROWS } = this.config;
    if (this.current.name !== 'T' || !this.lastAction || this.lastAction.type !== 'rotate') return false;
    const { x, y } = this.current;
    const corners = [[x, y], [x + 2, y], [x, y + 2], [x + 2, y + 2]];
    const filled = corners.filter(([cx, cy]) => cy < 0 || cy >= ROWS || cx < 0 || cx >= COLS || !!this._get(cx, cy));
    return filled.length >= 3;
  }

  _lock() {
    const { ROWS, COLS, TSPIN_SCORES, LINE_SCORES, B2B_MULTIPLIER, ENTRY_DELAY } = this.config;
    for (const [cx, cy] of this.cells()) {
      if (cy >= 0) this._set(cx, cy, this.current.name);
      else { this.gameOver = true; }
    }
    const tspin = this._isTSpin(), cleared = this._clearLines();
    let pts = 0, garbageOut = 0, actionLabel = '';
    const isSpecial = tspin || cleared === 4;
    if (tspin) {
      pts = TSPIN_SCORES[cleared] * this.level;
      const labels = ['T-SPIN!', 'T-SPIN SINGLE!', 'T-SPIN DOUBLE!', 'T-SPIN TRIPLE!'];
      actionLabel = labels[cleared] || 'T-SPIN!';
      garbageOut = [0, 2, 4, 6][cleared] || 0;
    }
    else if (cleared > 0) {
      pts = LINE_SCORES[cleared] * this.level;
      const labels = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS!!'];
      actionLabel = labels[cleared];
      garbageOut = [0, 0, 1, 2, 4][cleared] || 0;
    }
    if (isSpecial && cleared > 0) {
      if (this.b2b) {
        pts = Math.floor(pts * B2B_MULTIPLIER);
        garbageOut += 1;
        actionLabel += '\nBACK-TO-BACK!';
      }
      this.b2b = true;
    }
    else if (cleared > 0 && !tspin) { this.b2b = false; }

    if (cleared > 0) {
      this.combo++;
      if (this.combo > 1) {
        pts += 50 * (this.combo - 1) * this.level;
        garbageOut += Math.floor(this.combo / 2);
        if (!actionLabel) actionLabel = `COMBO x${this.combo}!`;
        else actionLabel += `\nCOMBO x${this.combo}!`;
      }
    } else { this.combo = 0; }

    this.score += pts;
    if (cleared > 0) {
      this.lines += cleared;
      const oldLevel = this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      if (this.level > oldLevel) {
        this.callbacks.onLevelUp?.(this.level);
      }
      this.dropSpeed = Math.max(50, 800 - (this.level - 1) * 70);
      if (cleared === 4) this.callbacks.onSound?.('tetris');
      else this.callbacks.onSound?.('clear1');
    } else {
      this.callbacks.onSound?.('lock');
    }

    if (this.pendingGarbage > 0) {
      const cancel = Math.min(garbageOut, this.pendingGarbage);
      garbageOut -= cancel;
      this.pendingGarbage -= cancel;
      if (this.pendingGarbage > 0) {
        this._addGarbage(this.pendingGarbage);
        this.pendingGarbage = 0;
      }
    }
    this.isWaitingNext = true;
    this.nextSpawnTs = performance.now() + ENTRY_DELAY;
    this.canHold = true;
    this.lockTimer = null;
    this.lockResets = 0;
    this.isOnGround = false;
    this.lastAction = null;
    const res = { cleared, garbageOut, actionLabel };
    this.results.push(res);
    return res;
  }

  _clearLines() {
    const { ROWS, COLS } = this.config;
    let n = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r + 2].every(c => c !== null)) {
        this.board.splice(r + 2, 1);
        this.board.unshift(Array(COLS).fill(null));
        n++;
        r++;
        this.boardDirty = true;
      }
    }
    return n;
  }

  _addGarbage(lines) {
    const { COLS } = this.config;
    if (lines <= 0) return;
    const hole = Math.floor(Math.random() * COLS);
    for (let i = 0; i < lines; i++) {
      this.board.shift();
      const row = Array(COLS).fill('G');
      row[hole] = null;
      this.board.push(row);
    }
    this.boardDirty = true;
  }

  hold() {
    if (!this.canHold) return false;
    const name = this.current.name;
    if (this.heldPiece) { this.current = makePiece(this.heldPiece); }
    else { this.current = makePiece(this.bag.next()); }
    this.heldPiece = name;
    this.canHold = false;
    this.lockTimer = null;
    this.lockResets = 0;
    this.isOnGround = false;
    this.lastDropTs = performance.now();
    this.callbacks.onSound?.('move');
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
    if (onGround) {
      if (!this.isOnGround) {
        this.isOnGround = true;
        this.lockTimer = ts;
      }
      if (ts - this.lockTimer >= this.config.LOCK_DELAY) {
        this.isOnGround = false;
        return this._lock();
      }
    }
    else {
      this.isOnGround = false;
      this.lockTimer = null;
      if (ts - this.lastDropTs >= this.dropSpeed) {
        this.lastDropTs = ts;
        this.current.y++;
      }
    }
    return null;
  }

  serialize() {
    if (this.boardDirty || !this._cachedBoard) {
      this._cachedBoard = this.board.slice(2).map(row => row.map(c => c || ''));
      this.boardDirty = false;
    }
    return {
      board: this._cachedBoard,
      score: this.score,
      lines: this.lines,
      level: this.level,
      gameOver: this.gameOver,
      cur: { name: this.current.name, rot: this.current.rot, x: this.current.x, y: this.current.y }
    };
  }

  draw() {
    if (!this.ctx) return;
    const { ROWS, COLS, CELL, LOCK_DELAY } = this.config;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cvs.width, this.cvs.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const cell = this.board[r + 2][c];
        if (cell) this._drawCell(ctx, c, r, cell === 'G' ? COLORS.G : COLORS[cell]);
      }

    if (!this.isWaitingNext) {
      const gy = this.ghostY();
      this.matrix().forEach((row, r) => row.forEach((cell, c) => {
        if (cell) {
          const py = gy + r;
          if (py >= 0) {
            ctx.fillStyle = COLORS.GHOST;
            ctx.fillRect(c * CELL + this.current.x * CELL + 1, py * CELL + 1, CELL - 2, CELL - 2);
          }
        }
      }));
      if (this.isOnGround && this.lockTimer !== null) {
        const pct = 1 - Math.min(1, (performance.now() - this.lockTimer) / LOCK_DELAY);
        const cells = this.cells();
        const maxY = Math.max(...cells.map(c => c[1]));
        cells.filter(([, cy]) => cy === maxY && cy >= 0).forEach(([cx, cy]) => {
          ctx.fillStyle = `rgba(255,255,255,${0.4 * pct})`;
          ctx.fillRect(cx * CELL + 1, cy * CELL + CELL - 3, Math.floor((CELL - 2) * pct), 2);
        });
      }
      this.matrix().forEach((row, r) => row.forEach((cell, c) => {
        if (cell) {
          const py = this.current.y + r;
          if (py >= 0) this._drawCell(ctx, this.current.x + c, py, COLORS[this.current.name]);
        }
      }));
    }
    if (this.gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,.75)';
      ctx.fillRect(0, 0, this.cvs.width, this.cvs.height);
      ctx.fillStyle = '#ff0080';
      ctx.font = 'bold 13px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('GAME', this.cvs.width / 2, this.cvs.height / 2 - 14);
      ctx.fillText('OVER', this.cvs.width / 2, this.cvs.height / 2 + 10);
    }
    if (this.nCtx) this._drawMini(this.nCtx, makePiece(this.bag.peek(1)[0]));
    if (this.hCtx) {
      this.hCtx.clearRect(0, 0, 80, 80);
      if (this.heldPiece) this._drawMini(this.hCtx, makePiece(this.heldPiece), this.canHold ? 1.0 : 0.4);
    }
  }

  _drawCell(ctx, x, y, color) {
    const { CELL } = this.config;
    ctx.fillStyle = color + 'dd';
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, 3);
    ctx.fillRect(x * CELL + 1, y * CELL + 1, 3, CELL - 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x * CELL + 3, y * CELL + CELL - 3, CELL - 3, 2);
    ctx.fillRect(x * CELL + CELL - 3, y * CELL + 3, 2, CELL - 3);
  }

  _drawMini(ctx, piece, alpha = 1) {
    const s = 80, cs = 16;
    ctx.clearRect(0, 0, s, s);
    ctx.globalAlpha = alpha;
    const m = PIECES[piece.name][0];
    const ox = Math.floor((4 - m[0].length) / 2), oy = Math.floor((4 - m.length) / 2);
    m.forEach((row, r) => row.forEach((cell, c) => {
      if (cell) {
        ctx.fillStyle = COLORS[piece.name] + 'dd';
        ctx.fillRect((ox + c) * cs + 1, (oy + r) * cs + 1, cs - 2, cs - 2);
        ctx.fillStyle = 'rgba(255,255,255,.2)';
        ctx.fillRect((ox + c) * cs + 1, (oy + r) * cs + 1, cs - 2, 3);
      }
    }));
    ctx.globalAlpha = 1;
  }

  static drawOpponent(canvas, data, config) {
    if (!data || !data.board) return;
    const { ROWS, COLS, CELL } = config;
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5;
    for (let r = 0; r < ROWS; r++)for (let c = 0; c < COLS; c++)ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
    data.board.forEach((row, r) => row.forEach((cell, c) => {
      if (!cell) return;
      const color = cell === 'G' ? COLORS.G : (COLORS[cell] || '#888');
      ctx.fillStyle = color + 'cc'; ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, 3);
    }));
    if (data.cur && PIECES[data.cur.name]) {
      const m = PIECES[data.cur.name][data.cur.rot || 0];
      const color = COLORS[data.cur.name] || '#888';
      m.forEach((row, r) => row.forEach((cell, c) => {
        if (cell) {
          const py = data.cur.y + r;
          if (py >= 0) {
            ctx.fillStyle = color + '99';
            ctx.fillRect((data.cur.x + c) * CELL + 1, py * CELL + 1, CELL - 2, CELL - 2);
          }
        }
      }));
    }
    if (data.gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ff0080'; ctx.font = 'bold 11px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
    }
  }
}

export class BotController {
  constructor(game, difficulty = 2, botConfig = {}) {
    this.game = game;
    this.difficulty = difficulty;
    this.botConfig = botConfig; // delays, noise
    this.lastActionTs = 0;
    this.moveQueue = [];
    this.lastEval = null;
  }

  _simulate(boardRows, pieceName, rot, startX) {
    const { ROWS, COLS } = this.game.config;
    const m = PIECES[pieceName][rot];
    if (!m) return null;
    for (let r = 0; r < m.length; r++)for (let c = 0; c < m[r].length; c++) {
      if (m[r][c] && (startX + c < 0 || startX + c >= COLS)) return null;
    }
    let py = -2;
    let stopped = false;
    while (!stopped) {
      py++;
      for (let r = 0; r < m.length; r++)for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const ny = py + r; const nx = startX + c;
        if (ny >= ROWS) { py--; stopped = true; break; }
        if (ny >= 0 && boardRows[ny][nx]) { py--; stopped = true; break; }
      }
      if (py > ROWS) return null;
    }
    const nb = boardRows.map(r => [...r]);
    for (let r = 0; r < m.length; r++)for (let c = 0; c < m[r].length; c++) {
      if (m[r][c]) { const ny = py + r; const nx = startX + c; if (ny < 0 || ny >= ROWS) return null; nb[ny][nx] = pieceName; }
    }
    let cleared = 0;
    const filt = nb.filter(row => !row.every(c => c !== null));
    cleared = ROWS - filt.length;
    while (filt.length < ROWS) filt.unshift(new Array(COLS).fill(null));
    const heights = new Array(COLS).fill(0);
    for (let col = 0; col < COLS; col++)for (let row = 0; row < ROWS; row++) { if (filt[row][col]) { heights[col] = ROWS - row; break; } }
    const aH = heights.reduce((a, b) => a + b, 0);
    let holes = 0;
    for (let col = 0; col < COLS; col++) { let found = false; for (let row = 0; row < ROWS; row++) { if (filt[row][col]) found = true; else if (found) holes++; } }
    let bump = 0;
    for (let col = 0; col < COLS - 1; col++)bump += Math.abs(heights[col] - heights[col + 1]);
    const clearedWeight = cleared === 4 ? 12.0 : (cleared * 1.5);
    const score = -0.51 * aH + clearedWeight - 0.40 * holes - 0.20 * bump;
    return { score, aH, cleared, holes, bump, clearedWeight, nb: filt };
  }

  findBestMove() {
    const { COLS } = this.game.config;
    const board = this.game.board.slice(2).map(r => r.map(c => c || null));
    const bag = this.game.bag;
    const canHold = this.game.canHold;
    const noise = this.botConfig.noise ? this.botConfig.noise[this.difficulty - 1] : 0.04;

    const evaluate = (pName, nName, isHold) => {
      let bestS = -Infinity, bestR = 0, bestX = 3, bestRes = null;
      for (let r = 0; r < 4; r++) {
        for (let x = -2; x < COLS + 2; x++) {
          const res = this._simulate(board, pName, r, x);
          if (!res) continue;
          let totalS = res.score;
          let bestNext = -Infinity;
          for (let nr = 0; nr < 4; nr++) {
            for (let nx = -2; nx < COLS + 2; nx++) {
              const nres = this._simulate(res.nb, nName, nr, nx);
              if (nres && nres.score > bestNext) bestNext = nres.score;
            }
          }
          if (bestNext !== -Infinity) totalS += bestNext;
          totalS += (Math.random() * 2 - 1) * noise * 4;
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
    for (let i = 0; i < Math.abs(dx); i++)moves.push(dir);
    moves.push('hd');
    return moves;
  }

  tick(ts) {
    if (!this.game || this.game.gameOver) return;
    if (this.game.isWaitingNext) { this.moveQueue = []; return; }
    const actionDelay = this.botConfig.delays ? this.botConfig.delays[this.difficulty - 1] : 120;
    if (ts - this.lastActionTs < actionDelay) return;
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
    const { CELL } = this.game.config;
    const ctx = this.game.ctx;
    const ev = this.lastEval;
    const m = PIECES[this.game.current.name][ev.rot];
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    let ty = -2;
    while (this.game.valid({ name: this.game.current.name, rot: ev.rot, x: ev.x, y: ty + 1 })) ty++;
    m.forEach((row, r) => row.forEach((cell, c) => {
      if (cell) {
        const py = ty + r;
        if (py >= 0) ctx.fillRect((ev.x + c) * CELL + 2, py * CELL + 2, CELL - 4, CELL - 4);
      }
    }));
    ctx.globalAlpha = 1;
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
