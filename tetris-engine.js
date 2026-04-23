export const COLS = 10;
export const ROWS = 20;
export const CELL = 30;
export const COLORS = {
    I: '#00f5ff',
    O: '#ffff00',
    T: '#cc00ff',
    S: '#aaff00',
    Z: '#ff0040',
    J: '#0066ff',
    L: '#ff8800',
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

export const NAMES = Object.keys(PIECES);

export const KJ = {
    '0->R': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    'R->0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    'R->2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '2->R': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2->L': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    'L->2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    'L->0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '0->L': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
};

export const KI = {
    '0->R': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    'R->0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    'R->2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '2->R': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '2->L': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    'L->2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    'L->0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '0->L': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
};

export const RN = ['0', 'R', '2', 'L'];
export const LS = [0, 100, 300, 500, 800];
export const TS = [400, 800, 1200, 1600];

let serverTimeOffset = 0;
export function setServerTimeOffset(offset) {
    serverTimeOffset = offset;
}
export function getServerTime() {
    return Date.now() + serverTimeOffset;
}

export class Bag {
    constructor() { this.q = [] }
    _refill() {
        const b = [...NAMES];
        for (let i = b.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [b[i], b[j]] = [b[j], b[i]]
        }
        this.q.push(...b)
    }
    next() { if (this.q.length < 4) this._refill(); return this.q.shift() }
    peek(n = 1) { while (this.q.length < n + 4) this._refill(); return this.q.slice(0, n) }
}

export function mkP(name) { return { name, rot: 0, x: 3, y: -1 } }

export class TetrisGame {
    constructor(cid, hid, nid) {
        this.cvs = document.getElementById(cid); this.ctx = this.cvs.getContext('2d');
        this.hCvs = hid ? document.getElementById(hid) : null; this.hCtx = this.hCvs ? this.hCvs.getContext('2d') : null;
        this.nCvs = nid ? document.getElementById(nid) : null; this.nCtx = this.nCvs ? this.nCvs.getContext('2d') : null;
        this.reset();
    }
    reset() {
        this.board = Array.from({ length: ROWS + 2 }, () => Array(COLS).fill(null));
        this.bag = new Bag(); this.current = mkP(this.bag.next());
        this.held = null; this.canHold = true; this.score = 0; this.lines = 0; this.level = 1; this.combo = 0; this.b2b = false;
        this.over = false; this.spd = 800; this.lastDrop = 0; this.lockTm = null; this.lockRst = 0; this._lockRstPnd = false; this.onGnd = false;
        this.waiting = false; this.nextTs = 0; this.dirty = true; this.lastAct = null; this.pendGarb = 0; this.results = [];
        this.burstGauge = 0; this.lastGarbHole = -1;
    }
    isPinch() { for (let r = 0; r < 6; r++) { for (let c = 0; c < COLS; c++) { if (this.board[r + 2][c]) return true; } } return false; }
    canBurst() { return this.burstGauge >= 100; }
    useBurst() {
        if (!this.canBurst()) return 0;
        this.burstGauge = 0; this.pendGarb = 0;
        for (let i = 0; i < 4; i++) {
            this.board.pop();
            this.board.unshift(Array(COLS).fill(null));
        }
        this.dirty = true; return 5;
    }
    _get(x, y) { if (x < 0 || x >= COLS || y < -2 || y >= ROWS) return y >= ROWS ? 'W' : null; return this.board[y + 2][x] }
    _set(x, y, v) { if (y < -2 || y >= ROWS || x < 0 || x >= COLS) return; this.board[y + 2][x] = v; this.dirty = true }
    mat(p = this.current) { return PIECES[p.name][p.rot] }
    cells(p = this.current) { const m = this.mat(p), o = []; for (let r = 0; r < m.length; r++)for (let c = 0; c < m[r].length; c++)if (m[r][c]) o.push([p.x + c, p.y + r]); return o }
    valid(p, dx = 0, dy = 0, rot = null) {
        const m = rot !== null ? PIECES[p.name][rot] : this.mat(p);
        for (let r = 0; r < m.length; r++)for (let c = 0; c < m[r].length; c++) {
            if (!m[r][c]) continue; const nx = p.x + c + dx, ny = p.y + r + dy;
            if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
            if (ny >= -2 && this._get(nx, ny)) return false;
        } return true;
    }
    rotate(dir = 1) {
        const f = this.current.rot, t = (f + (dir > 0 ? 1 : 3)) % 4, k = `${RN[f]}->${RN[t]}`;
        const ks = this.current.name === 'I' ? KI[k] : KJ[k]; if (!ks) return false;
        for (const [kx, ky] of ks) { if (this.valid(this.current, kx, -ky, t)) { this.current.x += kx; this.current.y += -ky; this.current.rot = t; this.lastAct = { type: 'rotate', dir, kick: kx || ky }; this._rstLock(); return true; } } return false;
    }
    move(dx) { if (this.valid(this.current, dx)) { this.current.x += dx; this.lastAct = { type: 'move' }; this._rstLock(); return true; } return false; }
    softDrop() { if (this.valid(this.current, 0, 1)) { this.current.y++; this.score++; this.lastAct = { type: 'move' }; this.onGnd = false; this.lockTm = null; return true; } return false; }
    hardDrop() {
        if (this.waiting) return null;
        let d = 0; while (this.valid(this.current, 0, 1)) { this.current.y++; d++; } this.score += d * 2; this.lastAct = { type: 'hard' }; return this._lock();
    }
    ghostY() { let g = this.current.y; while (this.valid(this.current, 0, g - this.current.y + 1)) g++; return g; }
    _rstLock() { if (this.onGnd && this.lockRst < 15) { this._lockRstPnd = true; this.lockRst++; } }
    _tSpin() { if (this.current.name !== 'T' || !this.lastAct || this.lastAct.type !== 'rotate') return false; const { x, y } = this.current; const cs = [[x, y], [x + 2, y], [x, y + 2], [x + 2, y + 2]]; return cs.filter(([cx, cy]) => cy < 0 || cy >= ROWS || cx < 0 || cx >= COLS || !!this._get(cx, cy)).length >= 3; }
    _lock() {
        for (const [cx, cy] of this.cells()) { if (cy >= 0) this._set(cx, cy, this.current.name); else this.over = true; }
        const ts = this._tSpin(), cl = this._clearLines();
        let pts = 0, go = 0, lbl = ''; const sp = ts || cl === 4;
        if (ts) { pts = TS[cl] * this.level; lbl = ['T-SPIN!', 'T-SPIN SINGLE!', 'T-SPIN DOUBLE!', 'T-SPIN TRIPLE!'][cl] || 'T-SPIN!'; go = [0, 2, 4, 6][cl] || 0; }
        else if (cl > 0) { pts = LS[cl] * this.level; lbl = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS!!'][cl]; go = [0, 0, 1, 2, 4][cl] || 0; }
        if (sp && cl > 0) { if (this.b2b) { pts = Math.floor(pts * 1.5); go += 1; lbl += '\nBACK-TO-BACK!'; } this.b2b = true; }
        else if (cl > 0 && !ts) this.b2b = false;
        if (cl > 0) { this.combo++; if (this.combo > 1) { pts += 50 * (this.combo - 1) * this.level; go += Math.floor(this.combo / 2); lbl += (lbl ? '\n' : '') + 'COMBO x' + this.combo + '!'; } } else this.combo = 0;
        this.score += pts;
        if (cl > 0) { this.lines += cl; this.level = Math.floor(this.lines / 10) + 1; this.spd = Math.max(50, 800 - (this.level - 1) * 70); }
        let gg = 0;
        if (ts) gg = [0, 10, 20, 30][cl] || 0;
        else if (cl > 0) gg = [0, 2, 5, 10, 20][cl] || 0;
        if (this.combo > 1) gg += (this.combo - 1) * 2;
        if (this.b2b && cl > 0) gg = Math.floor(gg * 1.5);
        this.burstGauge = Math.min(100, this.burstGauge + gg);
        if (this.pendGarb > 0 && go > 0) { const cn = Math.min(go, this.pendGarb); go -= cn; this.pendGarb -= cn; }
        if (cl === 0 && this.pendGarb > 0) { this._addGarb(this.pendGarb); this.pendGarb = 0; }
        this.waiting = true; this.nextTs = (this._lastTs || performance.now()) + 200;
        this.canHold = true; this.lockTm = null; this.lockRst = 0; this.onGnd = false; this.lastAct = null;
        this.results.push({ cleared: cl, garbageOut: go, actionLabel: lbl }); return { cleared: cl, garbageOut: go, actionLabel: lbl };
    }
    _clearLines() { let n = 0; for (let r = ROWS - 1; r >= 0; r--) { if (this.board[r + 2].every(c => c !== null)) { this.board.splice(r + 2, 1); this.board.unshift(Array(COLS).fill(null)); n++; r++; this.dirty = true; } } return n; }
    _addGarb(n) {
        if (n <= 0) return;
        let h = this.lastGarbHole;
        if (h === -1 || Math.random() < 0.1) h = Math.floor(Math.random() * COLS);
        this.lastGarbHole = h;
        for (let i = 0; i < n; i++) { this.board.shift(); const r = Array(COLS).fill('G'); r[h] = null; this.board.push(r); }
        this.dirty = true;
    }
    hold() {
        if (!this.canHold || this.waiting) return false;
        const name = this.current.name;
        if (this.held) this.current = mkP(this.held); else this.current = mkP(this.bag.next());
        this.held = name; this.canHold = false; this.lockTm = null; this.lockRst = 0; this.onGnd = false;
        this.lastDrop = performance.now(); return true;
    }
    update(ts) {
        if (this.over) return null;
        if (this.waiting) { if (ts >= this.nextTs) { this.waiting = false; this.current = mkP(this.bag.next()); while (!this.valid(this.current) && this.current.y > -4) this.current.y--; if (!this.valid(this.current)) this.over = true; } return null; }
        const og = !this.valid(this.current, 0, 1);
        if (og) { if (!this.onGnd || this.lockTm === null) { this.onGnd = true; this.lockTm = ts; } if (this._lockRstPnd) { this.lockTm = ts; this._lockRstPnd = false; } if (ts - this.lockTm >= 750) { this.onGnd = false; return this._lock(); } }
        else { this.onGnd = false; this.lockTm = null; if (ts - this.lastDrop >= this.spd) { this.lastDrop = ts; this.current.y++; } }
        return null;
    }
    serialize() {
        if (this.dirty || !this._cb) { this._cb = this.board.slice(2).map(r => r.map(c => c || '')); this.dirty = false; }
        return { board: this._cb, score: this.score, lines: this.lines, level: this.level, gameOver: this.over, cur: { name: this.current.name, rot: this.current.rot, x: this.current.x, y: this.current.y }, held: this.held || '', next: this.bag.peek(1)[0] || '', combo: this.combo, b2b: this.b2b, pendGarb: this.pendGarb };
    }
    draw() {
        const ctx = this.ctx; ctx.clearRect(0, 0, this.cvs.width, this.cvs.height);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5;
        for (let r = 0; r < ROWS; r++)for (let c = 0; c < COLS; c++)ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
        for (let r = 0; r < ROWS; r++)for (let c = 0; c < COLS; c++) { const cell = this.board[r + 2][c]; if (cell) this._dc(ctx, c, r, cell === 'G' ? '#888888' : COLORS[cell]); }
        if (!this.waiting) {
            const gy = this.ghostY();
            const pColor = COLORS[this.current.name];
            this.mat().forEach((row, r) => row.forEach((cell, c) => {
                if (cell) {
                    const py = gy + r;
                    if (py >= 0) {
                        const bx = (this.current.x + c) * CELL, by = py * CELL;
                        ctx.fillStyle = pColor + '59';
                        ctx.fillRect(bx + 1, by + 1, CELL - 2, CELL - 2);
                        ctx.strokeStyle = pColor + 'd9';
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(bx + 1.5, by + 1.5, CELL - 3, CELL - 3);
                        ctx.fillStyle = 'rgba(255,255,255,0.18)';
                        ctx.fillRect(bx + 2, by + 2, CELL - 4, 2);
                    }
                }
            }));
            this.mat().forEach((row, r) => row.forEach((cell, c) => { if (cell) { const py = this.current.y + r; if (py >= 0) this._dc(ctx, this.current.x + c, py, COLORS[this.current.name]); } }));
        }
        if (this.over) { ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(0, 0, this.cvs.width, this.cvs.height); ctx.fillStyle = '#ff0080'; ctx.font = 'bold 13px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText('GAME', this.cvs.width / 2, this.cvs.height / 2 - 14); ctx.fillText('OVER', this.cvs.width / 2, this.cvs.height / 2 + 10); }
        if (this.nCtx) this._dm(this.nCtx, mkP(this.bag.peek(1)[0]));
        if (this.hCtx) { this.hCtx.clearRect(0, 0, 68, 68); if (this.held) this._dm(this.hCtx, mkP(this.held), this.canHold ? 1 : .4); }
    }
    _dc(ctx, x, y, color) { ctx.fillStyle = color + 'dd'; ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, 3); ctx.fillRect(x * CELL + 1, y * CELL + 1, 3, CELL - 2); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x * CELL + 3, y * CELL + CELL - 3, CELL - 3, 2); ctx.fillRect(x * CELL + CELL - 3, y * CELL + 3, 2, CELL - 3); }
    _dm(ctx, piece, a = 1) { const cs = 14; ctx.clearRect(0, 0, 68, 68); ctx.globalAlpha = a; const m = PIECES[piece.name][0]; const ox = Math.floor((4 - m[0].length) / 2), oy = Math.floor((4 - m.length) / 2); m.forEach((row, r) => row.forEach((cell, c) => { if (cell) { ctx.fillStyle = COLORS[piece.name] + 'dd'; ctx.fillRect((ox + c) * cs + 1, (oy + r) * cs + 1, cs - 2, cs - 2); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect((ox + c) * cs + 1, (oy + r) * cs + 1, cs - 2, 3); } })); ctx.globalAlpha = 1; }
    static drawOpp(canvas, data, W, H) {
        if (!data || !data.board) return;
        const ctx = canvas.getContext('2d'), cw = W / COLS, ch = H / ROWS;
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 0.3;
        for (let r = 0; r < ROWS; r++)for (let c = 0; c < COLS; c++)ctx.strokeRect(c * cw, r * ch, cw, ch);
        for (let r = 0; r < ROWS; r++)for (let c = 0; c < COLS; c++) { const cell = data.board[r]?.[c]; if (!cell) continue; const color = cell === 'G' ? '#888888' : (COLORS[cell] || '#888'); ctx.fillStyle = color + 'cc'; ctx.fillRect(c * cw + .5, r * ch + .5, cw - 1, ch - 1); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(c * cw + .5, r * ch + .5, cw - 1, 2); }
        if (data.cur && !data.gameOver && PIECES[data.cur.name]) { const p = data.cur, m = PIECES[p.name]?.[p.rot || 0]; if (m) { m.forEach((row, r) => row.forEach((cell, c) => { if (cell) { const px = p.x + c, py = p.y + r; if (py >= 0) { ctx.fillStyle = (COLORS[p.name] || '#fff') + '99'; ctx.fillRect(px * cw + .5, py * ch + .5, cw - 1, ch - 1); } } })); } }
        if (data.gameOver) { ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#ff0080'; ctx.font = `bold ${Math.max(6, W / 10 | 0)}px "Press Start 2P"`; ctx.textAlign = 'center'; ctx.fillText('OUT', W / 2, H / 2 + 3); }
    }
}
