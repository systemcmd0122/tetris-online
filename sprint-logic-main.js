import { COLS, ROWS, CELL, COLORS, PIECES, RN, LS, TS, Bag, TetrisGame, mkP } from './tetris-engine.js';
import { FB_CONFIG } from './config.js';
import { initBgCanvas, initPageLoader, showScreen, showActionPopup } from './ui-utils.js';

// ══ Firestore Init ══
let _fbApp = null, _fstore = null;

async function getFS() {
  if (_fstore) return _fstore;
  const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  _fbApp = getApps().length ? getApps()[0] : initializeApp(FB_CONFIG);
  _fstore = getFirestore(_fbApp);
  return _fstore;
}

// ══ BG CANVAS ══
const playSound = () => { };
const toggleSound = () => { };
initBgCanvas();

// ══ SCREEN ══
function showToast(msg, ok = false, dur = 2500) {
  const t = document.getElementById('toast'); t.textContent = msg; t.className = 'toast' + (ok ? ' ok' : ''); t.classList.add('show');
  clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.remove('show'), dur);
}

// ══ PB (Personal Best) ══
let _playerName = 'PLAYER';
function getPB() { const v = localStorage.getItem('sprint_pb'); return v ? parseInt(v) : null; }
function setPB(ms) { localStorage.setItem('sprint_pb', ms); }
function fmtTime(ms) {
  if (ms == null) return '--:--.---';
  const min = Math.floor(ms / 60000), sec = Math.floor((ms % 60000) / 1000), msi = ms % 1000;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(msi).padStart(3, '0')}`;
}
function updatePBDisplay() {
  const pb = getPB();
  const d = document.getElementById('pbDisplay');
  if (d) d.textContent = pb ? `YOUR BEST: ${fmtTime(pb)}` : '自己ベスト未記録';
  const p = document.getElementById('pbPanel');
  if (p) p.textContent = pb ? fmtTime(pb) : '--:--.---';
}

// ══ GAME STATE ══
let game = null, gameRunning = false, animId = null, endedOnce = false;
let sprintStartTs = null, elapsedMs = 0, timerInterval = null;
let softDropInterval = null;

const SPRINT_TARGET = 40;

function resetState() {
  gameRunning = false; endedOnce = false;
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  game = null; dasStop(); clearInterval(softDropInterval); softDropInterval = null;
  clearInterval(timerInterval); timerInterval = null; sprintStartTs = null; elapsedMs = 0;
}

function flashLock() { const el = document.getElementById('lockFlash'); if (el) { el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 60); } }

function updateGameUI() {
  if (!game) return;
  document.getElementById('scoreDisplay').textContent = game.score;
  document.getElementById('levelDisplay').textContent = game.level;
  const linesLeft = Math.min(game.lines, SPRINT_TARGET);
  document.getElementById('lineProgressText').textContent = `${linesLeft} / ${SPRINT_TARGET}`;
  document.getElementById('progressBar').style.width = `${(linesLeft / SPRINT_TARGET) * 100}%`;
}

function updateTimer() {
  if (sprintStartTs == null) return;
  elapsedMs = performance.now() - sprintStartTs;
  document.getElementById('timerDisplay').textContent = fmtTime(Math.floor(elapsedMs));
}

// ══ SPRINT FLOW ══
window.startSprint = async () => {
  _playerName = (window._getAuthName ? window._getAuthName() : null)
    || (document.getElementById('playerName').value.trim().toUpperCase() || 'PLAYER').slice(0, 12);
  if (!window._getAuthName || !window._getAuthName()) {
    localStorage.setItem('sprint_playerName', _playerName);
  }
  document.getElementById('playerName').value = _playerName;
  endedOnce = false;
  showScreen('gameScreen');
  resetState();
  updatePBDisplay();

  document.getElementById('timerDisplay').textContent = '00:00.000';
  document.getElementById('lineProgressText').textContent = '0 / 40';
  document.getElementById('progressBar').style.width = '0%';
  document.getElementById('scoreDisplay').textContent = '0';
  document.getElementById('levelDisplay').textContent = '1';

  const aborted = await countdown(); if (aborted) return;

  game = new TetrisGame('myCanvas', 'holdCanvas', 'nextCanvas');
  gameRunning = true; endedOnce = false;
  sprintStartTs = performance.now();
  timerInterval = setInterval(updateTimer, 16);

  const loop = ts => {
    if (!gameRunning) return;
    game.update(ts); game.draw();
    while (game.results.length > 0) {
      const res = game.results.shift();
      if (res.actionLabel) showActionPopup(res.actionLabel);
      if (res.cleared > 0) flashLock();
    }
    updateGameUI();
    if (game.lines >= SPRINT_TARGET && !endedOnce) { endSprint('CLEAR'); return; }
    if (game.over && !endedOnce) { endSprint('FAIL'); return; }
    animId = requestAnimationFrame(loop);
  };
  animId = requestAnimationFrame(loop);
};

window.retryGame = () => {
  document.getElementById('resultOverlay').classList.remove('show');
  window.startSprint();
};
window.goLobby = () => {
  document.getElementById('resultOverlay').classList.remove('show');
  resetState();
  showScreen('lobbyScreen');
  updatePBDisplay();
};
window.quitGame = () => { resetState(); showScreen('lobbyScreen'); updatePBDisplay(); };

async function endSprint(result) {
  if (endedOnce) return;
  endedOnce = true; gameRunning = false;
  clearInterval(timerInterval); timerInterval = null;
  if (animId) { cancelAnimationFrame(animId); animId = null; }

  const finalMs = Math.floor(elapsedMs);
  const title = document.getElementById('resultTitle');
  if (result === 'CLEAR') {
    title.className = 'overlay-title clear'; title.textContent = 'CLEARED!';
    const { notifyOk } = await import('./nav.js');
    notifyOk('クリア！', `タイム: ${fmtTime(finalMs)}`);
  } else {
    title.className = 'overlay-title fail'; title.textContent = 'GAME OVER';
    const { notifyErr } = await import('./nav.js');
    notifyErr('ゲームオーバー', 'スプリント終了');
  }

  document.getElementById('resultTime').textContent = result === 'CLEAR' ? fmtTime(finalMs) : '--';
  document.getElementById('rs-score').textContent = game?.score || 0;
  document.getElementById('rs-level').textContent = game?.level || 1;
  document.getElementById('rs-lines').textContent = game?.lines || 0;
  document.getElementById('rs-tetris').textContent = game?.tetrisCount || 0;

  const pbNew = document.getElementById('pbNewBadge');
  pbNew.innerHTML = '';
  const rankBadge = document.getElementById('resultRankBadge');
  rankBadge.innerHTML = '';

  if (result === 'CLEAR') {
    const pb = getPB();
    const isNewPB = pb == null || finalMs < pb;
    if (isNewPB) {
      setPB(finalMs);
      pbNew.innerHTML = '<div class="pb-badge">★ NEW PERSONAL BEST!</div>';
      const { notifySpecial } = await import('./nav.js');
      notifySpecial('新しいPB！', `スプリント記録更新: ${fmtTime(finalMs)}`, '🏆');
    }
    try {
      const rank = await uploadScore(_playerName, finalMs);
      let cls = 'ranked', txt = `GLOBAL #${rank}`, msg = '';
      if (rank === 1) cls = 'gold', txt = 'WORLD #1', msg = '世界1位おめでとう！';
      else if (rank === 2) cls = 'silver', txt = 'WORLD #2', msg = '世界2位入賞！';
      else if (rank === 3) cls = 'bronze', txt = 'WORLD #3', msg = '世界3位入賞！';
      rankBadge.innerHTML = `<div class="result-rank-badge ${cls}">${txt}</div>`;
      if (msg) {
          const { notifySpecial } = await import('./nav.js');
          notifySpecial('ランキング入賞！', msg, '🌟');
      }
      window._onSprintComplete?.(_playerName, finalMs, game?.score || 0, rank);
    } catch (e) { rankBadge.innerHTML = '<div style="font-size:9px;color:var(--dim)">オフライン — スコア未保存</div>'; }
  }

  document.getElementById('resultOverlay').classList.add('show');
}

async function uploadScore(name, ms) {
  const fs = await getFS();
  const { doc, collection, runTransaction, getDocs, query, orderBy, limit, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const docRef = doc(fs, 'sprint_scores', name);
  await runTransaction(fs, async tx => {
    const snap = await tx.get(docRef);
    if (!snap.exists() || ms < snap.data().ms) {
      tx.set(docRef, { name, ms, updatedAt: serverTimestamp() });
    }
  });
  const snap = await getDocs(query(collection(fs, 'sprint_scores'), orderBy('ms'), limit(50)));
  const entries = snap.docs.map(d => d.data());
  const rank = entries.findIndex(e => e.name === name) + 1;
  return rank > 0 ? rank : 51;
}

window.showRanking = async () => {
  document.getElementById('resultOverlay').classList.remove('show');
  showScreen('rankScreen');
  const container = document.getElementById('rankContent');
  container.innerHTML = '<div class="rank-loading">読み込み中...</div>';
  try {
    const fs = await getFS();
    const { collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await getDocs(query(collection(fs, 'sprint_scores'), orderBy('ms'), limit(50)));
    if (snap.empty) {
      container.innerHTML = '<div class="rank-empty">まだ記録がありません！<br>最初のプレイヤーになろう！</div>';
      return;
    }
    const myName = _playerName || localStorage.getItem('sprint_playerName') || '';
    let html = '<table class="rank-table"><thead><tr><th>RANK</th><th>PLAYER</th><th>TIME</th><th>DATE</th></tr></thead><tbody>';
    snap.docs.forEach((d, i) => {
      const entry = d.data();
      const pos = i + 1;
      let posStr = '';
      if (pos === 1) posStr = '<span class="rank-pos gold">1st</span>';
      else if (pos === 2) posStr = '<span class="rank-pos silver">2nd</span>';
      else if (pos === 3) posStr = '<span class="rank-pos bronze">3rd</span>';
      else posStr = `<span class="rank-pos">#${pos}</span>`;
      const isMe = entry.name === myName;
      const dateStr = entry.updatedAt?.toDate ? entry.updatedAt.toDate().toLocaleDateString('ja-JP') : '—';
      html += `<tr class="rank-row${isMe ? ' my-row' : ''}"><td>${posStr}</td><td style="font-weight:bold">${entry.name}${isMe ? ' ◀' : ''}</td><td class="rank-time-cell">${fmtTime(entry.ms)}</td><td style="font-size:10px;color:var(--dim)">${dateStr}</td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div class="rank-err">⚠ 読み込み失敗<br><span style="font-size:9px;color:var(--dim)">${e.message}</span></div>`;
  }
};

function countdown() {
  return new Promise(resolve => {
    const ov = document.getElementById('countdownOverlay'), num = document.getElementById('countdownNum');
    num.textContent = ''; num.style.animation = 'none'; ov.classList.add('show');
    let i = 3;
    const tick = () => {
      num.style.animation = 'none'; void num.offsetHeight; num.style.animation = 'countAnim .85s ease-out forwards';
      if (i > 0) { num.textContent = i.toString(); i--; setTimeout(tick, 1000); }
      else { num.textContent = 'GO!'; setTimeout(() => { ov.classList.remove('show'); resolve(false); }, 800); }
    }; tick();
  });
}

const DAS = 167, ARR = 33;
const keys = new Set();
let dasTimer = null, dasDir = 0, arrTimer = null;
function dasStart(dir) { if (dasDir === dir) return; dasStop(); dasDir = dir; game?.move(dir); dasTimer = setTimeout(() => { arrTimer = setInterval(() => { game?.move(dir); }, ARR); }, DAS); }
function dasStop() { clearTimeout(dasTimer); clearInterval(arrTimer); dasTimer = null; arrTimer = null; dasDir = 0; }

document.addEventListener('keydown', e => {
  const gameActive = document.getElementById('gameScreen')?.classList.contains('active');
  if (gameActive && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  if (keys.has(e.code)) return; keys.add(e.code);
  if (!game || !gameRunning) return;
  switch (e.code) {
    case 'ArrowLeft': dasStart(-1); break; case 'ArrowRight': dasStart(1); break;
    case 'ArrowUp': case 'KeyX': game.rotate(1); break; case 'KeyZ': game.rotate(-1); break;
    case 'ArrowDown': game.softDrop(); softDropInterval = setInterval(() => game?.softDrop(), 50); break;
    case 'Space': game.hardDrop(); break;
    case 'ShiftLeft': case 'ShiftRight': case 'KeyC': game.hold(); break;
  }
});
document.addEventListener('keyup', e => {
  keys.delete(e.code);
  if (e.code === 'ArrowLeft' && dasDir === -1) dasStop();
  if (e.code === 'ArrowRight' && dasDir === 1) dasStop();
  if (e.code === 'ArrowDown') { clearInterval(softDropInterval); softDropInterval = null; }
});


(function init() {
  const saved = localStorage.getItem('sprint_playerName');
  if (saved) document.getElementById('playerName').value = saved;
  updatePBDisplay();
  initPageLoader('LOADING...', 'READY!');
})();
