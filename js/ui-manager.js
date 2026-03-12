export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

export function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  t.classList.remove('show');
  void t.offsetHeight;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

export function flashAttack() {
  const f = document.getElementById('attackFlash');
  if (f) {
    f.classList.add('show');
    setTimeout(() => f.classList.remove('show'), 280);
  }
  const bw = document.querySelector('.board-wrap');
  if (bw) {
    bw.classList.remove('shake');
    void bw.offsetWidth;
    bw.classList.add('shake');
    setTimeout(() => bw.classList.remove('shake'), 260);
  }
}

export function showActionPopup(label) {
  const p = document.getElementById('actionPopup');
  if (!p) return;
  p.textContent = label.replace('\n', ' / ');
  p.classList.remove('show');
  void p.offsetHeight;
  p.classList.add('show');
}

export let _prevScore = 0;
export let _prevCombo = -1;
export const uiCache = { score: -1, level: -1, lines: -1, combo: -1, b2b: null, sent: -1, recv: -1, pg: -1 };

export function updateGameUI(game, stats) {
  if (!game) return;
  // Score
  if (game.score !== uiCache.score) {
    const sd = document.getElementById('scoreDisplay');
    if (sd) {
      sd.classList.remove('score-pop');
      void sd.offsetWidth;
      sd.classList.add('score-pop');
      sd.textContent = game.score;
    }
    uiCache.score = game.score;
  }
  if (game.level !== uiCache.level) {
    const ld = document.getElementById('levelDisplay');
    if (ld) ld.textContent = game.level;
    uiCache.level = game.level;
  }
  if (game.lines !== uiCache.lines) {
    const lnd = document.getElementById('linesDisplay');
    if (lnd) lnd.textContent = game.lines;
    uiCache.lines = game.lines;
  }
  // Combo
  if (game.combo !== uiCache.combo) {
    const cd = document.getElementById('comboDisplay');
    if (cd) {
      if (game.combo > 1) {
        cd.classList.remove('pop');
        void cd.offsetWidth;
        cd.classList.add('pop');
      }
      cd.textContent = game.combo > 1 ? game.combo : 0;
    }
    uiCache.combo = game.combo;
    if (stats && game.combo > stats.statMaxCombo) stats.statMaxCombo = game.combo;
  }
  // B2B
  if (game.b2b !== uiCache.b2b) {
    const b2b = document.getElementById('b2bBadge');
    if (b2b) b2b.className = 'b2b-badge ' + (game.b2b ? 'on' : 'off');
    uiCache.b2b = game.b2b;
  }
  // Attack stats
  if (stats) {
    if (stats.statAtkSent !== uiCache.sent) {
      const asd = document.getElementById('atkSentDisplay');
      if (asd) asd.textContent = stats.statAtkSent;
      uiCache.sent = stats.statAtkSent;
    }
    if (stats.statAtkRecv !== uiCache.recv) {
      const ard = document.getElementById('atkRecvDisplay');
      if (ard) ard.textContent = stats.statAtkRecv;
      uiCache.recv = stats.statAtkRecv;
    }
  }
  // Pending garbage display
  const pg = game.pendingGarbage || 0;
  if (pg !== uiCache.pg) {
    const pgd = document.getElementById('pendGarbDisplay');
    if (pgd) pgd.textContent = pg;
    // Mini cells
    const pgc = document.getElementById('pendGarbCells');
    if (pgc) {
      pgc.innerHTML = '';
      const showN = Math.min(pg, 10);
      for (let i = 0; i < showN; i++) {
        const d = document.createElement('div');
        d.className = 'pg-cell' + (pg >= 8 ? ' warn' : '');
        pgc.appendChild(d);
      }
    }
    // Garbage bar on side
    const gb = document.getElementById('garbBar');
    if (gb) {
      gb.innerHTML = '';
      const barN = Math.min(pg, 20);
      for (let i = 0; i < barN; i++) {
        const d = document.createElement('div');
        d.className = 'garb-cell' + (pg >= 10 ? ' warn' : '');
        gb.appendChild(d);
      }
    }
    uiCache.pg = pg;
  }
}

export function clearBoards(stats) {
  ['myCanvas', 'opponentCanvas', 'holdCanvas', 'nextCanvas'].forEach(id => {
    const c = document.getElementById(id); if (c) { const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); }
  });
  // Reset all UI stats
  const scoreDisplay = document.getElementById('scoreDisplay');
  if (scoreDisplay) scoreDisplay.textContent = '0';
  const levelDisplay = document.getElementById('levelDisplay');
  if (levelDisplay) levelDisplay.textContent = '1';
  const linesDisplay = document.getElementById('linesDisplay');
  if (linesDisplay) linesDisplay.textContent = '0';
  const comboDisplay = document.getElementById('comboDisplay');
  if (comboDisplay) comboDisplay.textContent = '0';
  const b2bBadge = document.getElementById('b2bBadge');
  if (b2bBadge) b2bBadge.className = 'b2b-badge off';
  const atkSentDisplay = document.getElementById('atkSentDisplay');
  if (atkSentDisplay) atkSentDisplay.textContent = '0';
  const atkRecvDisplay = document.getElementById('atkRecvDisplay');
  if (atkRecvDisplay) atkRecvDisplay.textContent = '0';
  const pendGarbDisplay = document.getElementById('pendGarbDisplay');
  if (pendGarbDisplay) pendGarbDisplay.textContent = '0';
  const pendGarbCells = document.getElementById('pendGarbCells');
  if (pendGarbCells) pendGarbCells.innerHTML = '';
  const garbBar = document.getElementById('garbBar');
  if (garbBar) garbBar.innerHTML = '';
  const attackBadge = document.getElementById('attackBadge');
  if (attackBadge) attackBadge.classList.remove('show');

  if (stats) {
    stats.statMaxCombo = 0;
    stats.statAtkSent = 0;
    stats.statAtkRecv = 0;
    stats.statTetris = 0;
  }
  // Reset cache
  for (let k in uiCache) uiCache[k] = (typeof uiCache[k] === 'number' ? -1 : null);
}
