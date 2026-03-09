/* ══════════════════════════════════════════════════
   lobby-bg.js  —  Animated Tetris canvas background
   Runs only on lobby + waiting screens; fades out
   when the game screen becomes active.
   ══════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Tetromino definitions ── */
  const PIECES = [
    { cells:[[0,0],[1,0],[2,0],[3,0]], color:'#00f5ff', glow:'rgba(0,245,255,.5)'   }, // I
    { cells:[[0,0],[1,0],[0,1],[1,1]], color:'#ffdd00', glow:'rgba(255,221,0,.5)'   }, // O
    { cells:[[1,0],[0,1],[1,1],[2,1]], color:'#aa00ff', glow:'rgba(170,0,255,.5)'   }, // T
    { cells:[[0,0],[0,1],[1,1],[2,1]], color:'#ff6600', glow:'rgba(255,102,0,.5)'   }, // L
    { cells:[[2,0],[0,1],[1,1],[2,1]], color:'#4488ff', glow:'rgba(68,136,255,.5)'  }, // J
    { cells:[[1,0],[2,0],[0,1],[1,1]], color:'#00ff88', glow:'rgba(0,255,136,.5)'   }, // S
    { cells:[[0,0],[1,0],[1,1],[2,1]], color:'#ff3355', glow:'rgba(255,51,85,.5)'   }, // Z
  ];

  const CELL = 28;

  const canvas = document.getElementById('bgCanvas');
  const ctx    = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', () => { resize(); initGrid(); });

  /* ── Grid ── */
  let COLS, ROWS, grid;
  function initGrid() {
    COLS = Math.ceil(canvas.width  / CELL) + 2;
    ROWS = Math.ceil(canvas.height / CELL) + 2;
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const start = Math.floor(ROWS * 0.62);
    for (let r = start; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (Math.random() < 0.48)
          grid[r][c] = PIECES[Math.floor(Math.random() * PIECES.length)].color;
  }
  initGrid();

  /* ── Helpers ── */
  function rotateCells(cells) {
    const maxX = Math.max(...cells.map(([x]) => x));
    return cells.map(([x, y]) => [maxX - y, x]);
  }

  function wouldCollide(f, nextRow) {
    let cells = f.piece.cells;
    for (let i = 0; i < f.rot % 4; i++) cells = rotateCells(cells);
    return cells.some(([cx, cy]) => {
      const r = Math.floor(nextRow) + cy, c = f.col + cx;
      if (r >= ROWS || c < 0 || c >= COLS) return true;
      if (r >= 0 && grid[r][c] !== null) return true;
      return false;
    });
  }

  function settle(f) {
    let cells = f.piece.cells;
    for (let i = 0; i < f.rot % 4; i++) cells = rotateCells(cells);
    cells.forEach(([cx, cy]) => {
      const r = Math.floor(f.rowF) + cy, c = f.col + cx;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) grid[r][c] = f.piece.color;
    });
    clearLines();
  }

  function clearLines() {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every(c => c !== null)) {
        grid.splice(r, 1);
        grid.unshift(Array(COLS).fill(null));
        r++;
      }
    }
  }

  /* ── Fallers ── */
  const fallers = [];
  function spawnFaller() {
    const p   = PIECES[Math.floor(Math.random() * PIECES.length)];
    const col = Math.floor(Math.random() * (COLS - 4));
    fallers.push({ piece: p, col, rowF: -4, speed: 0.4 + Math.random() * 0.6, rot: Math.floor(Math.random() * 4) });
  }
  for (let i = 0; i < 8; i++) { spawnFaller(); fallers[i].rowF = -4 + (ROWS + 4) * (i / 8) * 0.28; }

  /* ── Main loop ── */
  let last = 0, spawnTimer = 0;
  let visible = true;

  /* Monitor screen changes to pause drawing when game is active */
  const observer = new MutationObserver(() => {
    const gameActive = document.getElementById('gameScreen')?.classList.contains('active');
    visible = !gameActive;
    if (gameActive) {
      document.body.classList.add('game-active');
    } else {
      document.body.classList.remove('game-active');
    }
  });
  observer.observe(document.body, { subtree: true, attributeFilter: ['class'] });

  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min((ts - last) / 1000, 0.1);
    last = ts;

    if (!visible) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* Grid lines */
    ctx.save();
    ctx.strokeStyle = 'rgba(0,245,255,.022)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c*CELL,0); ctx.lineTo(c*CELL,canvas.height); ctx.stroke(); }
    for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0,r*CELL); ctx.lineTo(canvas.width,r*CELL); ctx.stroke(); }
    ctx.restore();

    /* Settled grid */
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c]) drawCell(c, r, grid[r][c], 0.17);

    /* Spawn */
    spawnTimer += dt;
    if (spawnTimer > 1.6 && fallers.length < 14) { spawnFaller(); spawnTimer = 0; }

    /* Fallers */
    for (let i = fallers.length - 1; i >= 0; i--) {
      const f   = fallers[i];
      const nxt = f.rowF + f.speed * dt * 3;

      if (wouldCollide(f, nxt)) { settle(f); fallers.splice(i, 1); continue; }
      f.rowF = nxt;
      if (f.rowF > ROWS + 4) { fallers.splice(i, 1); continue; }

      /* Draw piece */
      let cells = f.piece.cells;
      for (let k = 0; k < f.rot % 4; k++) cells = rotateCells(cells);
      cells.forEach(([cx, cy]) => {
        const dr = f.rowF + cy;
        if (dr < -1) return;
        ctx.save();
        ctx.globalAlpha   = 0.55;
        ctx.shadowColor   = f.piece.glow;
        ctx.shadowBlur    = 18;
        ctx.fillStyle     = f.piece.color;
        ctx.fillRect((f.col + cx) * CELL + 1, dr * CELL + 1, CELL - 1, CELL - 1);
        ctx.globalAlpha   = 0.24;
        ctx.fillStyle     = 'rgba(255,255,255,.3)';
        ctx.fillRect((f.col + cx) * CELL + 2, dr * CELL + 2, CELL - 7, 3);
        ctx.restore();
      });

      /* Ghost */
      let gr = f.rowF;
      while (!wouldCollide(f, gr + 0.5)) gr += 0.5;
      if (gr - f.rowF > 3) {
        cells.forEach(([cx, cy]) => {
          const dr = gr + cy; if (dr < 0) return;
          ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = f.piece.color;
          ctx.fillRect((f.col + cx) * CELL + 1, dr * CELL + 1, CELL - 1, CELL - 1);
          ctx.restore();
        });
      }
    }
  }

  function drawCell(x, y, color, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);
    ctx.globalAlpha = alpha * 0.55; ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.fillRect(x*CELL+2, y*CELL+2, CELL-8, 3); ctx.restore();
  }

  requestAnimationFrame(frame);

  /* ── Waiting screen spinning piece animation ── */
  const WAIT_PIECES = [
    { cells:[[0,0],[1,0],[2,0],[3,0]], color:'#00f5ff' },
    { cells:[[0,0],[1,0],[0,1],[1,1]], color:'#ffdd00' },
    { cells:[[1,0],[0,1],[1,1],[2,1]], color:'#aa00ff' },
    { cells:[[0,0],[0,1],[1,1],[2,1]], color:'#ff6600' },
    { cells:[[2,0],[0,1],[1,1],[2,1]], color:'#4488ff' },
    { cells:[[1,0],[2,0],[0,1],[1,1]], color:'#00ff88' },
    { cells:[[0,0],[1,0],[1,1],[2,1]], color:'#ff3355' },
  ];
  const CS = 14; // cell size for mini
  let waitFrame = 0, waitPieceIdx = 0, waitT = 0, waitSlot = 0;

  function drawWaitPiece(wctx, piece, ox, oy, alpha) {
    wctx.save(); wctx.globalAlpha = alpha;
    piece.cells.forEach(([cx, cy]) => {
      wctx.fillStyle = piece.color + 'dd';
      wctx.fillRect(ox + cx*CS+1, oy + cy*CS+1, CS-2, CS-2);
      wctx.fillStyle = 'rgba(255,255,255,.2)';
      wctx.fillRect(ox + cx*CS+1, oy + cy*CS+1, CS-2, 3);
    });
    wctx.restore();
  }

  function animateWaiting() {
    const wc = document.getElementById('waitCanvas');
    if (!wc) return;
    const wctx = wc.getContext('2d');
    wctx.clearRect(0, 0, 240, 60);
    waitT += 1/60;

    // 5 piece slots marching across
    for (let s = 0; s < 5; s++) {
      const x  = ((s * 46 + waitT * 30) % 280) - 30;
      const p  = WAIT_PIECES[(waitPieceIdx + s) % WAIT_PIECES.length];
      const a  = Math.min(1, Math.min(x / 20, (240 - x) / 20));
      if (a > 0) drawWaitPiece(wctx, p, x, 16, Math.max(0, a) * 0.75);
    }
    requestAnimationFrame(animateWaiting);
  }
  animateWaiting();

  /* ── Countdown Tetris animation ── */
  // Enhanced countdown: rings of tetromino cells burst outward
  let cdCells = [];
  function launchCountdownBurst(label) {
    const cc = document.getElementById('countCanvas');
    if (!cc) return;
    const cctx = cc.getContext('2d');
    const CX = 160, CY = 160;
    cdCells = [];
    const burstPieces = [PIECES[0], PIECES[2], PIECES[6]];
    burstPieces.forEach((p, pi) => {
      p.cells.forEach(([cx, cy]) => {
        const angle = Math.atan2(cy - 1, cx - 1) + (pi * Math.PI * 2 / 3);
        const speed = 3 + Math.random() * 3;
        cdCells.push({
          x: CX, y: CY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: p.color,
          life: 1,
          size: 14,
        });
      });
    });

    let startTs = null;
    function cdFrame(ts) {
      if (!startTs) startTs = ts;
      const dt = (ts - startTs) / 1000;
      startTs = ts;
      cctx.clearRect(0, 0, 320, 320);
      let alive = false;
      cdCells.forEach(p => {
        if (p.life <= 0) return;
        p.x    += p.vx;
        p.y    += p.vy;
        p.vy   += 0.15;
        p.life -= dt * 1.4;
        if (p.life > 0) {
          alive = true;
          cctx.save();
          cctx.globalAlpha = p.life;
          cctx.fillStyle   = p.color;
          cctx.shadowColor = p.color;
          cctx.shadowBlur  = 10;
          cctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
          cctx.restore();
        }
      });
      if (alive) requestAnimationFrame(cdFrame);
      else cctx.clearRect(0, 0, 320, 320);
    }
    requestAnimationFrame(cdFrame);
  }

  // Expose so game.js countdown can trigger it
  window.launchCountdownBurst = launchCountdownBurst;

})();
