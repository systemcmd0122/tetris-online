"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { ref, set, get, onValue, off, update, remove, onDisconnect } from "firebase/database";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, firestore } from "@/lib/firebase";
import { APP_VERSION } from "@/lib/config";

// Constants
const COLS = 10, ROWS = 20, CELL = 20;
const COLORS: Record<string, string> = {
  I: '#00f5ff', O: '#ffff00', T: '#cc00ff', S: '#aaff00',
  Z: '#ff0040', J: '#0066ff', L: '#ff8800', GHOST: 'rgba(255,255,255,0.10)'
};

const PIECES: Record<string, number[][][][]> = {
  I: [[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],[[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],[[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],[[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]]],
  O: [[[1,1],[1,1]],[[1,1],[1,1]],[[1,1],[1,1]],[[1,1],[1,1]]],
  T: [[[0,1,0],[1,1,1],[0,0,0]],[[0,1,0],[0,1,1],[0,1,0]],[[0,0,0],[1,1,1],[0,1,0]],[[0,1,0],[1,1,0],[0,1,0]]],
  S: [[[0,1,1],[1,1,0],[0,0,0]],[[0,1,0],[0,1,1],[0,0,1]],[[0,0,0],[0,1,1],[1,1,0]],[[1,0,0],[1,1,0],[0,1,0]]],
  Z: [[[1,1,0],[0,1,1],[0,0,0]],[[0,0,1],[0,1,1],[0,1,0]],[[0,0,0],[1,1,0],[0,1,1]],[[0,1,0],[1,1,0],[1,0,0]]],
  J: [[[1,0,0],[1,1,1],[0,0,0]],[[0,1,1],[0,1,0],[0,1,0]],[[0,0,0],[1,1,1],[0,0,1]],[[0,1,0],[0,1,0],[1,1,0]]],
  L: [[[0,0,1],[1,1,1],[0,0,0]],[[0,1,0],[0,1,0],[0,1,1]],[[0,0,0],[1,1,1],[1,0,0]],[[1,1,0],[0,1,0],[0,1,0]]]
};

const NAMES = Object.keys(PIECES);
const LINE_SCORES = [0, 100, 300, 500, 800];
const LOCK_DELAY = 500;
const MAX_RESETS = 15;

const KICKS_JLSTZ: Record<string, number[][]> = {
  '0->R':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],'R->0':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
  'R->2':[[0,0],[1,0],[1,-1],[0,2],[1,2]],'2->R':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '2->L':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],'L->2':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  'L->0':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],'0->L':[[0,0],[1,0],[1,1],[0,-2],[1,-2]]
};
const KICKS_I: Record<string, number[][]> = {
  '0->R':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],'R->0':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  'R->2':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],'2->R':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  '2->L':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],'L->2':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  'L->0':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],'0->L':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]]
};
const ROT_NAMES = ['0', 'R', '2', 'L'];

// Sound Engine
let audioCtx: AudioContext | null = null;
const getAudioCtx = () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioCtx;
};

const playSound = (type: string, enabled: boolean) => {
  if (!enabled) return;
  try {
    const ctx = getAudioCtx();
    const g = ctx.createGain();
    g.connect(ctx.destination);
    const o = ctx.createOscillator();
    o.connect(g);
    const now = ctx.currentTime;
    
    switch(type) {
      case 'move':
        o.frequency.setValueAtTime(220, now);
        g.gain.setValueAtTime(0.03, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        o.start(now);
        o.stop(now + 0.05);
        break;
      case 'rotate':
        o.frequency.setValueAtTime(330, now);
        o.frequency.exponentialRampToValueAtTime(440, now + 0.06);
        g.gain.setValueAtTime(0.05, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        o.start(now);
        o.stop(now + 0.06);
        break;
      case 'lock':
        o.type = 'square';
        o.frequency.setValueAtTime(180, now);
        g.gain.setValueAtTime(0.06, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        o.start(now);
        o.stop(now + 0.08);
        break;
      case 'clear1':
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(440, now);
        o.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        o.start(now);
        o.stop(now + 0.15);
        break;
      case 'tetris':
        [440, 554, 659, 880].forEach((f, i) => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2);
          g2.connect(ctx.destination);
          o2.frequency.setValueAtTime(f, now + i * 0.07);
          g2.gain.setValueAtTime(0.1, now + i * 0.07);
          g2.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.15);
          o2.start(now + i * 0.07);
          o2.stop(now + i * 0.07 + 0.15);
        });
        break;
      case 'harddrop':
        o.type = 'square';
        o.frequency.setValueAtTime(160, now);
        o.frequency.exponentialRampToValueAtTime(80, now + 0.1);
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        o.start(now);
        o.stop(now + 0.1);
        break;
      case 'attack':
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(660, now);
        o.frequency.exponentialRampToValueAtTime(110, now + 0.25);
        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        o.start(now);
        o.stop(now + 0.25);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2);
          g2.connect(ctx.destination);
          o2.type = 'triangle';
          o2.frequency.setValueAtTime(f, now + i * 0.12);
          g2.gain.setValueAtTime(0.12, now + i * 0.12);
          g2.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);
          o2.start(now + i * 0.12);
          o2.stop(now + i * 0.12 + 0.3);
        });
        break;
      case 'countdown':
        o.type = 'triangle';
        o.frequency.setValueAtTime(880, now);
        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        o.start(now);
        o.stop(now + 0.2);
        break;
      case 'go':
        [880, 1320].forEach((f, i) => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2);
          g2.connect(ctx.destination);
          o2.type = 'triangle';
          o2.frequency.setValueAtTime(f, now + i * 0.08);
          g2.gain.setValueAtTime(0.18, now + i * 0.08);
          g2.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
          o2.start(now + i * 0.08);
          o2.stop(now + i * 0.08 + 0.25);
        });
        break;
    }
  } catch (e) { /* ignore */ }
};

// Bag class for 7-bag randomizer
class Bag {
  q: string[] = [];
  _refill() {
    const b = [...NAMES];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    this.q.push(...b);
  }
  next() {
    if (this.q.length < 4) this._refill();
    return this.q.shift()!;
  }
  peek(n = 1) {
    while (this.q.length < n + 4) this._refill();
    return this.q.slice(0, n);
  }
}

interface Piece {
  name: string;
  rot: number;
  x: number;
  y: number;
}

interface GameResult {
  cleared: number;
  garbageOut: number;
  actionLabel: string;
}

// TetrisGame class
class TetrisGame {
  board: (string | null)[][];
  bag: Bag;
  current: Piece;
  heldPiece: string | null = null;
  canHold = true;
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  b2b = false;
  gameOver = false;
  dropSpeed = 800;
  lastDropTs = 0;
  lockTimer: number | null = null;
  lockResets = 0;
  isOnGround = false;
  isWaitingNext = false;
  nextSpawnTs = 0;
  boardDirty = true;
  pendingGarbage = 0;
  results: GameResult[] = [];
  soundEnabled = true;
  
  constructor() {
    this.board = Array.from({ length: ROWS + 2 }, () => Array(COLS).fill(null));
    this.bag = new Bag();
    this.current = this.makePiece(this.bag.next());
  }
  
  makePiece(name: string): Piece {
    return { name, rot: 0, x: 3, y: -1 };
  }
  
  reset() {
    this.board = Array.from({ length: ROWS + 2 }, () => Array(COLS).fill(null));
    this.bag = new Bag();
    this.current = this.makePiece(this.bag.next());
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
    this.pendingGarbage = 0;
    this.results = [];
  }
  
  _get(x: number, y: number) {
    if (x < 0 || x >= COLS || y < -2 || y >= ROWS) return y >= ROWS ? 'WALL' : null;
    return this.board[y + 2][x];
  }
  
  _set(x: number, y: number, v: string | null) {
    if (y < -2 || y >= ROWS || x < 0 || x >= COLS) return;
    this.board[y + 2][x] = v;
    this.boardDirty = true;
  }
  
  matrix(p: Piece = this.current) {
    return PIECES[p.name][p.rot];
  }
  
  cells(p: Piece = this.current) {
    const m = this.matrix(p);
    const out: { x: number; y: number }[] = [];
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c]) out.push({ x: p.x + c, y: p.y + r });
      }
    }
    return out;
  }
  
  valid(p: Piece = this.current) {
    for (const { x, y } of this.cells(p)) {
      if (x < 0 || x >= COLS || y >= ROWS) return false;
      if (y >= -2 && this._get(x, y)) return false;
    }
    return true;
  }
  
  move(dx: number) {
    const np = { ...this.current, x: this.current.x + dx };
    if (this.valid(np)) {
      this.current = np;
      this._resetLock();
      playSound('move', this.soundEnabled);
      return true;
    }
    return false;
  }
  
  rotate(dir: number) {
    const np = { ...this.current, rot: (this.current.rot + dir + 4) % 4 };
    const fromR = ROT_NAMES[this.current.rot];
    const toR = ROT_NAMES[np.rot];
    const kickKey = `${fromR}->${toR}`;
    const kicks = this.current.name === 'I' ? KICKS_I[kickKey] : KICKS_JLSTZ[kickKey];
    if (!kicks) return false;
    for (const [dx, dy] of kicks) {
      const test = { ...np, x: np.x + dx, y: np.y - dy };
      if (this.valid(test)) {
        this.current = test;
        this._resetLock();
        playSound('rotate', this.soundEnabled);
        return true;
      }
    }
    return false;
  }
  
  softDrop() {
    const np = { ...this.current, y: this.current.y + 1 };
    if (this.valid(np)) {
      this.current = np;
      this.score += 1;
      return true;
    }
    return false;
  }
  
  hardDrop() {
    let dist = 0;
    while (this.valid({ ...this.current, y: this.current.y + 1 })) {
      this.current.y++;
      dist++;
    }
    this.score += dist * 2;
    playSound('harddrop', this.soundEnabled);
    this._lock();
  }
  
  hold() {
    if (!this.canHold) return;
    playSound('rotate', this.soundEnabled);
    if (this.heldPiece) {
      const tmp = this.heldPiece;
      this.heldPiece = this.current.name;
      this.current = this.makePiece(tmp);
    } else {
      this.heldPiece = this.current.name;
      this.current = this.makePiece(this.bag.next());
    }
    this.canHold = false;
    this._cancelLock();
    this.lastDropTs = performance.now();
  }
  
  _resetLock() {
    if (this.isOnGround && this.lockResets < MAX_RESETS) {
      this.lockResets++;
      this.lockTimer = performance.now();
    }
  }
  
  _cancelLock() {
    this.lockTimer = null;
    this.lockResets = 0;
    this.isOnGround = false;
  }
  
  _lock() {
    for (const { x, y } of this.cells()) {
      this._set(x, y, this.current.name);
    }
    playSound('lock', this.soundEnabled);
    this._clearLines();
    this._spawnNext();
  }
  
  _clearLines() {
    const full: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      if (this.board[r + 2].every(c => c !== null)) full.push(r);
    }
    if (full.length === 0) {
      this.combo = 0;
      if (this.pendingGarbage > 0) this._addGarbage();
      return;
    }
    
    const cleared = full.length;
    this.lines += cleared;
    this.level = Math.floor(this.lines / 10) + 1;
    this.dropSpeed = Math.max(100, 800 - (this.level - 1) * 60);
    
    let base = LINE_SCORES[cleared] * this.level;
    let garbOut = [0, 0, 1, 2, 4][cleared];
    const isTetris = cleared === 4;
    
    if (this.combo > 0) {
      garbOut += Math.floor(this.combo / 2);
    }
    
    if (isTetris) {
      if (this.b2b) {
        base = Math.floor(base * 1.5);
        garbOut = Math.floor(garbOut * 1.5);
      }
      this.b2b = true;
    } else {
      this.b2b = false;
    }
    
    this.score += base + this.combo * 50;
    this.combo++;
    
    // Cancel incoming garbage
    if (garbOut > 0 && this.pendingGarbage > 0) {
      const cancel = Math.min(garbOut, this.pendingGarbage);
      garbOut -= cancel;
      this.pendingGarbage -= cancel;
    }
    
    // Remove cleared lines
    for (const r of full) {
      this.board.splice(r + 2, 1);
      this.board.unshift(Array(COLS).fill(null));
    }
    this.boardDirty = true;
    
    // Add garbage after clear
    if (this.pendingGarbage > 0) this._addGarbage();
    
    // Sound and result
    if (cleared === 4) playSound('tetris', this.soundEnabled);
    else playSound('clear1', this.soundEnabled);
    
    let label = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'][cleared];
    if (this.combo > 1) label += `\n${this.combo} COMBO`;
    if (this.b2b && isTetris) label += '\nB2B';
    
    this.results.push({ cleared, garbageOut: garbOut, actionLabel: label });
  }
  
  _addGarbage() {
    const n = this.pendingGarbage;
    this.pendingGarbage = 0;
    const gap = Math.floor(Math.random() * COLS);
    for (let i = 0; i < n; i++) {
      this.board.shift();
      const row = Array(COLS).fill('G');
      row[gap] = null;
      this.board.push(row);
    }
    this.boardDirty = true;
  }
  
  _spawnNext() {
    this.isWaitingNext = true;
    this.nextSpawnTs = performance.now() + 200;
  }
  
  _doSpawn() {
    this.current = this.makePiece(this.bag.next());
    this.canHold = true;
    this._cancelLock();
    this.isWaitingNext = false;
    
    if (!this.valid()) {
      this.gameOver = true;
    }
  }
  
  ghostY() {
    let gy = this.current.y;
    while (this.valid({ ...this.current, y: gy + 1 })) gy++;
    return gy;
  }
  
  update(ts: number) {
    if (this.gameOver) return;
    
    if (this.isWaitingNext) {
      if (ts >= this.nextSpawnTs) this._doSpawn();
      return;
    }
    
    // Gravity
    const onG = !this.valid({ ...this.current, y: this.current.y + 1 });
    if (onG) {
      this.isOnGround = true;
      if (this.lockTimer === null) this.lockTimer = ts;
      if (ts - this.lockTimer >= LOCK_DELAY) this._lock();
    } else {
      this.isOnGround = false;
      this.lockTimer = null;
      if (ts - this.lastDropTs >= this.dropSpeed) {
        this.current.y++;
        this.lastDropTs = ts;
      }
    }
  }
  
  draw(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, COLS * CELL, ROWS * CELL);
    
    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
    
    // Board
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.board[r + 2][c];
        if (!cell) continue;
        const color = cell === 'G' ? '#888888' : (COLORS[cell] || '#888');
        this._drawBlock(ctx, c * CELL, r * CELL, color);
      }
    }
    
    // Ghost
    if (!this.isWaitingNext) {
      const gy = this.ghostY();
      const m = this.matrix();
      ctx.globalAlpha = 0.15;
      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
          if (m[r][c]) {
            const py = gy + r;
            if (py >= 0) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect((this.current.x + c) * CELL + 2, py * CELL + 2, CELL - 4, CELL - 4);
            }
          }
        }
      }
      ctx.globalAlpha = 1;
      
      // Current piece
      const color = COLORS[this.current.name] || '#888';
      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
          if (m[r][c]) {
            const py = this.current.y + r;
            if (py >= 0) {
              this._drawBlock(ctx, (this.current.x + c) * CELL, py * CELL, color);
            }
          }
        }
      }
    }
    
    // Game over
    if (this.gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
      ctx.fillStyle = '#ff0080';
      ctx.font = 'bold 11px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', (COLS * CELL) / 2, (ROWS * CELL) / 2);
    }
  }
  
  _drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    ctx.fillStyle = color + 'cc';
    ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillRect(x + 1, y + 1, CELL - 2, 5);
    ctx.fillRect(x + 1, y + 1, 5, CELL - 2);
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(x + 2, y + CELL - 4, CELL - 3, 3);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
  }
  
  drawHold(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, 80, 80);
    if (!this.heldPiece) return;
    const m = PIECES[this.heldPiece][0];
    const color = COLORS[this.heldPiece];
    const ox = (80 - m[0].length * 18) / 2;
    const oy = (80 - m.length * 18) / 2;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c]) {
          ctx.fillStyle = color + 'cc';
          ctx.fillRect(ox + c * 18 + 1, oy + r * 18 + 1, 16, 16);
          ctx.fillStyle = 'rgba(255,255,255,.2)';
          ctx.fillRect(ox + c * 18 + 1, oy + r * 18 + 1, 16, 4);
        }
      }
    }
  }
  
  drawNext(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, 80, 80);
    const next = this.bag.peek(1)[0];
    if (!next) return;
    const m = PIECES[next][0];
    const color = COLORS[next];
    const ox = (80 - m[0].length * 18) / 2;
    const oy = (80 - m.length * 18) / 2;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c]) {
          ctx.fillStyle = color + 'cc';
          ctx.fillRect(ox + c * 18 + 1, oy + r * 18 + 1, 16, 16);
          ctx.fillStyle = 'rgba(255,255,255,.2)';
          ctx.fillRect(ox + c * 18 + 1, oy + r * 18 + 1, 16, 4);
        }
      }
    }
  }
  
  serialize() {
    return {
      board: this.board.slice(2),
      cur: this.current,
      score: this.score,
      level: this.level,
      lines: this.lines,
      gameOver: this.gameOver
    };
  }
}

// Bot AI Controller
const BOT_NAMES = ['BOT-EASY', 'BOT-NORMAL', 'BOT-HARD'];
let BOT_DELAYS = [250, 120, 40];
let BOT_NOISE = [0.12, 0.04, 0.0];

class BotController {
  game: TetrisGame;
  difficulty: number;
  actionDelay: number;
  noise: number;
  lastActionTs = 0;
  moveQueue: string[] = [];
  
  constructor(game: TetrisGame, difficulty: number = 2) {
    this.game = game;
    this.difficulty = difficulty;
    this.actionDelay = BOT_DELAYS[difficulty - 1];
    this.noise = BOT_NOISE[difficulty - 1];
  }
  
  _simulate(boardRows: (string | null)[][], pieceName: string, rot: number, startX: number) {
    const m = PIECES[pieceName][rot];
    if (!m) return null;
    
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c] && (startX + c < 0 || startX + c >= COLS)) return null;
      }
    }
    
    let py = -2;
    let stopped = false;
    while (!stopped) {
      py++;
      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
          if (!m[r][c]) continue;
          const ny = py + r;
          const nx = startX + c;
          if (ny >= ROWS) { py--; stopped = true; break; }
          if (ny >= 0 && boardRows[ny][nx]) { py--; stopped = true; break; }
        }
        if (stopped) break;
      }
      if (py > ROWS) return null;
    }
    
    const nb = boardRows.map(r => [...r]);
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c]) {
          const ny = py + r;
          const nx = startX + c;
          if (ny < 0 || ny >= ROWS) return null;
          nb[ny][nx] = pieceName;
        }
      }
    }
    
    let cleared = 0;
    const filt = nb.filter(row => !row.every(c => c !== null));
    cleared = ROWS - filt.length;
    while (filt.length < ROWS) filt.unshift(new Array(COLS).fill(null));
    
    const heights = new Array(COLS).fill(0);
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS; row++) {
        if (filt[row][col]) { heights[col] = ROWS - row; break; }
      }
    }
    
    const aH = heights.reduce((a, b) => a + b, 0);
    let holes = 0;
    for (let col = 0; col < COLS; col++) {
      let found = false;
      for (let row = 0; row < ROWS; row++) {
        if (filt[row][col]) found = true;
        else if (found) holes++;
      }
    }
    
    let bump = 0;
    for (let col = 0; col < COLS - 1; col++) {
      bump += Math.abs(heights[col] - heights[col + 1]);
    }
    
    const clearedWeight = cleared === 4 ? 12.0 : (cleared * 1.5);
    const score = -0.51 * aH + clearedWeight - 0.40 * holes - 0.20 * bump;
    
    return { score, aH, cleared, holes, bump, clearedWeight, nb: filt };
  }
  
  findBestMove() {
    const board = this.game.board.slice(2).map(r => r.map(c => c || null));
    const bag = this.game.bag;
    const canHold = this.game.canHold;
    
    const evaluate = (pName: string, nName: string, isHold: boolean) => {
      let bestS = -Infinity, bestR = 0, bestX = 3, bestRes: any = null;
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
          totalS += (Math.random() * 2 - 1) * this.noise * 4;
          if (totalS > bestS) { bestS = totalS; bestR = r; bestX = x; bestRes = res; }
        }
      }
      return { score: bestS, rot: bestR, x: bestX, res: bestRes, isHold };
    };
    
    const curEval = evaluate(this.game.current.name, bag.peek(1)[0], false);
    let bestEval = curEval;
    
    if (canHold) {
      let hName: string, nName: string;
      if (this.game.heldPiece) {
        hName = this.game.heldPiece;
        nName = bag.peek(1)[0];
      } else {
        hName = bag.peek(1)[0];
        nName = bag.peek(2)[1];
      }
      const holdEval = evaluate(hName, nName, true);
      if (holdEval.score > curEval.score) bestEval = holdEval;
    }
    
    return { x: bestEval.x, rot: bestEval.rot, score: bestEval.score, hold: bestEval.isHold };
  }
  
  planMoves(targetRot: number, targetX: number) {
    const moves: string[] = [];
    const curRot = this.game.current.rot;
    const curX = this.game.current.x;
    const rd = ((targetRot - curRot) + 4) % 4;
    if (rd === 1) moves.push('rr');
    else if (rd === 2) { moves.push('rr'); moves.push('rr'); }
    else if (rd === 3) moves.push('rl');
    const dx = targetX - curX;
    const dir = dx > 0 ? 'mr' : 'ml';
    for (let i = 0; i < Math.abs(dx); i++) moves.push(dir);
    moves.push('hd');
    return moves;
  }
  
  tick(ts: number) {
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
}

// Draw opponent board
function drawOpponentBoard(canvas: HTMLCanvasElement, data: any) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !data) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 0.5;
  
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
    }
  }
  
  if (data.board) {
    data.board.forEach((row: any[], r: number) => {
      row.forEach((cell: string | null, c: number) => {
        if (!cell) return;
        const color = cell === 'G' ? '#888888' : (COLORS[cell] || '#888');
        ctx.fillStyle = color + 'cc';
        ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = 'rgba(255,255,255,.15)';
        ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, 3);
      });
    });
  }
  
  if (data.cur && PIECES[data.cur.name]) {
    const m = PIECES[data.cur.name][data.cur.rot || 0];
    const color = COLORS[data.cur.name] || '#888';
    m.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell) {
          const py = data.cur.y + r;
          if (py >= 0) {
            ctx.fillStyle = color + '99';
            ctx.fillRect((data.cur.x + c) * CELL + 1, py * CELL + 1, CELL - 2, CELL - 2);
          }
        }
      });
    });
  }
  
  if (data.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff0080';
    ctx.font = 'bold 11px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
  }
}

// Main Component
export default function TetrisBattlePage() {
  const [screen, setScreen] = useState<'lobby' | 'waiting' | 'game'>('lobby');
  const [playerName, setPlayerName] = useState('PLAYER');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [displayRoomCode, setDisplayRoomCode] = useState('----');
  const [oppName, setOppName] = useState('FOE');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showBotDifficulty, setShowBotDifficulty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadText, setLoadText] = useState('INITIALIZING');
  
  // Game state
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [combo, setCombo] = useState(0);
  const [b2b, setB2b] = useState(false);
  const [atkSent, setAtkSent] = useState(0);
  const [atkRecv, setAtkRecv] = useState(0);
  const [pendingGarbage, setPendingGarbage] = useState(0);
  
  // Overlays
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownNum, setCountdownNum] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [resultTitle, setResultTitle] = useState('');
  const [resultClass, setResultClass] = useState('');
  const [showForceStop, setShowForceStop] = useState(false);
  const [forceStopMsg, setForceStopMsg] = useState('');
  const [showMatchFlash, setShowMatchFlash] = useState(false);
  const [actionPopup, setActionPopup] = useState('');
  const [showAttackBadge, setShowAttackBadge] = useState(false);
  const [attackBadgeText, setAttackBadgeText] = useState('+0');
  
  // Stats for result
  const [statMaxCombo, setStatMaxCombo] = useState(0);
  const [statTetris, setStatTetris] = useState(0);
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holdCanvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);
  const oppCanvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TetrisGame | null>(null);
  const botGameRef = useRef<TetrisGame | null>(null);
  const botCtrlRef = useRef<BotController | null>(null);
  const animIdRef = useRef<number | null>(null);
  const gameRunningRef = useRef(false);
  const botModeRef = useRef(false);
  const myRoleRef = useRef<string | null>(null);
  const roomCodeRef = useRef<string | null>(null);
  const listenersRef = useRef<any>({});
  const endedOnceRef = useRef(false);
  const forceStoppedRef = useRef(false);
  const serverTimeOffsetRef = useRef(0);
  
  const getServerTime = () => Date.now() + serverTimeOffsetRef.current;
  const genCode = () => Math.floor(1000 + Math.random() * 9000).toString();
  
  // Loading animation
  useEffect(() => {
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setLoadProgress(step);
      if (step === 4) setLoadText('CONNECTING...');
      if (step === 8) setLoadText('READY!');
      if (step >= 10) {
        clearInterval(interval);
        setTimeout(() => setLoading(false), 150);
      }
    }, 55 + Math.random() * 75);
    return () => clearInterval(interval);
  }, []);
  
  // Server time offset
  useEffect(() => {
    const offsetRef = ref(db, '.info/serverTimeOffset');
    const unsub = onValue(offsetRef, (snap) => {
      serverTimeOffsetRef.current = snap.val() || 0;
    });
    return () => off(offsetRef);
  }, []);
  
  // Background animation
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const _C: Record<string, string> = { I: '#00f5ff', O: '#ffff00', T: '#cc00ff', S: '#aaff00', Z: '#ff0040', J: '#0066ff', L: '#ff8800' };
    const _N = Object.keys(_C);
    const CELL = 28;
    const PM: Record<string, number[][][]> = {
      I: [[[1, 1, 1, 1]], [[1], [1], [1], [1]]],
      O: [[[1, 1], [1, 1]]],
      T: [[[0, 1, 0], [1, 1, 1]], [[1, 0], [1, 1], [1, 0]]],
      S: [[[0, 1, 1], [1, 1, 0]]],
      Z: [[[1, 1, 0], [0, 1, 1]]],
      J: [[[1, 0, 0], [1, 1, 1]]],
      L: [[[0, 0, 1], [1, 1, 1]]]
    };
    
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    
    const pieces: any[] = [];
    const spawn = () => {
      const name = _N[Math.floor(Math.random() * _N.length)];
      const rots = PM[name];
      const mat = rots[Math.floor(Math.random() * rots.length)];
      return {
        mat, color: _C[name], x: Math.random() * W, y: -CELL * 4,
        vy: 0.4 + Math.random() * 1.2, rot: Math.random() * 360, vr: (Math.random() - 0.5) * 0.7,
        sc: 0.5 + Math.random() * 0.9, alpha: 0.1 + Math.random() * 0.4
      };
    };
    
    for (let i = 0; i < 18; i++) {
      const p = spawn();
      p.y = Math.random() * H;
      pieces.push(p);
    }
    
    const drawBlock = (bx: number, by: number, color: string) => {
      ctx.fillStyle = color + 'aa';
      ctx.fillRect(bx + 1, by + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = 'rgba(255,255,255,.2)';
      ctx.fillRect(bx + 1, by + 1, CELL - 2, 5);
      ctx.fillRect(bx + 1, by + 1, 5, CELL - 2);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(bx + 2, by + CELL - 4, CELL - 3, 3);
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.7;
      ctx.strokeRect(bx + 0.5, by + 0.5, CELL - 1, CELL - 1);
    };
    
    const handleResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    
    let animId: number;
    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      pieces.forEach((p, i) => {
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > H + CELL * p.sc * 4) pieces[i] = spawn();
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.scale(p.sc, p.sc);
        ctx.globalAlpha = p.alpha;
        const mw = p.mat[0].length, mh = p.mat.length;
        const ox = -mw * CELL / 2, oy = -mh * CELL / 2;
        p.mat.forEach((row: number[], r: number) => row.forEach((cell: number, c: number) => {
          if (cell) drawBlock(ox + c * CELL, oy + r * CELL, p.color);
        }));
        ctx.restore();
      });
      if (Math.random() < 0.012 && pieces.length < 22) pieces.push(spawn());
      animId = requestAnimationFrame(frame);
    };
    frame();
    
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);
  
  // Keyboard controls
  useEffect(() => {
    const DAS = 167, ARR = 33;
    let dasTimer: NodeJS.Timeout | null = null;
    let arrTimer: NodeJS.Timeout | null = null;
    let dasDir = 0;
    let softDropInterval: NodeJS.Timeout | null = null;
    const keys = new Set<string>();
    
    const dasStart = (dir: number) => {
      if (dasDir === dir) return;
      dasStop();
      dasDir = dir;
      gameRef.current?.move(dir);
      dasTimer = setTimeout(() => {
        arrTimer = setInterval(() => gameRef.current?.move(dir), ARR);
      }, DAS);
    };
    
    const dasStop = () => {
      if (dasTimer) clearTimeout(dasTimer);
      if (arrTimer) clearInterval(arrTimer);
      dasTimer = null;
      arrTimer = null;
      dasDir = 0;
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (keys.has(e.code)) return;
      keys.add(e.code);
      if (!gameRef.current || !gameRunningRef.current) return;
      
      switch (e.code) {
        case 'ArrowLeft': e.preventDefault(); dasStart(-1); break;
        case 'ArrowRight': e.preventDefault(); dasStart(1); break;
        case 'ArrowUp': e.preventDefault(); gameRef.current.rotate(1); break;
        case 'KeyX': e.preventDefault(); gameRef.current.rotate(1); break;
        case 'KeyZ': e.preventDefault(); gameRef.current.rotate(-1); break;
        case 'ArrowDown':
          e.preventDefault();
          gameRef.current.softDrop();
          softDropInterval = setInterval(() => {
            if (gameRef.current && gameRunningRef.current) gameRef.current.softDrop();
          }, 50);
          break;
        case 'Space': e.preventDefault(); gameRef.current.hardDrop(); break;
        case 'KeyC':
        case 'ShiftLeft':
        case 'ShiftRight':
          e.preventDefault();
          gameRef.current.hold();
          break;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
      if (e.code === 'ArrowLeft' && dasDir === -1) dasStop();
      if (e.code === 'ArrowRight' && dasDir === 1) dasStop();
      if (e.code === 'ArrowDown') {
        if (softDropInterval) clearInterval(softDropInterval);
        softDropInterval = null;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      dasStop();
      if (softDropInterval) clearInterval(softDropInterval);
    };
  }, []);
  
  const resetState = useCallback(() => {
    // Clean up listeners
    Object.values(listenersRef.current).forEach((r: any) => {
      if (r) try { off(r); } catch (e) { /* ignore */ }
    });
    listenersRef.current = {};
    
    gameRunningRef.current = false;
    forceStoppedRef.current = false;
    endedOnceRef.current = false;
    
    if (animIdRef.current) {
      cancelAnimationFrame(animIdRef.current);
      animIdRef.current = null;
    }
    
    roomCodeRef.current = null;
    myRoleRef.current = null;
    gameRef.current = null;
    botGameRef.current = null;
    botCtrlRef.current = null;
    botModeRef.current = false;
    
    setRoomCode(null);
    setScore(0);
    setLevel(1);
    setLines(0);
    setCombo(0);
    setB2b(false);
    setAtkSent(0);
    setAtkRecv(0);
    setPendingGarbage(0);
    setStatMaxCombo(0);
    setStatTetris(0);
  }, []);
  
  const clearBoards = useCallback(() => {
    [canvasRef, oppCanvasRef, holdCanvasRef, nextCanvasRef].forEach(ref => {
      if (ref.current) {
        const ctx = ref.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, ref.current.width, ref.current.height);
      }
    });
    setScore(0);
    setLevel(1);
    setLines(0);
    setCombo(0);
    setB2b(false);
    setAtkSent(0);
    setAtkRecv(0);
    setPendingGarbage(0);
    setStatMaxCombo(0);
    setStatTetris(0);
  }, []);
  
  const showActionPopupFn = useCallback((label: string) => {
    setActionPopup(label.replace('\n', ' / '));
    setTimeout(() => setActionPopup(''), 800);
  }, []);
  
  const countdown = useCallback((startAt: number): Promise<boolean> => {
    return new Promise(resolve => {
      setShowCountdown(true);
      setCountdownNum('');
      let resolved = false;
      
      const done = (aborted: boolean) => {
        if (resolved) return;
        resolved = true;
        setShowCountdown(false);
        resolve(aborted);
      };
      
      const abortIv = setInterval(() => {
        if (forceStoppedRef.current) {
          clearInterval(abortIv);
          done(true);
        }
      }, 100);
      
      [3, 2, 1, 0].forEach((n, i) => {
        const showAt = startAt - (3 - i) * 1000;
        const delay = Math.max(0, showAt - getServerTime());
        setTimeout(() => {
          if (resolved) return;
          setCountdownNum(n > 0 ? n.toString() : 'GO!');
          playSound(n > 0 ? 'countdown' : 'go', soundEnabled);
        }, delay);
      });
      
      const endDelay = Math.max(200, startAt - getServerTime() + 750);
      setTimeout(() => {
        clearInterval(abortIv);
        done(false);
      }, endDelay);
    });
  }, [soundEnabled]);
  
  const endGame = useCallback((result: string) => {
    if (endedOnceRef.current) return;
    endedOnceRef.current = true;
    gameRunningRef.current = false;
    
    if (animIdRef.current) {
      cancelAnimationFrame(animIdRef.current);
      animIdRef.current = null;
    }
    
    if (!botModeRef.current) {
      Object.values(listenersRef.current).forEach((r: any) => {
        if (r) try { off(r); } catch (e) { /* ignore */ }
      });
      listenersRef.current = {};
    }
    
    const finalScore = gameRef.current?.score || 0;
    const finalLevel = gameRef.current?.level || 1;
    const finalLines = gameRef.current?.lines || 0;
    
    if (result === 'WIN') {
      setResultTitle('YOU WIN!');
      setResultClass('win');
      playSound('win', soundEnabled);
      if (!botModeRef.current && roomCodeRef.current) {
        update(ref(db, `rooms/${roomCodeRef.current}`), { status: 'ended' }).catch(() => {});
      }
    } else if (result === 'LOSE') {
      setResultTitle('YOU LOSE');
      setResultClass('lose');
    } else if (result === 'DRAW') {
      setResultTitle('DRAW');
      setResultClass('draw');
    } else if (result === 'OPPONENT_LEFT') {
      setResultTitle('OPPONENT LEFT');
      setResultClass('draw');
      if (!botModeRef.current && myRoleRef.current === 'p1' && roomCodeRef.current) {
        remove(ref(db, `rooms/${roomCodeRef.current}`)).catch(() => {});
      }
    }
    
    setScore(finalScore);
    setLevel(finalLevel);
    setLines(finalLines);
    setShowResult(true);
  }, [soundEnabled]);
  
  const startBotGame = useCallback(async (difficulty: number) => {
    const name = (playerName.trim() || 'PLAYER').toUpperCase();
    botModeRef.current = true;
    endedOnceRef.current = false;
    forceStoppedRef.current = false;
    setShowBotDifficulty(false);
    setOppName(BOT_NAMES[difficulty - 1]);
    
    setScreen('game');
    clearBoards();
    
    const aborted = await countdown(getServerTime() + 4000);
    if (aborted) return;
    
    gameRef.current = new TetrisGame();
    gameRef.current.soundEnabled = soundEnabled;
    botGameRef.current = new TetrisGame();
    botGameRef.current.soundEnabled = false;
    botCtrlRef.current = new BotController(botGameRef.current, difficulty);
    gameRunningRef.current = true;
    endedOnceRef.current = false;
    
    let localAtkSent = 0;
    let localAtkRecv = 0;
    let localMaxCombo = 0;
    let localTetris = 0;
    
    const loop = (ts: number) => {
      if (!gameRunningRef.current) return;
      
      const game = gameRef.current!;
      const botGame = botGameRef.current!;
      const botCtrl = botCtrlRef.current!;
      
      game.update(ts);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) game.draw(ctx);
      }
      if (holdCanvasRef.current) {
        const ctx = holdCanvasRef.current.getContext('2d');
        if (ctx) game.drawHold(ctx);
      }
      if (nextCanvasRef.current) {
        const ctx = nextCanvasRef.current.getContext('2d');
        if (ctx) game.drawNext(ctx);
      }
      
      botCtrl.tick(ts);
      botGame.update(ts);
      if (oppCanvasRef.current) {
        const ctx = oppCanvasRef.current.getContext('2d');
        if (ctx) botGame.draw(ctx);
      }
      
      // Process my results
      while (game.results.length > 0) {
        const res = game.results.shift()!;
        if (res.garbageOut > 0) {
          localAtkSent += res.garbageOut;
          botGame.pendingGarbage += res.garbageOut;
        }
        if (res.cleared === 4) localTetris++;
        if (res.actionLabel) showActionPopupFn(res.actionLabel);
      }
      
      // Process bot results
      while (botGame.results.length > 0) {
        const res = botGame.results.shift()!;
        if (res.garbageOut > 0) {
          game.pendingGarbage += res.garbageOut;
          localAtkRecv += res.garbageOut;
          setAttackBadgeText(`+${res.garbageOut}`);
          setShowAttackBadge(true);
          setTimeout(() => setShowAttackBadge(false), 1200);
          playSound('attack', soundEnabled);
        }
      }
      
      // Update UI
      setScore(game.score);
      setLevel(game.level);
      setLines(game.lines);
      setCombo(game.combo);
      setB2b(game.b2b);
      setPendingGarbage(game.pendingGarbage);
      setAtkSent(localAtkSent);
      setAtkRecv(localAtkRecv);
      if (game.combo > localMaxCombo) {
        localMaxCombo = game.combo;
        setStatMaxCombo(localMaxCombo);
      }
      setStatTetris(localTetris);
      
      if (game.gameOver && !endedOnceRef.current) {
        endGame('LOSE');
        return;
      }
      if (botGame.gameOver && !game.gameOver && !endedOnceRef.current) {
        endGame('WIN');
        return;
      }
      if (game.gameOver && botGame.gameOver && !endedOnceRef.current) {
        endGame('DRAW');
        return;
      }
      
      animIdRef.current = requestAnimationFrame(loop);
    };
    
    animIdRef.current = requestAnimationFrame(loop);
  }, [playerName, clearBoards, countdown, soundEnabled, showActionPopupFn, endGame]);
  
  const createRoom = useCallback(async () => {
    const name = (playerName.trim() || 'PLAYER').toUpperCase();
    myRoleRef.current = 'p1';
    const code = genCode();
    roomCodeRef.current = code;
    endedOnceRef.current = false;
    forceStoppedRef.current = false;
    
    const rRef = ref(db, `rooms/${code}`);
    await set(rRef, { p1: { name }, status: 'waiting', ts: getServerTime() });
    onDisconnect(rRef).remove();
    
    setScreen('waiting');
    setDisplayRoomCode(code);
    setRoomCode(code);
    
    const waitRef = ref(db, `rooms/${code}`);
    listenersRef.current.wait = waitRef;
    
    onValue(waitRef, (snap) => {
      const d = snap.val();
      if (!d) {
        if (!forceStoppedRef.current && !endedOnceRef.current) {
          off(waitRef);
          listenersRef.current.wait = null;
          setScreen('lobby');
        }
        return;
      }
      if (d.status === 'force_ended' && !forceStoppedRef.current) {
        off(waitRef);
        listenersRef.current.wait = null;
        forceStoppedRef.current = true;
        setForceStopMsg(d.forceMsg || 'Room was terminated');
        setShowForceStop(true);
        return;
      }
      if (d.status === 'ready' && !endedOnceRef.current && !forceStoppedRef.current) {
        off(waitRef);
        listenersRef.current.wait = null;
        startOnlineGame(d);
      }
    });
  }, [playerName]);
  
  const joinRoom = useCallback(async () => {
    const code = roomCodeInput.trim().toUpperCase();
    if (code.length !== 4 || !/^[0-9]{4}$/.test(code)) {
      alert('Please enter a 4-digit room code');
      return;
    }
    const name = (playerName.trim() || 'PLAYER2').toUpperCase();
    const rRef = ref(db, `rooms/${code}`);
    let snap;
    try { snap = await get(rRef); } catch (e) { alert('Connection error'); return; }
    if (!snap.exists()) { alert('Room not found'); return; }
    const d = snap.val();
    if (d.status === 'force_ended') { alert('Room was terminated'); return; }
    if (d.status !== 'waiting') { alert('Room is full or already started'); return; }
    
    myRoleRef.current = 'p2';
    roomCodeRef.current = code;
    endedOnceRef.current = false;
    forceStoppedRef.current = false;
    
    const gameStartAt = getServerTime() + 4800;
    await update(rRef, { p2: { name }, status: 'ready', gameStartAt });
    onDisconnect(rRef).remove();
    
    setRoomCode(code);
    startOnlineGame({ ...d, p2: { name }, gameStartAt });
  }, [roomCodeInput, playerName]);
  
  const startOnlineGame = useCallback(async (preloadedData: any) => {
    setScreen('game');
    clearBoards();
    
    const oppRole = myRoleRef.current === 'p1' ? 'p2' : 'p1';
    let data = preloadedData;
    
    if (!data) {
      let snap;
      try { snap = await get(ref(db, `rooms/${roomCodeRef.current}`)); }
      catch (e) { setScreen('lobby'); return; }
      data = snap?.val();
    }
    
    if (!data) { setScreen('lobby'); return; }
    if (data.status === 'force_ended') {
      forceStoppedRef.current = true;
      setForceStopMsg(data.forceMsg || 'Room was terminated');
      setShowForceStop(true);
      return;
    }
    
    const myName = data[myRoleRef.current!]?.name || 'YOU';
    const oppNameVal = data[oppRole]?.name || 'FOE';
    setOppName(oppNameVal);
    
    // Show match flash
    setShowMatchFlash(true);
    setTimeout(() => setShowMatchFlash(false), 2000);
    
    // Watch for force stop
    const roomRef = ref(db, `rooms/${roomCodeRef.current}`);
    listenersRef.current.room = roomRef;
    onValue(roomRef, (snap) => {
      const d = snap.val();
      if (!d) {
        if (!endedOnceRef.current && !forceStoppedRef.current) endGame('OPPONENT_LEFT');
        return;
      }
      if (d.status === 'force_ended' && !forceStoppedRef.current) {
        off(roomRef);
        listenersRef.current.room = null;
        forceStoppedRef.current = true;
        setForceStopMsg(d.forceMsg || 'Room was terminated');
        setShowForceStop(true);
        return;
      }
      if (!endedOnceRef.current && !forceStoppedRef.current) {
        if (myRoleRef.current === 'p1' && d.status === 'p2_left') { endGame('OPPONENT_LEFT'); return; }
        if (myRoleRef.current === 'p2' && d.status === 'p1_left') { endGame('OPPONENT_LEFT'); return; }
        if (d.status === 'ended' && !endedOnceRef.current) { /* winner already set */ }
      }
    });
    
    // Countdown
    const startAt = data.gameStartAt || (getServerTime() + 4000);
    const aborted = await countdown(startAt);
    if (aborted) return;
    
    gameRef.current = new TetrisGame();
    gameRef.current.soundEnabled = soundEnabled;
    gameRunningRef.current = true;
    endedOnceRef.current = false;
    
    let localAtkSent = 0;
    let localAtkRecv = 0;
    let localMaxCombo = 0;
    let localTetris = 0;
    
    // Watch opponent board
    const oppRef = ref(db, `rooms/${roomCodeRef.current}/game/${oppRole}`);
    listenersRef.current.opp = oppRef;
    onValue(oppRef, (snap) => {
      const d = snap.val();
      if (!d) return;
      if (oppCanvasRef.current) drawOpponentBoard(oppCanvasRef.current, d);
      if (d.gameOver && !gameRef.current?.gameOver && gameRunningRef.current && !endedOnceRef.current) {
        endGame('WIN');
      }
    });
    
    // Watch incoming garbage
    const myGRef = ref(db, `rooms/${roomCodeRef.current}/garb/${myRoleRef.current}`);
    listenersRef.current.garb = myGRef;
    onValue(myGRef, (snap) => {
      const v = snap.val();
      if (!v || !v.n || !gameRef.current) return;
      if (v.n > 0) {
        localAtkRecv += v.n;
        setAtkRecv(localAtkRecv);
        gameRef.current.pendingGarbage += v.n;
        set(myGRef, { n: 0 });
        setAttackBadgeText(`+${v.n}`);
        setShowAttackBadge(true);
        setTimeout(() => setShowAttackBadge(false), 1200);
        playSound('attack', soundEnabled);
      }
    });
    
    const oppGRef = ref(db, `rooms/${roomCodeRef.current}/garb/${oppRole}`);
    let lastPushTs = 0;
    let pendingGarbageOut = 0;
    const PUSH_RATE = 50;
    
    const loop = (ts: number) => {
      if (!gameRunningRef.current) return;
      
      const game = gameRef.current!;
      
      game.update(ts);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) game.draw(ctx);
      }
      if (holdCanvasRef.current) {
        const ctx = holdCanvasRef.current.getContext('2d');
        if (ctx) game.drawHold(ctx);
      }
      if (nextCanvasRef.current) {
        const ctx = nextCanvasRef.current.getContext('2d');
        if (ctx) game.drawNext(ctx);
      }
      
      // Process results
      while (game.results.length > 0) {
        const res = game.results.shift()!;
        if (res.garbageOut > 0) {
          localAtkSent += res.garbageOut;
          pendingGarbageOut += res.garbageOut;
        }
        if (res.cleared === 4) localTetris++;
        if (res.actionLabel) showActionPopupFn(res.actionLabel);
      }
      
      // Update UI
      setScore(game.score);
      setLevel(game.level);
      setLines(game.lines);
      setCombo(game.combo);
      setB2b(game.b2b);
      setPendingGarbage(game.pendingGarbage);
      setAtkSent(localAtkSent);
      if (game.combo > localMaxCombo) {
        localMaxCombo = game.combo;
        setStatMaxCombo(localMaxCombo);
      }
      setStatTetris(localTetris);
      
      // Push to Firebase
      if (ts - lastPushTs > PUSH_RATE) {
        lastPushTs = ts;
        set(ref(db, `rooms/${roomCodeRef.current}/game/${myRoleRef.current}`), game.serialize()).catch(() => {});
        if (pendingGarbageOut > 0) {
          const gn = pendingGarbageOut;
          pendingGarbageOut = 0;
          get(oppGRef).then(s => {
            const ex = s.val()?.n || 0;
            set(oppGRef, { n: ex + gn }).catch(() => {});
          });
        }
      }
      
      if (game.gameOver) {
        set(ref(db, `rooms/${roomCodeRef.current}/game/${myRoleRef.current}`), game.serialize()).catch(() => {});
        endGame('LOSE');
        return;
      }
      
      animIdRef.current = requestAnimationFrame(loop);
    };
    
    animIdRef.current = requestAnimationFrame(loop);
  }, [clearBoards, countdown, soundEnabled, showActionPopupFn, endGame]);
  
  const leaveRoom = useCallback(async () => {
    const code = roomCodeRef.current;
    const wasBot = botModeRef.current;
    
    setShowResult(false);
    setShowForceStop(false);
    setShowCountdown(false);
    resetState();
    
    if (!wasBot && code) {
      try { await remove(ref(db, `rooms/${code}`)); } catch (e) { /* ignore */ }
    }
    
    setScreen('lobby');
  }, [resetState]);
  
  const cancelWaiting = useCallback(async () => {
    const code = roomCodeRef.current;
    
    if (listenersRef.current.wait) {
      try { off(listenersRef.current.wait); } catch (e) { /* ignore */ }
      listenersRef.current.wait = null;
    }
    
    resetState();
    
    if (code) {
      try { await remove(ref(db, `rooms/${code}`)); } catch (e) { /* ignore */ }
    }
    
    setScreen('lobby');
  }, [resetState]);
  
  const copyRoomCode = useCallback(() => {
    if (!roomCode) return;
    navigator.clipboard?.writeText(roomCode)
      .then(() => alert('Code copied!'))
      .catch(() => alert(`Room Code: ${roomCode}`));
  }, [roomCode]);
  
  // Mobile controls
  const handleMobileMove = useCallback((dir: number) => {
    if (!gameRef.current || !gameRunningRef.current) return;
    gameRef.current.move(dir);
  }, []);
  
  const handleMobileRotate = useCallback((dir: number) => {
    if (!gameRef.current || !gameRunningRef.current) return;
    gameRef.current.rotate(dir);
  }, []);
  
  const handleMobileHardDrop = useCallback(() => {
    if (!gameRef.current || !gameRunningRef.current) return;
    gameRef.current.hardDrop();
  }, []);
  
  const handleMobileSoftDrop = useCallback(() => {
    if (!gameRef.current || !gameRunningRef.current) return;
    gameRef.current.softDrop();
  }, []);
  
  const handleMobileHold = useCallback(() => {
    if (!gameRef.current || !gameRunningRef.current) return;
    gameRef.current.hold();
  }, []);
  
  return (
    <>
      {/* Page Loader */}
      {loading && (
        <div className="page-loader">
          <div className="pl-logo">CONNECTING...</div>
          <div className="pl-bar">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={`pl-b ${i < loadProgress ? 'lit' : ''}`}
                style={i < loadProgress ? {
                  background: ['#00f5ff', '#ffff00', '#cc00ff', '#aaff00', '#ff0040', '#0066ff', '#ff8800', '#00f5ff', '#ffff00', '#cc00ff'][i],
                  boxShadow: `0 0 14px ${['#00f5ff', '#ffff00', '#cc00ff', '#aaff00', '#ff0040', '#0066ff', '#ff8800', '#00f5ff', '#ffff00', '#cc00ff'][i]}`
                } : {}}
              />
            ))}
          </div>
          <div className="pl-text">{loadText}</div>
        </div>
      )}
      
      {/* Background */}
      <canvas ref={bgCanvasRef} className="bg-canvas" />
      <div className="scanlines-overlay" />
      <div className="scan-line" />
      
      {/* LOBBY SCREEN */}
      {screen === 'lobby' && (
        <div className="screen active">
          <div className="logo">TETRIS</div>
          <div className="subtitle">BATTLE - REAL-TIME PVP</div>
          <div className="card">
            <div className="px-corner tl" /><div className="px-corner tr" />
            <div className="px-corner bl" /><div className="px-corner br" />
            <div className="card-title">PLAYER SETUP</div>
            <div className="input-group">
              <label>PLAYER NAME</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value.toUpperCase())}
                placeholder="YOUR NAME"
                maxLength={12}
              />
            </div>
            <button className="btn btn-primary" onClick={createRoom}>
              + ONLINE BATTLE (CREATE ROOM)
            </button>
            <button className="btn btn-bot" onClick={() => setShowBotDifficulty(!showBotDifficulty)}>
              VS BOT (BOT BATTLE)
            </button>
            <Link href="/how-to" className="btn btn-secondary">
              HOW TO PLAY
            </Link>
            {showBotDifficulty && (
              <div className="bot-difficulty show">
                <div className="bot-difficulty-label">DIFFICULTY</div>
                <div className="diff-btns">
                  <button className="diff-btn diff-easy" onClick={() => startBotGame(1)}>EASY</button>
                  <button className="diff-btn diff-normal" onClick={() => startBotGame(2)}>NORMAL</button>
                  <button className="diff-btn diff-hard" onClick={() => startBotGame(3)}>HARD</button>
                </div>
              </div>
            )}
            <div className="divider">OR JOIN</div>
            <div className="input-group">
              <label>ROOM CODE</label>
              <input
                type="text"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase().replace(/[^0-9]/g, ''))}
                placeholder="4-DIGIT CODE"
                maxLength={4}
                style={{ textAlign: 'center', letterSpacing: '10px', fontSize: '20px' }}
                onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              />
            </div>
            <button className="btn btn-secondary" onClick={joinRoom}>
              JOIN ROOM
            </button>
          </div>
        </div>
      )}
      
      {/* WAITING SCREEN */}
      {screen === 'waiting' && (
        <div className="screen active">
          <div className="logo" style={{ fontSize: '22px', marginBottom: '4px' }}>WAITING</div>
          <div className="subtitle">FOR OPPONENT</div>
          <div className="card">
            <div className="px-corner tl" /><div className="px-corner tr" />
            <div className="px-corner bl" /><div className="px-corner br" />
            <div className="card-title">ROOM CODE</div>
            <div className="room-code-display" onClick={copyRoomCode}>
              <span className="code-label">SHARE THIS CODE</span>
              <span className="code">{displayRoomCode}</span>
              <div className="copy-hint">CLICK TO COPY</div>
            </div>
            <div className="waiting-indicator">
              <div className="dot" /><div className="dot" /><div className="dot" />
              <span>WAITING FOR OPPONENT</span>
            </div>
            <button className="btn btn-danger" style={{ marginTop: '18px' }} onClick={cancelWaiting}>
              CANCEL
            </button>
          </div>
        </div>
      )}
      
      {/* GAME SCREEN */}
      {screen === 'game' && (
        <div className="screen active game-screen">
          <div className="game-header">
            <span className="game-title">TETRIS BATTLE</span>
            <div className="game-header-right">
              <button
                className={`sound-btn ${soundEnabled ? 'on' : ''}`}
                onClick={() => setSoundEnabled(!soundEnabled)}
              >
                {soundEnabled ? 'ON' : 'OFF'}
              </button>
              <button className="btn btn-secondary quit-btn" onClick={leaveRoom}>
                QUIT
              </button>
            </div>
          </div>
          <div className="game-layout">
            {/* YOUR BOARD */}
            <div className="player-section">
              <div className="player-label you">YOU</div>
              <div className="player-name-tag">{playerName}</div>
              <div className="board-with-garb">
                <div className="garbage-bar">
                  {Array.from({ length: Math.min(pendingGarbage, 20) }).map((_, i) => (
                    <div key={i} className={`garb-cell ${pendingGarbage >= 10 ? 'warn' : ''}`} />
                  ))}
                </div>
                <div className="board-wrap">
                  <canvas ref={canvasRef} width={200} height={400} className="my-canvas" />
                  <div className={`action-popup ${actionPopup ? 'show' : ''}`}>{actionPopup}</div>
                  <div className={`attack-count-badge ${showAttackBadge ? 'show' : ''}`}>{attackBadgeText}</div>
                </div>
              </div>
            </div>
            
            {/* CENTER PANEL */}
            <div className="center-col">
              <div className="vs-text">VS</div>
              <div className="side-panel">
                <div className="panel-box">
                  <div className="panel-box-title">HOLD</div>
                  <canvas ref={holdCanvasRef} width={80} height={80} className="hold-canvas" />
                </div>
                <div className="panel-box">
                  <div className="panel-box-title">NEXT</div>
                  <canvas ref={nextCanvasRef} width={80} height={80} className="next-canvas" />
                </div>
                <div className="panel-box">
                  <div className="panel-box-title">SCORE</div>
                  <div className="score-value">{score}</div>
                </div>
                <div className="panel-box" style={{ padding: '7px 9px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div>
                      <div className="panel-box-title">LEVEL</div>
                      <div className="level-value">{level}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="panel-box-title">LINES</div>
                      <div className="lines-value">{lines}</div>
                    </div>
                  </div>
                </div>
                <div className="panel-box combo-box">
                  <div className="panel-box-title">COMBO</div>
                  <div className="combo-value">{combo > 1 ? combo : 0}</div>
                  <div className="combo-label-inline">x COMBO</div>
                  <div className={`b2b-badge ${b2b ? 'on' : 'off'}`}>BACK-TO-BACK</div>
                </div>
                <div className="panel-box atk-box">
                  <div className="panel-box-title">ATTACK</div>
                  <div className="atk-row">
                    <span className="atk-label">SENT</span>
                    <span className="atk-val sent">{atkSent}</span>
                  </div>
                  <div className="atk-row">
                    <span className="atk-label">RECV</span>
                    <span className="atk-val recv">{atkRecv}</span>
                  </div>
                  <div className="atk-row">
                    <span className="atk-label">NEXT</span>
                    <span className="atk-val recv">{pendingGarbage}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* OPPONENT BOARD */}
            <div className="player-section">
              <div className={`player-label ${botModeRef.current ? 'bot' : 'opp'}`}>
                {botModeRef.current ? 'BOT' : 'FOE'}
              </div>
              <div className="player-name-tag">{oppName}</div>
              <canvas
                ref={oppCanvasRef}
                width={200}
                height={400}
                className={`opponent-canvas ${botModeRef.current ? 'bot-canvas' : ''}`}
              />
            </div>
          </div>
          
          <div className="controls-hint">
            <div className="key-hint"><span className="key">ARROWS</span> Move</div>
            <div className="key-hint"><span className="key">UP/X</span> Rotate(R)</div>
            <div className="key-hint"><span className="key">Z</span> Rotate(L)</div>
            <div className="key-hint"><span className="key">DOWN</span> Soft Drop</div>
            <div className="key-hint"><span className="key">SPACE</span> Hard Drop</div>
            <div className="key-hint"><span className="key">C/Shift</span> Hold</div>
          </div>
          
          <div className="mobile-controls">
            <div className="mobile-row">
              <div className="mobile-btn" onTouchStart={handleMobileHold} onMouseDown={handleMobileHold}>HOLD</div>
              <div className="mobile-btn" onTouchStart={() => handleMobileRotate(1)} onMouseDown={() => handleMobileRotate(1)}>R</div>
              <div className="mobile-btn" onTouchStart={() => handleMobileRotate(-1)} onMouseDown={() => handleMobileRotate(-1)}>L</div>
            </div>
            <div className="mobile-row">
              <div className="mobile-btn" onTouchStart={() => handleMobileMove(-1)} onMouseDown={() => handleMobileMove(-1)}>LEFT</div>
              <div className="mobile-btn" onTouchStart={handleMobileSoftDrop} onMouseDown={handleMobileSoftDrop}>DOWN</div>
              <div className="mobile-btn" onTouchStart={() => handleMobileMove(1)} onMouseDown={() => handleMobileMove(1)}>RIGHT</div>
            </div>
            <div className="mobile-row">
              <div className="mobile-btn drop-btn" onTouchStart={handleMobileHardDrop} onMouseDown={handleMobileHardDrop}>DROP</div>
            </div>
          </div>
        </div>
      )}
      
      {/* MATCH FLASH */}
      {showMatchFlash && (
        <div className="match-flash show">
          <div className="match-text">MATCH FOUND!</div>
        </div>
      )}
      
      {/* COUNTDOWN */}
      {showCountdown && (
        <div className="countdown-overlay show">
          <div className="countdown-num" key={countdownNum}>{countdownNum}</div>
        </div>
      )}
      
      {/* RESULT OVERLAY */}
      {showResult && (
        <div className="overlay show">
          <div className={`overlay-title ${resultClass}`}>{resultTitle}</div>
          <div className="result-stats-grid">
            <div className="rs-cell">
              <div className="rs-cell-label">SCORE</div>
              <div className="rs-cell-val">{score}</div>
            </div>
            <div className="rs-cell">
              <div className="rs-cell-label">LEVEL</div>
              <div className="rs-cell-val">{level}</div>
            </div>
            <div className="rs-cell">
              <div className="rs-cell-label">LINES</div>
              <div className="rs-cell-val">{lines}</div>
            </div>
            <div className="rs-cell">
              <div className="rs-cell-label">MAX COMBO</div>
              <div className="rs-cell-val">{statMaxCombo}</div>
            </div>
            <div className="rs-cell">
              <div className="rs-cell-label">ATK SENT</div>
              <div className="rs-cell-val">{atkSent}</div>
            </div>
            <div className="rs-cell">
              <div className="rs-cell-label">TETRIS</div>
              <div className="rs-cell-val">{statTetris}</div>
            </div>
          </div>
          <button className="btn btn-primary" style={{ width: '220px', marginTop: '10px' }} onClick={leaveRoom}>
            BACK TO LOBBY
          </button>
        </div>
      )}
      
      {/* FORCE STOP OVERLAY */}
      {showForceStop && (
        <div className="force-stop-overlay show">
          <div className="fs-icon">X</div>
          <div className="fs-title">ADMIN TERMINATED</div>
          <div className="fs-subtitle">Room was terminated by admin</div>
          <div className="fs-divider" />
          <div className="fs-msg-box">
            <div className="fs-msg-label">Message from admin</div>
            <div className="fs-msg-text">{forceStopMsg}</div>
          </div>
          <button className="fs-back-btn" onClick={leaveRoom}>
            BACK TO LOBBY
          </button>
        </div>
      )}
      
      {/* STATUS BAR */}
      <div className="status-bar">
        <div style={{ display: 'flex', gap: '12px' }}>
          <span className="status-online">ONLINE</span>
          <span className="version-disp">VER {APP_VERSION}</span>
        </div>
        <span>{roomCode ? `ROOM: ${roomCode}` : botModeRef.current ? 'BOT MODE' : '-'}</span>
      </div>
      
      <style jsx>{`
        .page-loader {
          position: fixed;
          inset: 0;
          background: #020408;
          z-index: 500;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 26px;
        }
        .pl-logo {
          font-family: 'Press Start 2P', monospace;
          font-size: 16px;
          color: var(--acc);
          text-shadow: 0 0 20px rgba(0,245,255,.8);
          letter-spacing: 4px;
        }
        .pl-bar { display: flex; gap: 4px; }
        .pl-b {
          width: 20px; height: 20px; border-radius: 3px;
          background: #0d1525; border: 1px solid #1a2540;
          position: relative; transition: background .08s, box-shadow .08s;
        }
        .pl-b.lit::after {
          content: ''; position: absolute; top: 2px; left: 2px; right: 2px; height: 4px;
          background: rgba(255,255,255,.3); border-radius: 1px;
        }
        .pl-text {
          font-family: 'Press Start 2P', monospace;
          font-size: 8px; color: var(--dim); letter-spacing: 3px;
          animation: plBlink 1s step-end infinite;
        }
        @keyframes plBlink { 0%,100%{opacity:1} 50%{opacity:.2} }
        
        .bg-canvas { position: fixed; inset: 0; z-index: 0; opacity: .16; pointer-events: none; }
        .scanlines-overlay {
          position: fixed; inset: 0; z-index: 1; pointer-events: none;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.13) 2px, rgba(0,0,0,0.13) 4px);
        }
        .scan-line {
          position: fixed; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, rgba(0,245,255,.3), transparent);
          animation: scan 4s linear infinite; pointer-events: none; z-index: 2;
        }
        @keyframes scan { 0%{top:-2px} 100%{top:100vh} }
        
        .screen {
          display: none;
          position: relative;
          z-index: 10;
        }
        .screen.active {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
        }
        .game-screen { padding: 8px; }
        
        .logo {
          font-family: 'Press Start 2P', monospace;
          font-size: clamp(22px, 5vw, 46px);
          color: var(--acc);
          text-shadow: 0 0 20px rgba(0,245,255,.5), 0 0 60px rgba(0,245,255,.3);
          letter-spacing: 8px;
          margin-bottom: 6px;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%,100% { text-shadow: 0 0 20px rgba(0,245,255,.5), 0 0 60px rgba(0,245,255,.3); }
          50% { text-shadow: 0 0 40px rgba(0,245,255,.9), 0 0 80px rgba(0,245,255,.5); }
        }
        .subtitle {
          font-size: 12px; color: var(--acc2); letter-spacing: 4px; margin-bottom: 44px;
          text-shadow: 0 0 20px rgba(255,0,128,.5);
        }
        
        .card {
          background: var(--s0); border: 1px solid #1a2540; border-radius: 4px;
          padding: 32px; width: 100%; max-width: 400px; position: relative;
        }
        .card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, var(--acc), var(--acc2));
        }
        .card-title { font-size: 12px; color: var(--acc); letter-spacing: 3px; margin-bottom: 22px; }
        
        .px-corner {
          position: absolute; width: 9px; height: 9px;
          background: var(--acc); box-shadow: 0 0 7px var(--acc);
        }
        .px-corner.tl { top: 0; left: 0; }
        .px-corner.tr { top: 0; right: 0; }
        .px-corner.bl { bottom: 0; left: 0; }
        .px-corner.br { bottom: 0; right: 0; }
        
        .input-group { margin-bottom: 18px; }
        .input-group label {
          display: block; font-size: 11px; color: var(--dim);
          letter-spacing: 2px; margin-bottom: 7px;
        }
        input[type="text"] {
          width: 100%; background: rgba(0,245,255,.03); border: 1px solid #1a2540;
          border-radius: 2px; color: var(--tx); font-family: 'Orbitron', monospace;
          font-size: 13px; padding: 11px 14px; outline: none;
          transition: border-color .2s, box-shadow .2s;
        }
        input[type="text"]:focus {
          border-color: var(--acc); box-shadow: 0 0 20px rgba(0,245,255,.3);
        }
        
        .btn {
          display: block; width: 100%; padding: 13px; border: none; border-radius: 2px;
          cursor: pointer; font-family: 'Orbitron', monospace; font-size: 12px;
          font-weight: 700; letter-spacing: 3px; text-transform: uppercase;
          transition: all .2s; text-align: center; text-decoration: none;
        }
        .btn-primary {
          background: linear-gradient(135deg, var(--acc), #0080ff); color: #000;
        }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 0 20px rgba(0,245,255,.5); }
        .btn-secondary {
          background: transparent; border: 1px solid var(--acc2); color: var(--acc2); margin-top: 8px;
        }
        .btn-secondary:hover { background: rgba(255,0,128,.1); box-shadow: 0 0 20px rgba(255,0,128,.3); }
        .btn-bot {
          background: linear-gradient(135deg, #7700ff, #cc00ff); color: #fff; margin-top: 8px;
        }
        .btn-bot:hover { transform: translateY(-1px); box-shadow: 0 0 20px rgba(204,0,255,.5); }
        .btn-danger {
          background: transparent; border: 1px solid #ff3355; color: #ff3355; margin-top: 8px;
        }
        .btn-danger:hover { background: rgba(255,51,85,.1); box-shadow: 0 0 20px rgba(255,51,85,.3); }
        
        .divider {
          display: flex; align-items: center; gap: 10px; margin: 18px 0;
          color: var(--dim); font-size: 11px; letter-spacing: 2px;
        }
        .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: #1a2540; }
        
        .bot-difficulty {
          display: none; margin-top: 16px; padding: 16px;
          background: rgba(204,0,255,.04); border: 1px solid rgba(204,0,255,.25);
          border-radius: 3px; animation: cfIn .2s ease;
        }
        .bot-difficulty.show { display: block; }
        @keyframes cfIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:none} }
        .bot-difficulty-label {
          font-size: 11px; color: rgba(204,0,255,.9); letter-spacing: 3px; margin-bottom: 12px;
        }
        .diff-btns { display: flex; gap: 8px; }
        .diff-btn {
          flex: 1; padding: 11px 6px; border: 1px solid; border-radius: 2px;
          cursor: pointer; font-family: 'Orbitron', monospace; font-size: 9px;
          font-weight: 700; letter-spacing: 2px; transition: all .15s; background: transparent;
        }
        .diff-easy { border-color: var(--acc3); color: var(--acc3); }
        .diff-easy:hover { background: rgba(170,255,0,.12); box-shadow: 0 0 14px rgba(170,255,0,.3); }
        .diff-normal { border-color: #ffaa00; color: #ffaa00; }
        .diff-normal:hover { background: rgba(255,170,0,.12); box-shadow: 0 0 14px rgba(255,170,0,.3); }
        .diff-hard { border-color: #ff3355; color: #ff3355; }
        .diff-hard:hover { background: rgba(255,51,85,.12); box-shadow: 0 0 14px rgba(255,51,85,.3); }
        
        .room-code-display {
          text-align: center; padding: 16px; background: rgba(0,245,255,.05);
          border: 1px dashed var(--acc); border-radius: 2px; margin-bottom: 14px;
          cursor: pointer; transition: background .2s;
        }
        .room-code-display:hover { background: rgba(0,245,255,.10); }
        .code-label { font-size: 11px; color: var(--dim); letter-spacing: 3px; }
        .code {
          font-family: 'Press Start 2P', monospace; font-size: 28px; color: var(--acc);
          text-shadow: 0 0 20px rgba(0,245,255,.5); letter-spacing: 10px;
          display: block; margin-top: 8px;
        }
        .copy-hint { font-size: 11px; color: var(--dim); letter-spacing: 2px; margin-top: 8px; }
        .waiting-indicator {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          color: var(--acc3); font-size: 11px; letter-spacing: 2px; margin-top: 14px;
        }
        .dot {
          width: 6px; height: 6px; border-radius: 50%; background: var(--acc3);
          animation: blink 1s ease-in-out infinite;
        }
        .dot:nth-child(2) { animation-delay: .3s; }
        .dot:nth-child(3) { animation-delay: .6s; }
        @keyframes blink { 0%,100%{opacity:.2;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }
        
        /* GAME SCREEN */
        .game-header {
          width: 100%; max-width: 720px; display: flex;
          justify-content: space-between; align-items: center; margin-bottom: 10px;
        }
        .game-title {
          font-family: 'Press Start 2P', monospace; font-size: 11px; color: var(--acc);
          text-shadow: 0 0 20px rgba(0,245,255,.5);
        }
        .game-header-right { display: flex; gap: 8px; align-items: center; }
        .sound-btn {
          background: transparent; border: 1px solid #1a2540; color: var(--dim);
          font-family: 'Orbitron', monospace; font-size: 8px; letter-spacing: 1px;
          padding: 5px 10px; border-radius: 2px; cursor: pointer; transition: all .2s;
        }
        .sound-btn.on { border-color: var(--acc3); color: var(--acc3); }
        .sound-btn:hover { border-color: var(--acc); color: var(--acc); }
        .quit-btn { width: auto !important; padding: 5px 12px !important; font-size: 8px !important; }
        
        .game-layout { display: flex; gap: 10px; align-items: flex-start; }
        .player-section { display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .player-label {
          font-size: 11px; letter-spacing: 3px; padding: 3px 12px; border-radius: 2px;
        }
        .player-label.you {
          background: rgba(0,245,255,.1); border: 1px solid var(--acc); color: var(--acc);
        }
        .player-label.opp {
          background: rgba(255,0,128,.1); border: 1px solid var(--acc2); color: var(--acc2);
        }
        .player-label.bot {
          background: rgba(204,0,255,.1); border: 1px solid #cc00ff; color: #cc00ff;
        }
        .player-name-tag { font-size: 11px; color: var(--dim); letter-spacing: 1px; }
        
        .my-canvas {
          display: block; image-rendering: pixelated;
          border: 1px solid var(--acc); box-shadow: 0 0 20px rgba(0,245,255,.4);
        }
        .opponent-canvas {
          display: block; image-rendering: pixelated;
          border: 1px solid var(--acc2); box-shadow: 0 0 20px rgba(255,0,128,.4); opacity: .85;
        }
        .opponent-canvas.bot-canvas {
          border-color: #cc00ff; box-shadow: 0 0 20px rgba(204,0,255,.4);
        }
        .hold-canvas, .next-canvas {
          border: none; background: rgba(0,0,0,.4);
        }
        
        .board-with-garb { display: flex; gap: 3px; align-items: flex-end; }
        .garbage-bar {
          width: 10px; height: 400px; display: flex;
          flex-direction: column-reverse; gap: 1px; padding: 1px 0;
        }
        .garb-cell {
          width: 10px; height: 18px; border-radius: 1px;
          background: rgba(255,51,85,.85); box-shadow: 0 0 4px rgba(255,51,85,.6);
          transition: all .15s; flex-shrink: 0;
        }
        .garb-cell.warn {
          background: rgba(255,170,0,.9); box-shadow: 0 0 6px rgba(255,170,0,.7);
          animation: garbWarn .4s ease-in-out infinite alternate;
        }
        @keyframes garbWarn { 0%{opacity:.7} 100%{opacity:1;transform:scaleX(1.2)} }
        
        .board-wrap { position: relative; }
        .action-popup {
          position: absolute; top: 30px; left: 50%; transform: translateX(-50%);
          font-family: 'Press Start 2P', monospace; font-size: 9px; color: var(--acc3);
          text-shadow: 0 0 10px rgba(170,255,0,.8); pointer-events: none;
          opacity: 0; transition: opacity .1s; white-space: nowrap; z-index: 5;
        }
        .action-popup.show { opacity: 1; animation: popUp .8s ease-out forwards; }
        @keyframes popUp { 0%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0;transform:translateX(-50%) translateY(-30px)} }
        
        .attack-count-badge {
          position: absolute; top: 4px; left: 4px;
          background: rgba(255,51,85,.9); color: #fff;
          font-family: 'Press Start 2P', monospace; font-size: 7px;
          padding: 3px 5px; border-radius: 2px; letter-spacing: 1px;
          opacity: 0; transition: opacity .2s; z-index: 6; pointer-events: none;
        }
        .attack-count-badge.show { opacity: 1; animation: badgePop .3s ease-out; }
        @keyframes badgePop { 0%{transform:scale(1.8)} 100%{transform:scale(1)} }
        
        .center-col { display: flex; flex-direction: column; align-items: center; gap: 8px; align-self: center; }
        .vs-text {
          font-family: 'Press Start 2P', monospace; font-size: 16px;
          background: linear-gradient(180deg, var(--acc), var(--acc2));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          filter: drop-shadow(0 0 10px rgba(0,245,255,.5));
        }
        
        .side-panel { display: flex; flex-direction: column; gap: 8px; min-width: 88px; }
        .panel-box {
          background: var(--s0); border: 1px solid #1a2540; border-radius: 2px; padding: 9px;
        }
        .panel-box-title { font-size: 10px; color: var(--dim); letter-spacing: 2px; margin-bottom: 6px; }
        .score-value {
          font-family: 'Press Start 2P', monospace; font-size: 11px; color: var(--acc3);
          text-shadow: 0 0 15px rgba(170,255,0,.5); word-break: break-all;
        }
        .level-value {
          font-family: 'Press Start 2P', monospace; font-size: 18px; color: var(--acc);
          text-shadow: 0 0 20px rgba(0,245,255,.5);
        }
        .lines-value { font-family: 'Press Start 2P', monospace; font-size: 13px; color: var(--tx); }
        
        .combo-box { border-color: rgba(170,255,0,.35); background: rgba(170,255,0,.04); }
        .combo-value {
          font-family: 'Press Start 2P', monospace; font-size: 20px; color: var(--acc3);
          text-shadow: 0 0 20px rgba(170,255,0,.8); transition: transform .1s; line-height: 1.1;
        }
        .combo-label-inline {
          font-size: 7px; color: rgba(170,255,0,.6); letter-spacing: 2px; margin-top: 2px;
        }
        .b2b-badge {
          display: inline-block; font-size: 7px; letter-spacing: 1px;
          padding: 2px 5px; border-radius: 2px; border: 1px solid; margin-top: 4px; transition: all .2s;
        }
        .b2b-badge.off { border-color: #1a2540; color: var(--dim); background: transparent; }
        .b2b-badge.on {
          border-color: #ff8800; color: #ff8800; background: rgba(255,136,0,.1);
          box-shadow: 0 0 8px rgba(255,136,0,.4); animation: b2bGlow 1s ease-in-out infinite alternate;
        }
        @keyframes b2bGlow { 0%{box-shadow:0 0 4px rgba(255,136,0,.3)} 100%{box-shadow:0 0 14px rgba(255,136,0,.7)} }
        
        .atk-box { border-color: rgba(255,51,85,.3); background: rgba(255,51,85,.03); }
        .atk-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; }
        .atk-label { font-size: 8px; color: var(--dim); letter-spacing: 1px; }
        .atk-val { font-family: 'Press Start 2P', monospace; font-size: 9px; }
        .atk-val.sent { color: var(--acc3); }
        .atk-val.recv { color: #ff3355; }
        
        .controls-hint {
          width: 100%; max-width: 720px; display: flex;
          justify-content: center; gap: 14px; margin-top: 8px; flex-wrap: wrap;
        }
        .key-hint {
          display: flex; align-items: center; gap: 5px;
          font-size: 11px; color: var(--dim); letter-spacing: 1px;
        }
        .key {
          background: var(--s0); border: 1px solid #1a2540; border-radius: 2px;
          padding: 2px 6px; font-size: 11px; color: var(--tx); font-family: monospace;
        }
        
        .mobile-controls {
          display: none; flex-direction: column; align-items: center; gap: 6px; margin-top: 10px;
        }
        .mobile-row { display: flex; gap: 6px; }
        .mobile-btn {
          width: 54px; height: 54px; background: var(--s0);
          border: 1px solid #1a2540; border-radius: 4px; color: var(--tx);
          font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center;
          user-select: none; -webkit-user-select: none; touch-action: manipulation; transition: background .1s;
        }
        .mobile-btn:active { background: rgba(0,245,255,.15); border-color: var(--acc); }
        .drop-btn { width: 116px; letter-spacing: 1px; }
        @media(max-width:640px) {
          .mobile-controls { display: flex; }
          .controls-hint { display: none; }
          .side-panel { min-width: 68px; }
          .score-value { font-size: 9px; }
          .panel-box { padding: 7px; }
        }
        
        /* Overlays */
        .overlay {
          position: fixed; inset: 0; background: rgba(2,4,8,.93);
          display: none; align-items: center; justify-content: center;
          z-index: 50; flex-direction: column; gap: 14px;
        }
        .overlay.show { display: flex; }
        .overlay-title {
          font-family: 'Press Start 2P', monospace;
          font-size: clamp(18px, 4vw, 34px); text-align: center;
        }
        .overlay-title.win { color: var(--acc3); text-shadow: 0 0 30px rgba(170,255,0,.6); }
        .overlay-title.lose { color: var(--acc2); text-shadow: 0 0 30px rgba(255,0,128,.5); }
        .overlay-title.draw { color: var(--acc); text-shadow: 0 0 20px rgba(0,245,255,.5); }
        
        .result-stats-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px;
          margin: 10px 0; max-width: 320px;
        }
        .rs-cell {
          text-align: center; background: rgba(255,255,255,.03);
          border: 1px solid #1a2540; border-radius: 2px; padding: 8px;
        }
        .rs-cell-label { font-size: 8px; color: var(--dim); letter-spacing: 2px; margin-bottom: 4px; }
        .rs-cell-val { font-family: 'Press Start 2P', monospace; font-size: 13px; color: var(--acc3); }
        
        .countdown-overlay {
          position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
          z-index: 40; pointer-events: none; background: rgba(2,4,8,.6);
        }
        .countdown-overlay.show { display: flex; }
        .countdown-num {
          font-family: 'Press Start 2P', monospace; font-size: 90px; color: var(--acc);
          text-shadow: 0 0 20px rgba(0,245,255,.5), 0 0 100px rgba(0,245,255,.3);
          animation: countAnim .85s ease-out forwards;
        }
        @keyframes countAnim { 0%{transform:scale(2);opacity:1} 100%{transform:scale(.4);opacity:0} }
        
        .match-flash {
          position: fixed; inset: 0; display: none; align-items: center;
          justify-content: center; z-index: 38; pointer-events: none;
        }
        .match-flash.show { display: flex; }
        .match-text {
          font-family: 'Press Start 2P', monospace; font-size: clamp(14px, 3vw, 24px);
          color: var(--acc3); text-shadow: 0 0 20px rgba(170,255,0,.8); letter-spacing: 4px;
          animation: matchIn .4s ease-out forwards;
        }
        @keyframes matchIn { 0%{opacity:0;transform:scale(.5)} 60%{opacity:1;transform:scale(1.1)} 100%{opacity:1;transform:scale(1)} }
        
        .force-stop-overlay {
          position: fixed; inset: 0; z-index: 200; background: rgba(2,4,8,.97);
          display: none; align-items: center; justify-content: center;
          flex-direction: column; gap: 18px;
        }
        .force-stop-overlay.show { display: flex; animation: forceIn .4s ease; }
        @keyframes forceIn { from{opacity:0;transform:scale(1.05)} to{opacity:1;transform:scale(1)} }
        .fs-icon { font-size: 72px; animation: fsPulse 1.2s ease-in-out infinite; }
        @keyframes fsPulse { 0%,100%{filter:drop-shadow(0 0 10px rgba(255,51,85,.5))} 50%{filter:drop-shadow(0 0 30px rgba(255,51,85,1))} }
        .fs-title {
          font-family: 'Press Start 2P', monospace; font-size: clamp(16px, 3.5vw, 28px);
          color: #ff3355; text-shadow: 0 0 30px rgba(255,51,85,.9), 0 0 60px rgba(255,51,85,.4);
          letter-spacing: 3px; text-align: center;
        }
        .fs-subtitle { font-size: 13px; color: rgba(255,136,136,.8); letter-spacing: 4px; text-align: center; }
        .fs-msg-box {
          max-width: 460px; width: 90%; background: rgba(255,51,85,.07);
          border: 1px solid rgba(255,51,85,.35); border-radius: 4px;
          padding: 16px 24px; text-align: center;
        }
        .fs-msg-label { font-size: 11px; color: var(--dim); letter-spacing: 3px; margin-bottom: 10px; }
        .fs-msg-text {
          font-size: 13px; color: rgba(255,170,170,.9); letter-spacing: 1px;
          line-height: 2; word-break: break-word;
        }
        .fs-divider { width: 200px; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,51,85,.4), transparent); }
        .fs-back-btn {
          padding: 14px 36px; border: 1px solid #ff3355; color: #ff3355;
          background: rgba(255,51,85,.08); font-family: 'Orbitron', monospace;
          font-size: 10px; font-weight: 700; letter-spacing: 3px; cursor: pointer;
          border-radius: 2px; transition: all .2s; margin-top: 4px;
        }
        .fs-back-btn:hover {
          background: rgba(255,51,85,.2); box-shadow: 0 0 20px rgba(255,51,85,.4);
          transform: translateY(-2px);
        }
        
        .status-bar {
          position: fixed; bottom: 0; left: 0; right: 0;
          background: var(--s0); border-top: 1px solid #1a2540;
          padding: 5px 14px; font-size: 11px; color: var(--dim); letter-spacing: 2px;
          display: flex; justify-content: space-between; z-index: 10;
        }
        .status-online { color: var(--acc3); }
        .version-disp { color: var(--acc2); font-weight: bold; }
      `}</style>
    </>
  );
}
