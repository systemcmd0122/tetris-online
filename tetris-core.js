/**
 * tetris-core.js
 * Centralized Tetris Logic for TETRIS BATTLE
 */

export const COLS = 10;
export const ROWS = 20;
export const VISIBLE_ROWS = 20;
export const BUFFER_ROWS = 2; // Total rows = 22

export const COLORS = {
  I: '#00f5ff',
  O: '#ffff00',
  T: '#cc00ff',
  S: '#aaff00',
  Z: '#ff0040',
  J: '#0066ff',
  L: '#ff8800',
  G: '#888888',
  GHOST: 'rgba(255,255,255,0.15)'
};

export const PIECES = {
  I: [
    [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]],
    [[0,0,1,0], [0,0,1,0], [0,0,1,0], [0,0,1,0]],
    [[0,0,0,0], [0,0,0,0], [1,1,1,1], [0,0,0,0]],
    [[0,1,0,0], [0,1,0,0], [0,1,0,0], [0,1,0,0]]
  ],
  O: [
    [[1,1], [1,1]],
    [[1,1], [1,1]],
    [[1,1], [1,1]],
    [[1,1], [1,1]]
  ],
  T: [
    [[0,1,0], [1,1,1], [0,0,0]],
    [[0,1,0], [0,1,1], [0,1,0]],
    [[0,0,0], [1,1,1], [0,1,0]],
    [[0,1,0], [1,1,0], [0,1,0]]
  ],
  S: [
    [[0,1,1], [1,1,0], [0,0,0]],
    [[0,1,0], [0,1,1], [0,0,1]],
    [[0,0,0], [0,1,1], [1,1,0]],
    [[1,0,0], [1,1,0], [0,1,0]]
  ],
  Z: [
    [[1,1,0], [0,1,1], [0,0,0]],
    [[0,0,1], [0,1,1], [0,1,0]],
    [[0,0,0], [1,1,0], [0,1,1]],
    [[0,1,0], [1,1,0], [1,0,0]]
  ],
  J: [
    [[1,0,0], [1,1,1], [0,0,0]],
    [[0,1,1], [0,1,0], [0,1,0]],
    [[0,0,0], [1,1,1], [0,0,1]],
    [[0,1,0], [0,1,0], [1,1,0]]
  ],
  L: [
    [[0,0,1], [1,1,1], [0,0,0]],
    [[0,1,0], [0,1,0], [0,1,1]],
    [[0,0,0], [1,1,1], [1,0,0]],
    [[1,1,0], [0,1,0], [0,1,0]]
  ]
};

// SRS Wall Kick Data
const KJ = {
  '0->R': [[0,0], [-1,0], [-1, 1], [0,-2], [-1,-2]],
  'R->0': [[0,0], [ 1,0], [ 1,-1], [0, 2], [ 1, 2]],
  'R->2': [[0,0], [ 1,0], [ 1,-1], [0, 2], [ 1, 2]],
  '2->R': [[0,0], [-1,0], [-1, 1], [0,-2], [-1,-2]],
  '2->L': [[0,0], [ 1,0], [ 1, 1], [0,-2], [ 1,-2]],
  'L->2': [[0,0], [-1,0], [-1,-1], [0, 2], [-1, 2]],
  'L->0': [[0,0], [-1,0], [-1,-1], [0, 2], [-1, 2]],
  '0->L': [[0,0], [ 1,0], [ 1, 1], [0,-2], [ 1,-2]]
};

const KI = {
  '0->R': [[0,0], [-2,0], [ 1,0], [-2,-1], [ 1, 2]],
  'R->0': [[0,0], [ 2,0], [-1,0], [ 2, 1], [-1,-2]],
  'R->2': [[0,0], [-1,0], [ 2,0], [-1, 2], [ 2,-1]],
  '2->R': [[0,0], [ 1,0], [-2,0], [ 1,-2], [-2, 1]],
  '2->L': [[0,0], [ 2,0], [-1,0], [ 2, 1], [-1,-2]],
  'L->2': [[0,0], [-2,0], [ 1,0], [-2,-1], [ 1, 2]],
  'L->0': [[0,0], [ 1,0], [-2,0], [ 1,-2], [-2, 1]],
  '0->L': [[0,0], [-1,0], [ 2,0], [-1, 2], [ 2,-1]]
};

const RN = ['0', 'R', '2', 'L'];

export class Bag {
  constructor() { this.q = []; }
  _refill() {
    const b = Object.keys(PIECES);
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    this.q.push(...b);
  }
  next() {
    if (this.q.length < 7) this._refill();
    return this.q.shift();
  }
  peek(n = 1) {
    while (this.q.length < n + 7) this._refill();
    return this.q.slice(0, n);
  }
}

export class TetrisGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = Array.from({ length: ROWS + BUFFER_ROWS }, () => Array(COLS).fill(null));
    this.bag = new Bag();
    this.current = this.spawnPiece(this.bag.next());
    this.held = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.combo = 0;
    this.b2b = false;
    this.over = false;
    this.waiting = false;
    this.nextTs = 0;
    this.lastAct = null;
    this.pendGarb = 0;
    this.results = []; // List of events to be consumed by UI
    this.dirty = true;
    this.lastDrop = performance.now();
    this.lockTm = null;
    this.lockRst = 0;
    this.onGnd = false;
  }

  spawnPiece(name) {
    return { name, rot: 0, x: 3, y: -1 };
  }

  _get(x, y) {
    if (x < 0 || x >= COLS || y < -BUFFER_ROWS || y >= ROWS) return y >= ROWS ? 'W' : null;
    return this.board[y + BUFFER_ROWS][x];
  }

  _set(x, y, v) {
    if (y < -BUFFER_ROWS || y >= ROWS || x < 0 || x >= COLS) return;
    this.board[y + BUFFER_ROWS][x] = v;
    this.dirty = true;
  }

  mat(p = this.current) { return PIECES[p.name][p.rot]; }

  cells(p = this.current) {
    const m = this.mat(p), o = [];
    for (let r = 0; r < m.length; r++)
      for (let c = 0; c < m[r].length; c++)
        if (m[r][c]) o.push([p.x + c, p.y + r]);
    return o;
  }

  valid(p, dx = 0, dy = 0, rot = null) {
    const m = rot !== null ? PIECES[p.name][rot] : this.mat(p);
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const nx = p.x + c + dx, ny = p.y + r + dy;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
        if (ny >= -BUFFER_ROWS && this._get(nx, ny)) return false;
      }
    }
    return true;
  }

  rotate(dir = 1) {
    if (this.over || this.waiting) return false;
    const f = this.current.rot;
    const t = (f + (dir > 0 ? 1 : 3)) % 4;
    if (this.current.name === 'O') return false;

    const k = `${RN[f]}->${RN[t]}`;
    const ks = this.current.name === 'I' ? KI[k] : KJ[k];
    if (!ks) return false;

    for (const [kx, ky] of ks) {
      if (this.valid(this.current, kx, -ky, t)) {
        this.current.x += kx;
        this.current.y += -ky;
        this.current.rot = t;
        this.lastAct = { type: 'rotate', dir, kick: kx !== 0 || ky !== 0 };
        this._rstLock();
        this.dirty = true;
        return true;
      }
    }
    return false;
  }

  move(dx) {
    if (this.over || this.waiting) return false;
    if (this.valid(this.current, dx)) {
      this.current.x += dx;
      this.lastAct = { type: 'move' };
      this._rstLock();
      this.dirty = true;
      return true;
    }
    return false;
  }

  softDrop() {
    if (this.over || this.waiting) return false;
    if (this.valid(this.current, 0, 1)) {
      this.current.y++;
      this.score++;
      this.lastAct = { type: 'move' };
      this.onGnd = false;
      this.lockTm = null;
      this.dirty = true;
      return true;
    }
    return false;
  }

  hardDrop() {
    if (this.over || this.waiting) return null;
    let d = 0;
    while (this.valid(this.current, 0, 1)) {
      this.current.y++;
      d++;
    }
    this.score += d * 2;
    this.lastAct = { type: 'hard' };
    this.dirty = true;
    return this._lock();
  }

  hold() {
    if (this.over || this.waiting || !this.canHold) return false;
    const name = this.current.name;
    if (this.held) {
      this.current = this.spawnPiece(this.held);
    } else {
      this.current = this.spawnPiece(this.bag.next());
    }
    this.held = name;
    this.canHold = false;
    this.lockTm = null;
    this.lockRst = 0;
    this.onGnd = false;
    this.lastDrop = performance.now();
    this.dirty = true;
    return true;
  }

  ghostY() {
    let g = this.current.y;
    while (this.valid(this.current, 0, g - this.current.y + 1)) g++;
    return g;
  }

  _rstLock() {
    if (this.onGnd && this.lockRst < 15) {
      this.lockTm = performance.now();
      this.lockRst++;
    }
  }

  _tSpin() {
    if (this.current.name !== 'T' || !this.lastAct || this.lastAct.type !== 'rotate') return false;
    const { x, y } = this.current;
    // T-piece 3-corner rule
    const corners = [[x, y], [x + 2, y], [x, y + 2], [x + 2, y + 2]];
    let count = 0;
    for (const [cx, cy] of corners) {
      if (cx < 0 || cx >= COLS || cy >= ROWS || (cy >= -BUFFER_ROWS && this._get(cx, cy))) {
        count++;
      }
    }
    return count >= 3;
  }

  _lock() {
    for (const [cx, cy] of this.cells()) {
      if (cy >= 0) this._set(cx, cy, this.current.name);
      else this.over = true;
    }

    const ts = this._tSpin();
    const cl = this._clearLines();
    let pts = 0, go = 0, lbl = '';
    const sp = ts || cl === 4;

    const TS_SCORES = [400, 800, 1200, 1600];
    const LS_SCORES = [0, 100, 300, 500, 800];

    if (ts) {
      pts = TS_SCORES[cl] * this.level;
      lbl = ['T-SPIN!', 'T-SPIN SINGLE!', 'T-SPIN DOUBLE!', 'T-SPIN TRIPLE!'][cl] || 'T-SPIN!';
      go = [0, 2, 4, 6][cl] || 0;
    } else if (cl > 0) {
      pts = LS_SCORES[cl] * this.level;
      lbl = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS!!'][cl];
      go = [0, 0, 1, 2, 4][cl] || 0;
    }

    if (cl > 0) {
      if (sp) {
        if (this.b2b) {
          pts = Math.floor(pts * 1.5);
          go += 1;
          lbl += '\nBACK-TO-BACK!';
        }
        this.b2b = true;
      } else {
        this.b2b = false;
      }
      this.combo++;
      if (this.combo > 1) {
        pts += 50 * (this.combo - 1) * this.level;
        go += Math.floor(this.combo / 2);
        lbl += (lbl ? '\n' : '') + 'COMBO x' + this.combo + '!';
      }
    } else {
      this.combo = 0;
    }

    this.score += pts;
    this.lines += cl;
    this.level = Math.floor(this.lines / 10) + 1;

    // Garbage blocking / cancelling
    if (this.pendGarb > 0 && go > 0) {
      const cancel = Math.min(this.pendGarb, go);
      this.pendGarb -= cancel;
      go -= cancel;
    }
    if (this.pendGarb > 0 && cl === 0) {
      this._addGarb(this.pendGarb);
      this.pendGarb = 0;
    }

    this.results.push({ type: 'lock', cleared: cl, garbageOut: go, actionLabel: lbl, tspin: ts });
    this.waiting = true;
    this.nextTs = performance.now() + 200; // Entry Delay
    this.canHold = true;
    this.lockTm = null;
    this.lockRst = 0;
    this.onGnd = false;
    this.lastAct = null;
    this.dirty = true;

    if (this.over) this.results.push({ type: 'gameover' });
    return { cleared: cl, garbageOut: go, actionLabel: lbl };
  }

  _clearLines() {
    let n = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r + BUFFER_ROWS].every(c => c !== null)) {
        this.board.splice(r + BUFFER_ROWS, 1);
        this.board.unshift(Array(COLS).fill(null));
        n++;
        r++;
        this.dirty = true;
      }
    }
    return n;
  }

  _addGarb(n) {
    if (n <= 0) return;
    const h = Math.floor(Math.random() * COLS);
    for (let i = 0; i < n; i++) {
      this.board.shift();
      const r = Array(COLS).fill('G');
      r[h] = null;
      this.board.push(r);
    }
    this.dirty = true;
  }

  update(ts) {
    if (this.over) return null;
    if (this.waiting) {
      if (ts >= this.nextTs) {
        this.waiting = false;
        this.current = this.spawnPiece(this.bag.next());
        if (!this.valid(this.current)) this.over = true;
        this.lastDrop = ts;
        this.dirty = true;
      }
      return null;
    }

    const spd = Math.max(50, 800 - (this.level - 1) * 70);
    const og = !this.valid(this.current, 0, 1);

    if (og) {
      if (!this.onGnd || this.lockTm === null) {
        this.onGnd = true;
        this.lockTm = ts;
      }
      if (ts - this.lockTm >= 750) {
        this.onGnd = false;
        return this._lock();
      }
    } else {
      this.onGnd = false;
      this.lockTm = null;
      if (ts - this.lastDrop >= spd) {
        this.lastDrop = ts;
        this.current.y++;
        this.dirty = true;
      }
    }
    return null;
  }

  serialize() {
    return {
      board: this.board.slice(BUFFER_ROWS).map(r => r.map(c => c || '')),
      score: this.score,
      lines: this.lines,
      level: this.level,
      gameOver: this.over,
      held: this.held,
      next: this.bag.peek(1)[0],
      cur: { name: this.current.name, rot: this.current.rot, x: this.current.x, y: this.current.y },
      ghostY: this.ghostY(),
      combo: this.combo,
      b2b: this.b2b,
      pendGarb: this.pendGarb
    };
  }
}
