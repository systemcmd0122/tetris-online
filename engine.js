/**
 * engine.js - TETRIS BATTLE 決定論的ゲームエンジン v3.0
 *
 * 特徴:
 * - 決定論的挙動 (Mulberry32 PRNG)
 * - 60Hz 固定タイムステップ (フレームベース処理)
 * - 入力履歴の記録・再生機能
 * - ロールバック対応の状態管理
 * - 競技基準のSRS (Super Rotation System) 実装
 */

import { RNG } from './rng.js';

// ── 定数 ──────────────────────────────────────────────────
export const COLS = 10;
export const ROWS = 20;
export const VISIBLE_ROWS = 20;
export const TOTAL_ROWS = ROWS + 2; // バッファ含む

export const PIECES = {
    I: [[[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]], [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]], [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]]],
    O: [[[1, 1], [1, 1]], [[1, 1], [1, 1]], [[1, 1], [1, 1]], [[1, 1], [1, 1]]],
    T: [[[0, 1, 0], [1, 1, 1], [0, 0, 0]], [[0, 1, 0], [0, 1, 1], [0, 1, 0]], [[0, 0, 0], [1, 1, 1], [0, 1, 0]], [[0, 1, 0], [1, 1, 0], [0, 1, 0]]],
    S: [[[0, 1, 1], [1, 1, 0], [0, 0, 0]], [[0, 1, 0], [0, 1, 1], [0, 0, 1]], [[0, 0, 0], [0, 1, 1], [1, 1, 0]], [[1, 0, 0], [1, 1, 0], [0, 1, 0]]],
    Z: [[[1, 1, 0], [0, 1, 1], [0, 0, 0]], [[0, 0, 1], [0, 1, 1], [0, 1, 0]], [[0, 0, 0], [1, 1, 0], [0, 1, 1]], [[0, 1, 0], [1, 1, 0], [1, 0, 0]]],
    J: [[[1, 0, 0], [1, 1, 1], [0, 0, 0]], [[0, 1, 1], [0, 1, 0], [0, 1, 0]], [[0, 0, 0], [1, 1, 1], [0, 0, 1]], [[0, 1, 0], [0, 1, 0], [1, 1, 0]]],
    L: [[[0, 0, 1], [1, 1, 1], [0, 0, 0]], [[0, 1, 0], [0, 1, 0], [0, 1, 1]], [[0, 0, 0], [1, 1, 1], [1, 0, 0]], [[1, 1, 0], [0, 1, 0], [0, 1, 0]]]
};

const KJ = { '0->R': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], 'R->0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], 'R->2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], '2->R': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '2->L': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], 'L->2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], 'L->0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], '0->L': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]] };
const KI = { '0->R': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], 'R->0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], 'R->2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], '2->R': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], '2->L': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], 'L->2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], 'L->0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], '0->L': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]] };
const RN = ['0', 'R', '2', 'L'];
const MAX_RESETS = 15;

const LS_POINTS = [0, 100, 300, 500, 800];
const TS_POINTS = [400, 800, 1200, 1600];
const ATK_TABLE = {
    SINGLE: 0, DOUBLE: 1, TRIPLE: 2, TETRIS: 4,
    TS_MINI: 0, TS_SINGLE: 2, TS_DOUBLE: 4, TS_TRIPLE: 6,
    B2B: 1, PC: 10
};

// ── 決定論的ミノバッグ ──────────────────────────────────────
class DeterministicBag {
    constructor(rng) {
        this.rng = rng;
        this.q = [];
    }
    _refill() {
        const b = Object.keys(PIECES);
        const shuffled = this.rng.shuffle(b);
        this.q.push(...shuffled);
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

// ── ゲームエンジン ──────────────────────────────────────────
export class CoreEngine {
    constructor(options = {}) {
        this.seed = options.seed || Date.now();
        this.rng = new RNG(this.seed);
        this.bag = new DeterministicBag(this.rng);

        this.reset();
    }

    reset() {
        this.board = Array.from({ length: TOTAL_ROWS }, () => Array(COLS).fill(null));
        this.current = this._spawnPiece(this.bag.next());
        this.held = null;
        this.canHold = true;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.combo = 0;
        this.b2b = false;
        this.over = false;
        this.frame = 0;
        this.pieceCount = 1;

        this.lastAction = null;
        this.pendGarb = 0;
        this.garbageHole = this.rng.nextInt(0, COLS - 1);

        this.gravityCounter = 0;
        this.lockCounter = 0;
        this.lockResets = 0;
        this.waitingFrames = 0;

        // DAS/ARR
        this.dasCounter = { left: 0, right: 0 };
        this.dasThreshold = 10; // 10 frames (~167ms)
        this.arrInterval = 2;   // 2 frames (~33ms)

        // 入力履歴
        this.inputHistory = [];
        this.events = [];
    }

    // ── 内部ユーティリティ ──────────────────────────────────
    _spawnPiece(name) {
        return { name, rot: 0, x: 3, y: -1 };
    }

    _get(x, y) {
        if (x < 0 || x >= COLS || y < -2 || y >= ROWS) return y >= ROWS ? 'W' : null;
        return this.board[y + 2][x];
    }

    _set(x, y, v) {
        if (y < -2 || y >= ROWS || x < 0 || x >= COLS) return;
        this.board[y + 2][x] = v;
    }

    _isValid(p, dx = 0, dy = 0, rot = null) {
        const rotation = rot !== null ? rot : p.rot;
        if (!p || !p.name) return false; const m = PIECES[p.name][rotation];
        for (let r = 0; r < m.length; r++) {
            for (let c = 0; c < m[r].length; c++) {
                if (!m[r][c]) continue;
                const nx = p.x + c + dx, ny = p.y + r + dy;
                if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
                if (ny >= -2 && this._get(nx, ny)) return false;
            }
        }
        return true;
    }

    // ── ゲームロジック (1フレーム分の更新) ───────────────────
    tick(input = {}) { if (!input) input = {};
        if (this.over) return;
        this.frame++;

        // 入力記録
        if (Object.keys(input).length > 0) {
            this.inputHistory.push({ f: this.frame, i: input });
        }

        // ミノ出現待ち
        if (this.waitingFrames > 0) {
            this.waitingFrames--;
            if (this.waitingFrames === 0) {
                this.current = this._spawnPiece(this.bag.next());
                this.pieceCount++;
                if (!this._isValid(this.current)) this.over = true;
            }
            return;
        }

        // 入力処理
        this._handleInput(input);

        // 重力とロック
        const onGround = !this._isValid(this.current, 0, 1);
        if (onGround) {
            this.lockCounter++;
            if (this.lockCounter >= 30) { // 0.5s at 60fps
                this._lock();
            }
        } else {
            this.lockCounter = 0;
            const gravityLimit = Math.max(1, 60 - (this.level - 1) * 5);
            this.gravityCounter++;
            if (this.gravityCounter >= gravityLimit || input.down) {
                if (this._isValid(this.current, 0, 1)) {
                    this.current.y++;
                    this.gravityCounter = 0;
                }
            }
        }
    }

    _handleInput(input) {
        // 回転・ホールド・ハードドロップは「押した瞬間」のみ反応させる必要がある
        // 入力履歴から前回のフレームの状態を比較して「新規押し」を判定する
        const prevInput = this.frame > 1 ? (this.inputHistory[this.inputHistory.length - 2]?.i || {}) : {};

        if (input.rotR && !prevInput.rotR) this.rotate(1);
        if (input.rotL && !prevInput.rotL) this.rotate(-1);
        if (input.hold && !prevInput.hold) this.hold();
        if (input.hardDrop && !prevInput.hardDrop) this.hardDrop();

        // 左右移動 (DAS/ARR)
        this._handleDAS(input, prevInput);
    }

    _handleDAS(input, prevInput) {
        const dirs = [
            { key: 'left', dx: -1 },
            { key: 'right', dx: 1 }
        ];

        dirs.forEach(d => {
            if (input[d.key]) {
                if (!prevInput[d.key]) {
                    // 初回押し
                    this.move(d.dx);
                    this.dasCounter[d.key] = 0;
                } else {
                    this.dasCounter[d.key]++;
                    if (this.dasCounter[d.key] >= this.dasThreshold) {
                        if ((this.dasCounter[d.key] - this.dasThreshold) % this.arrInterval === 0) {
                            this.move(d.dx);
                        }
                    }
                }
            } else {
                this.dasCounter[d.key] = 0;
            }
        });
    }

    // ── アクション ──────────────────────────────────────────
    move(dx) {
        if (this._isValid(this.current, dx)) {
            this.current.x += dx;
            if (!this._isValid(this.current, 0, 1)) this._resetLock();
            this.events.push({ f: this.frame, type: 'MOVE' });
            return true;
        }
        return false;
    }

    rotate(dir) {
        const f = this.current.rot;
        const t = (f + (dir > 0 ? 1 : 3)) % 4;
        const k = `${RN[f]}->${RN[t]}`;
        const ks = this.current.name === 'I' ? KI[k] : KJ[k];

        for (const [kx, ky] of ks) {
            if (this._isValid(this.current, kx, -ky, t)) {
                this.current.x += kx;
                this.current.y += -ky;
                this.current.rot = t;
                this.lastAction = { type: 'rotate', dir, kick: kx || ky };
                this._resetLock();
                this.events.push({ f: this.frame, type: 'ROTATE' });
                return true;
            }
        }
        return false;
    }

    hold() {
        if (!this.canHold) return false;
        const name = this.current.name;
        if (this.held) {
            this.current = this._spawnPiece(this.held);
        } else {
            this.current = this._spawnPiece(this.bag.next());
        }
        this.held = name;
        this.canHold = false;
        this.lockCounter = 0;
        this.lockResets = 0;
        this.events.push({ f: this.frame, type: 'HOLD' });
        return true;
    }

    hardDrop() {
        let dist = 0;
        while (this._isValid(this.current, 0, 1)) {
            this.current.y++;
            dist++;
        }
        this.score += dist * 2;
        this.events.push({ f: this.frame, type: 'HARD_DROP' });
        this._lock();
    }

    _resetLock() {
        if (this.lockResets < MAX_RESETS) {
            this.lockCounter = 0;
            this.lockResets++;
        }
    }

    // ── ロックと消去 ────────────────────────────────────────
    _lock() {
        const m = PIECES[this.current.name][this.current.rot];
        for (let r = 0; r < m.length; r++) {
            for (let c = 0; c < m[r].length; c++) {
                if (m[r][c]) {
                    const py = this.current.y + r;
                    if (py < 0) { this.over = true; }
                    this._set(this.current.x + c, py, this.current.name);
                }
            }
        }

        this.events.push({ f: this.frame, type: 'LOCK' });
        const isTSpin = this._checkTSpin();
        const cleared = this._clearLines();
        this._calculateScore(cleared, isTSpin);

        this.canHold = true;
        this.lockCounter = 0;
        this.lockResets = 0;
        this.waitingFrames = 12; // 次ミノ出現まで 0.2s
    }

    _checkTSpin() {
        if (this.current.name !== 'T' || !this.lastAction || this.lastAction.type !== 'rotate') return false;
        const { x, y } = this.current;
        const corners = [[x, y], [x + 2, y], [x, y + 2], [x + 2, y + 2]];
        let count = 0;
        for (const [cx, cy] of corners) {
            if (cx < 0 || cx >= COLS || cy >= ROWS || (cy >= -2 && this._get(cx, cy))) count++;
        }
        return count >= 3;
    }

    _clearLines() {
        let n = 0;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (this.board[r + 2].every(c => c !== null)) {
                this.board.splice(r + 2, 1);
                this.board.unshift(Array(COLS).fill(null));
                n++; r++;
            }
        }
        return n;
    }

    _calculateScore(cleared, isTSpin) {
        let pts = 0, garbage = 0, eventLabel = '';

        if (isTSpin) {
            pts = TS_POINTS[cleared] * this.level;
            garbage = [0, 2, 4, 6][cleared];
            eventLabel = `T-SPIN ${['','SINGLE','DOUBLE','TRIPLE'][cleared] || ''}`;
        } else if (cleared > 0) {
            pts = LS_POINTS[cleared] * this.level;
            garbage = [0, 0, 1, 2, 4][cleared];
            eventLabel = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'][cleared];
        }

        if (cleared > 0) {
            const isSpecial = isTSpin || cleared === 4;
            if (isSpecial) {
                if (this.b2b) { pts *= 1.5; garbage += 1; eventLabel += ' B2B'; }
                this.b2b = true;
            } else { this.b2b = false; }

            this.combo++;
            if (this.combo > 1) {
                pts += 50 * (this.combo - 1);
                garbage += Math.floor(this.combo / 2);
                eventLabel += ` x${this.combo}`;
            }
        } else {
            this.combo = 0;
        }

        // 相殺処理
        if (this.pendGarb > 0 && garbage > 0) {
            const offset = Math.min(this.pendGarb, garbage);
            this.pendGarb -= offset;
            garbage -= offset;
        }

        // おじゃまミノのせり上がり (攻撃を受けていて、かつミノ設置時にライン消去がなかった場合)
        if (cleared === 0 && this.pendGarb > 0) {
            this._applyGarbage(this.pendGarb);
            this.pendGarb = 0;
        }

        this.score += Math.floor(pts);
        this.lines += cleared;
        this.level = Math.floor(this.lines / 10) + 1;

        if (eventLabel) {
            this.events.push({ f: this.frame, type: 'clear', label: eventLabel, garbage });
        }
    }

    _applyGarbage(n) {
        for (let i = 0; i < n; i++) {
            this.board.shift();
            const row = Array(COLS).fill('G');
            // 決定論的ホール生成
            if (this.rng.next() < 0.1) { // 10%の確率でホールの位置を変更
                this.garbageHole = this.rng.nextInt(0, COLS - 1);
            }
            row[this.garbageHole] = null;
            this.board.push(row);
        }
    }


    getGhostY() {
        let gy = this.current.y;
        while (this._isValid(this.current, 0, gy - this.current.y + 1)) gy++;
        return gy;
    }

    getPieceCells(p = this.current, dx = 0, dy = 0) {
        const m = PIECES[p.name][p.rot];
        const cells = [];
        for (let r = 0; r < m.length; r++) {
            for (let c = 0; c < m[r].length; c++) {
                if (m[r][c]) cells.push([p.x + c + dx, p.y + r + dy]);
            }
        }
        return cells;
    }

    // ── 状態管理 (Rollback/Replay 用) ─────────────────────
    getState() {
        return JSON.parse(JSON.stringify({
            board: this.board,
            current: this.current,
            held: this.held,
            canHold: this.canHold,
            score: this.score,
            lines: this.lines,
            level: this.level,
            combo: this.combo,
            b2b: this.b2b,
            over: this.over,
            frame: this.frame,
            pieceCount: this.pieceCount,
            pendGarb: this.pendGarb,
            garbageHole: this.garbageHole,
            rngState: this.rng.state,
            waitingFrames: this.waitingFrames
        }));
    }

    setState(s) {
        this.board = s.board;
        this.current = s.current;
        this.held = s.held;
        this.canHold = s.canHold;
        this.score = s.score;
        this.lines = s.lines;
        this.level = s.level;
        this.combo = s.combo;
        this.b2b = s.b2b;
        this.over = s.over;
        this.frame = s.frame;
        this.pieceCount = s.pieceCount;
        this.pendGarb = s.pendGarb;
        this.garbageHole = s.garbageHole;
        this.rng.state = s.rngState;
        this.waitingFrames = s.waitingFrames;
    }
}
