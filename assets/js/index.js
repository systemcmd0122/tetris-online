/* ══════════════════════════════════════════════════
   index.js  —  Tetris animated background + UI effects
   ══════════════════════════════════════════════════ */

(function () {

/* ── Tetromino definitions ── */
const PIECES = [
  { cells: [[0,0],[1,0],[2,0],[3,0]],           color: '#00f5ff', glow: 'rgba(0,245,255,.5)'   }, // I
  { cells: [[0,0],[1,0],[0,1],[1,1]],           color: '#ffdd00', glow: 'rgba(255,221,0,.5)'   }, // O
  { cells: [[1,0],[0,1],[1,1],[2,1]],           color: '#aa00ff', glow: 'rgba(170,0,255,.5)'   }, // T
  { cells: [[0,0],[0,1],[1,1],[2,1]],           color: '#ff6600', glow: 'rgba(255,102,0,.5)'   }, // L
  { cells: [[2,0],[0,1],[1,1],[2,1]],           color: '#4488ff', glow: 'rgba(68,136,255,.5)'  }, // J
  { cells: [[1,0],[2,0],[0,1],[1,1]],           color: '#00ff88', glow: 'rgba(0,255,136,.5)'   }, // S
  { cells: [[0,0],[1,0],[1,1],[2,1]],           color: '#ff3355', glow: 'rgba(255,51,85,.5)'   }, // Z
];

const CELL = 28;          // px per cell
const ALPHA_PIECE = 0.18; // piece fill opacity
const ALPHA_GLOW  = 0.08;

/* ── Canvas setup ── */
const canvas = document.getElementById('bgCanvas');
const ctx    = canvas.getContext('2d');

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', () => { resize(); initGrid(); });

/* ── Static settled board ──
   We maintain a virtual grid (cols × rows) of settled cells
   that slowly fills and clears lines, looping forever.          */
let COLS, ROWS, grid;

function initGrid() {
  COLS = Math.ceil(canvas.width  / CELL) + 2;
  ROWS = Math.ceil(canvas.height / CELL) + 2;
  grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => null)
  );
  // Pre-fill bottom 40% with random blocks for immediate atmosphere
  const startRow = Math.floor(ROWS * 0.6);
  for (let r = startRow; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (Math.random() < 0.5) {
        grid[r][c] = PIECES[Math.floor(Math.random() * PIECES.length)].color;
      }
    }
  }
}
initGrid();

/* ── Falling pieces ── */
const fallers = [];

function spawnFaller() {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  // pick random column so piece is fully on screen
  const minC = 0;
  const maxC = COLS - 4;
  const col  = Math.floor(Math.random() * (maxC - minC)) + minC;
  const speed = 0.4 + Math.random() * 0.7;   // cells per second
  fallers.push({
    piece:  p,
    col:    col,
    rowF:   -4,          // float row (sub-cell precision)
    speed:  speed,
    rot:    0,
  });
}

// Seed initial fallers
for (let i = 0; i < 7; i++) {
  spawnFaller();
  // stagger starting positions
  fallers[i].rowF = -4 + (ROWS + 4) * (i / 7) * 0.3;
}

/* Rotate cells 90° CW */
function rotateCells(cells) {
  const maxX = Math.max(...cells.map(c => c[0]));
  return cells.map(([x, y]) => [maxX - y, x]);
}

/* ── Line-clear logic ── */
function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (grid[r].every(c => c !== null)) {
      grid.splice(r, 1);
      grid.unshift(Array(COLS).fill(null));
      cleared++;
      r++; // re-check same index
    }
  }
  return cleared;
}

/* ── Settle a faller into grid ── */
function settle(f) {
  let cells = f.piece.cells;
  for (let i = 0; i < f.rot % 4; i++) cells = rotateCells(cells);
  const row = Math.floor(f.rowF);
  cells.forEach(([cx, cy]) => {
    const r = row + cy;
    const c = f.col + cx;
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      grid[r][c] = f.piece.color;
    }
  });
  clearLines();
}

/* ── Collision check ── */
function wouldCollide(f, nextRow) {
  let cells = f.piece.cells;
  for (let i = 0; i < f.rot % 4; i++) cells = rotateCells(cells);
  return cells.some(([cx, cy]) => {
    const r = Math.floor(nextRow) + cy;
    const c = f.col + cx;
    if (r >= ROWS) return true;
    if (c < 0 || c >= COLS) return true;
    if (r >= 0 && grid[r][c] !== null) return true;
    return false;
  });
}

/* ── Particle flash on line clear ── */
const particles = [];
function flashParticles(row) {
  for (let c = 0; c < COLS; c++) {
    for (let k = 0; k < 3; k++) {
      particles.push({
        x: (c + .5) * CELL,
        y: (row + .5) * CELL,
        vx: (Math.random() - .5) * 4,
        vy: (Math.random() - 1.5) * 4,
        life: 1,
        color: PIECES[Math.floor(Math.random() * PIECES.length)].color,
        size: 2 + Math.random() * 3,
      });
    }
  }
}

/* ── Draw a single cell ── */
function drawCell(x, y, color, alpha = ALPHA_PIECE, glowColor) {
  const s = CELL - 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur  = 14;
  }
  ctx.fillStyle = color;
  ctx.fillRect(x * CELL + 1, y * CELL + 1, s, s);

  // Inner highlight
  ctx.globalAlpha = alpha * 0.6;
  ctx.fillStyle = 'rgba(255,255,255,.15)';
  ctx.fillRect(x * CELL + 2, y * CELL + 2, s - 6, 3);
  ctx.restore();
}

/* ── Main render loop ── */
let last = 0;
let spawnTimer = 0;

function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min((ts - last) / 1000, 0.1);
  last = ts;

  // ── Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ── Draw subtle grid lines
  ctx.save();
  ctx.strokeStyle = 'rgba(0,245,255,.025)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, canvas.height);
    ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(canvas.width, r * CELL);
    ctx.stroke();
  }
  ctx.restore();

  // ── Draw settled grid
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c]) {
        drawCell(c, r, grid[r][c], ALPHA_PIECE);
      }
    }
  }

  // ── Update & draw falling pieces
  spawnTimer += dt;
  if (spawnTimer > 1.8 && fallers.length < 14) {
    spawnFaller();
    spawnTimer = 0;
  }

  for (let i = fallers.length - 1; i >= 0; i--) {
    const f = fallers[i];
    const nextRow = f.rowF + f.speed * dt * 3;

    if (wouldCollide(f, nextRow)) {
      settle(f);
      fallers.splice(i, 1);
      continue;
    }
    f.rowF = nextRow;

    // Out of view — remove without settling (top overflow)
    if (f.rowF > ROWS + 4) {
      fallers.splice(i, 1);
      continue;
    }

    // Draw piece
    let cells = f.piece.cells;
    for (let k = 0; k < f.rot % 4; k++) cells = rotateCells(cells);
    cells.forEach(([cx, cy]) => {
      const drawR = f.rowF + cy;
      if (drawR < -1) return;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.shadowColor = f.piece.glow;
      ctx.shadowBlur  = 18;
      ctx.fillStyle   = f.piece.color;
      const s = CELL - 1;
      ctx.fillRect((f.col + cx) * CELL + 1, drawR * CELL + 1, s, s);
      // highlight
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.fillRect((f.col + cx) * CELL + 2, drawR * CELL + 2, s - 6, 3);
      ctx.restore();
    });

    // Ghost / drop shadow
    let ghostRow = f.rowF;
    while (!wouldCollide(f, ghostRow + 0.5)) ghostRow += 0.5;
    if (ghostRow - f.rowF > 2) {
      cells.forEach(([cx, cy]) => {
        const gr = ghostRow + cy;
        if (gr < 0) return;
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.fillStyle   = f.piece.color;
        ctx.fillRect((f.col + cx) * CELL + 1, gr * CELL + 1, CELL - 1, CELL - 1);
        ctx.restore();
      });
    }
  }

  // ── Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x    += p.vx;
    p.y    += p.vy;
    p.vy   += 0.12;
    p.life -= dt * 1.5;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = p.life * 0.9;
    ctx.fillStyle   = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 6;
    ctx.fillRect(p.x, p.y, p.size, p.size);
    ctx.restore();
  }
}

requestAnimationFrame(frame);

/* ── HI-SCORE counter ── */
const tickerEl = document.getElementById('tickerScore');
let score = 0;
const target = 987450 + Math.floor(Math.random() * 12550);
setInterval(() => {
  score = Math.min(score + Math.floor(Math.random() * 1200 + 300), target);
  tickerEl.textContent = String(score).padStart(6, '0');
}, 80);

/* ── Online / rooms fake counter ── */
const sOnline = document.getElementById('sOnline');
const sRooms  = document.getElementById('sRooms');
let online = 42 + Math.floor(Math.random() * 30);
let rooms  = 8  + Math.floor(Math.random() * 12);
sOnline.textContent = online;
sRooms.textContent  = rooms;
setInterval(() => {
  online += Math.floor(Math.random() * 3) - 1;
  rooms  += Math.floor(Math.random() * 3) - 1;
  online = Math.max(20, online);
  rooms  = Math.max(4, rooms);
  sOnline.textContent = online;
  sRooms.textContent  = rooms;
}, 2800);

})();