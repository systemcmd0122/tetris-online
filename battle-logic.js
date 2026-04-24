import { mountNav, notifyOk, notifyErr, notifyWarn, notifySpecial } from './nav.js';
import { initBgCanvas, initPageLoader, showScreen, showActionPopup } from './ui-utils.js';
import { APP_VERSION } from './config.js';
import { onAuthReady, getCachedProfile, mountAuthWidget, getCurrentUser } from './auth.js';
import { upsertUserProfile } from './db.js';
import { TetrisGame, COLS, ROWS, CELL, COLORS, PIECES, mkP } from './tetris-engine.js';
import { BotController, BOT_DELAYS, BOT_NOISE } from './tetris-bot.js';

initPageLoader('CONNECTING...', 'READY!');

mountNav();
document.getElementById('versionDisp').textContent = `VER ${APP_VERSION}`;

let _botSid = null, _botDb = null, _botSyncIv = null;
let _botSyncLast = 0;
const BOT_SYNC_INTERVAL = 400;

async function _getBotDb() {
  if (_botDb) return _botDb;
  try {
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getDatabase } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
    const { FB_CONFIG } = await import('./config.js');
    const app = getApps().length ? getApps()[0] : initializeApp(FB_CONFIG);
    _botDb = getDatabase(app);
  } catch (e) { console.warn('RTDB init failed', e); }
  return _botDb;
}

async function _startBotSession(playerName, botName, difficulty) {
  try {
    const db = await _getBotDb();
    if (!db) return;
    const { ref, set, onDisconnect } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
    const sid = (playerName.replace(/[^a-zA-Z0-9_]/g, '_') + '_' + Date.now()).slice(0, 40);
    _botSid = sid;
    const sRef = ref(db, 'bot_sessions/' + sid);
    await set(sRef, {
      player: playerName,
      botName: botName,
      difficulty: difficulty,
      startedAt: Date.now(),
      status: 'playing',
      result: null,
      game: {
        player: { board: null, cur: null, score: 0, level: 1, lines: 0, atk: 0, over: false },
        bot: { board: null, cur: null, score: 0, level: 1, lines: 0, atk: 0, over: false }
      }
    });
    onDisconnect(sRef).remove();
  } catch (e) { console.warn('[BotSession] start failed', e); _botSid = null; }
}

async function _syncBotSession() {
  if (!_botSid || !game || !botGame) return;
  const now = Date.now();
  if (now - _botSyncLast < BOT_SYNC_INTERVAL) return;
  _botSyncLast = now;
  try {
    const db = await _getBotDb();
    if (!db) return;
    const { ref, update } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
    const pBoard = game.board.slice(2).map(r => r.map(c => c || ''));
    const bBoard = botGame.board.slice(2).map(r => r.map(c => c || ''));
    await update(ref(db, 'bot_sessions/' + _botSid), {
      'game/player': {
        board: pBoard,
        cur: game.current ? { name: game.current.name, rot: game.current.rot, x: game.current.x, y: game.current.y } : null,
        score: game.score || 0, level: game.level || 1, lines: game.lines || 0,
        atk: statAtkSent, over: !!game.over,
        held: game.held || '', next: game.bag.peek(1)[0] || '',
        combo: game.combo || 0, b2b: !!game.b2b, pendGarb: game.pendGarb || 0
      },
      'game/bot': {
        board: bBoard,
        cur: botGame.current ? { name: botGame.current.name, rot: botGame.current.rot, x: botGame.current.x, y: botGame.current.y } : null,
        score: botGame.score || 0, level: botGame.level || 1, lines: botGame.lines || 0,
        atk: statAtkRecv, over: !!botGame.over,
        held: botGame.held || '', next: botGame.bag.peek(1)[0] || '',
        combo: botGame.combo || 0, b2b: !!botGame.b2b, pendGarb: botGame.pendGarb || 0
      }
    });
  } catch (e) { }
}

async function _endBotSession(result) {
  if (!_botSid) return;
  const sid = _botSid;
  try {
    const db = await _getBotDb();
    if (!db) return;
    const { ref, update, remove } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
    await update(ref(db, 'bot_sessions/' + sid), { status: 'ended', result: result });
    setTimeout(async () => {
      try { await remove(ref(db, 'bot_sessions/' + sid)); } catch (e) { }
    }, 10000);
  } catch (e) { }
  _botSid = null;
}

async function _removeBotSession() {
  if (!_botSid) return;
  const sid = _botSid;
  _botSid = null;
  try {
    const db = await _getBotDb();
    if (!db) return;
    const { ref, remove } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
    await remove(ref(db, 'bot_sessions/' + sid));
  } catch (e) { }
}

onAuthReady(async user => {
  const inp = document.getElementById('playerName');
  if (!inp) return;
  if (user) {
    await upsertUserProfile(user).catch(() => { });
    const p = getCachedProfile();
    const name = ((p?.displayName || user.displayName || user.email || 'PLAYER')
      .trim().replace(/\//g, '_').slice(0, 12).toUpperCase() || 'PLAYER');
    inp.value = name; inp.readOnly = true;
    inp.style.opacity = '0.6'; inp.style.cursor = 'not-allowed';
    inp.title = 'ログイン中はアカウント名が使用されます';
  } else {
    inp.readOnly = false; inp.style.opacity = ''; inp.style.cursor = ''; inp.title = '';
  }
});

function _getBattlePlayerName() {
  const inp = document.getElementById('playerName');
  if (inp?.readOnly) return inp.value || 'PLAYER';
  return (inp?.value.trim() || 'PLAYER').toUpperCase().slice(0, 12);
}

const BOT_NAMES = ['BOT-EASY', 'BOT-NORMAL', 'BOT-HARD', 'BOT-DEMON'];

let game = null, botGame = null, botCtrl = null, gameRunning = false, animId = null, endedOnce = false;
let statMaxCombo = 0, statAtkSent = 0, statAtkRecv = 0, statTetris = 0;
let softDropInterval = null;
let _prevScore = 0, _prevCombo = -1;
const uiCache = { score: -1, level: -1, lines: -1, combo: -1, b2b: null, sent: -1, recv: -1, pg: -1, burst: -1, canBurst: null };

function resetState() {
  gameRunning = false; endedOnce = false;
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  _removeBotSession().catch(() => { });
  game = null; botGame = null; botCtrl = null;
  dasStop(); clearInterval(softDropInterval); softDropInterval = null;
  _prevScore = 0; _prevCombo = -1;
}

function clearBoards() {
  ['myCanvas', 'opponentCanvas', 'holdCanvas', 'nextCanvas'].forEach(id => {
    const c = document.getElementById(id); if (c) { const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); }
  });
  ['scoreDisplay', 'levelDisplay', 'linesDisplay', 'comboDisplay', 'atkSentDisplay', 'atkRecvDisplay', 'pendGarbDisplay'].forEach((id, i) => {
    const el = document.getElementById(id); if (el) el.textContent = ['0', '1', '0', '0', '0', '0', '0'][i];
  });
  document.getElementById('b2bBadge').className = 'b2b-badge off';
  document.getElementById('pendGarbCells').innerHTML = '';
  document.getElementById('garbBar').innerHTML = '';
  document.getElementById('attackBadge').classList.remove('show');
  const bar = document.getElementById('burstGaugeBar'); if (bar) bar.style.width = '0%';
  const rt = document.getElementById('burstReadyText'); if (rt) rt.style.display = 'none';
  statMaxCombo = 0; statAtkSent = 0; statAtkRecv = 0; statTetris = 0;
  Object.keys(uiCache).forEach(k => { uiCache[k] = -1 }); uiCache.b2b = null;
  ['rs-score', 'rs-level', 'rs-lines', 'rs-combo', 'rs-atk', 'rs-tetris'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '0'; });
}

window.toggleBotDifficulty = () => document.getElementById('botDifficulty').classList.toggle('show');

window.startBotGame = async (difficulty) => {
  document.activeElement?.blur();
  const name = _getBattlePlayerName();
  endedOnce = false;
  document.getElementById('botDifficulty').classList.remove('show');
  const botName = BOT_NAMES[difficulty - 1];
  showScreen('gameScreen');
  clearBoards();
  document.getElementById('myNameTag').textContent = name;
  document.getElementById('botNameTag').textContent = botName;
  document.getElementById('statusRoom').textContent = 'BOT MODE';

  const aborted = await countdown();
  if (aborted) return;

  game = new TetrisGame('myCanvas', 'holdCanvas', 'nextCanvas');
  botGame = new TetrisGame('opponentCanvas', null, null);
  botCtrl = new BotController(botGame, difficulty);
  gameRunning = true; endedOnce = false;

  _startBotSession(name, botName, difficulty).catch(() => { });

  const loop = ts => {
    if (!gameRunning) return;
    game._lastTs = ts;
    game.update(ts); game.draw();
    botCtrl.tick(ts); botGame.update(ts);

    const bd = { board: botGame.board.slice(2).map(r => r.map(c => c || '')), cur: { name: botGame.current.name, rot: botGame.current.rot, x: botGame.current.x, y: botGame.current.y }, over: botGame.over };
    TetrisGame.drawOpp(document.getElementById('opponentCanvas'), bd, 300, 600);

    while (game.results.length > 0) {
      const res = game.results.shift();
      if (res.garbageOut > 0) {
        statAtkSent += res.garbageOut; botGame.pendGarb += res.garbageOut;
        pushLog('ATTACK +' + res.garbageOut, 'var(--accent3)');
      }
      if (res.cleared === 4) statTetris++;
      if (res.actionLabel) {
        showActionPopup(res.actionLabel);
        pushLog(res.actionLabel.replace('\n', ' '), 'var(--accent)');
      }
    }
    while (botGame.results.length > 0) {
      const res = botGame.results.shift();
      if (res.garbageOut > 0) {
        game.pendGarb += res.garbageOut; statAtkRecv += res.garbageOut;
        pushLog('INCOMING +' + res.garbageOut, 'var(--red)');
        const badge = document.getElementById('attackBadge');
        badge.textContent = `+${res.garbageOut} !`; badge.classList.remove('show'); void badge.offsetWidth; badge.classList.add('show');
        setTimeout(() => badge.classList.remove('show'), 1200);
        flashAttack();
      }
    }

    updateGameUI();
    document.getElementById('botNameTag').textContent = `${botName} (${botGame.score})`;

    if (game.over && botGame.over && !endedOnce) { endGame('DRAW'); return; }
    if (game.over && !endedOnce) { endGame('LOSE'); return; }
    if (botGame.over && !endedOnce) { endGame('WIN'); return; }
    _syncBotSession().catch(() => { });
    animId = requestAnimationFrame(loop);
  };
  animId = requestAnimationFrame(loop);
};

window.quitGame = () => {
  document.getElementById('resultOverlay').classList.remove('show');
  document.getElementById('countdownOverlay').classList.remove('show');
  resetState();
  showScreen('lobbyScreen');
};

function endGame(result) {
  if (endedOnce) return;
  endedOnce = true; gameRunning = false;
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  _endBotSession(result).catch(() => { });
  const title = document.getElementById('resultTitle');
  const score = game?.score || 0, lvl = game?.level || 1, lines = game?.lines || 0;
  if (result === 'WIN') { title.className = 'overlay-title win'; title.textContent = 'YOU WIN!'; }
  else if (result === 'LOSE') { title.className = 'overlay-title lose'; title.textContent = 'YOU LOSE'; }
  else { title.className = 'overlay-title draw'; title.textContent = 'DRAW'; }
  document.getElementById('rs-score').textContent = score;
  document.getElementById('rs-level').textContent = lvl;
  document.getElementById('rs-lines').textContent = lines;
  document.getElementById('rs-combo').textContent = statMaxCombo;
  document.getElementById('rs-atk').textContent = statAtkSent;
  document.getElementById('rs-tetris').textContent = statTetris;
  document.getElementById('resultSub').innerHTML = '';

  if (result === 'WIN') {
    (async () => {
      const user = getCurrentUser();
      if (!user) return;
      try {
        const { awardTitle, AVAILABLE_TITLES } = await import('./db.js');
        const difficulty = botCtrl?.difficulty || 2;
        const titleIds = ['bot-easy-win', 'bot-normal-win', 'bot-hard-win', 'bot-demon-win'];
        const titleId = titleIds[difficulty - 1];

        if (titleId && AVAILABLE_TITLES[titleId]) {
          await awardTitle(user.uid, titleId);
          const titleDef = AVAILABLE_TITLES[titleId];
          const sub = document.getElementById('resultSub');
          const div = document.createElement('div');
          div.style.cssText = 'margin-top:16px;padding:12px;background:rgba(153,0,255,.1);border:1px solid #9900ff;border-radius:4px;font-size:11px;color:#aaff00;letter-spacing:1px;';
          div.innerHTML = `🏆 新しい称号を獲得しました！<br>${titleDef.emoji} <strong>${titleDef.name}</strong>`;
          sub.appendChild(div);
          notifySpecial(`新しい称号を獲得！`, `${titleDef.emoji} ${titleDef.name}`, titleDef.emoji);
        }
      } catch (e) { }
    })();
  }

  if (result === 'WIN') { notifyOk('勝利！', 'You win!'); }
  else if (result === 'LOSE') { notifyErr('敗北', 'You lose...'); }
  else if (result === 'DRAW') { notifyWarn('同着', 'Draw game'); }

  document.getElementById('resultOverlay').classList.add('show');
}

function countdown() {
  return new Promise(resolve => {
    const ov = document.getElementById('countdownOverlay');
    const num = document.getElementById('countdownNum');
    num.textContent = ''; num.style.animation = 'none';
    ov.classList.add('show');
    let i = 3;
    const tick = () => {
      num.style.animation = 'none'; void num.offsetHeight;
      num.style.animation = 'countAnim .85s ease-out forwards';
      if (i > 0) { num.textContent = i.toString(); i--; setTimeout(tick, 1000); }
      else { num.textContent = 'GO!'; setTimeout(() => { ov.classList.remove('show'); resolve(false); }, 800); }
    };
    tick();
  });
}

const DAS = 167, ARR = 33;
const keys = new Set();
let dasTimer = null, dasDir = 0, arrTimer = null;
function dasStart(dir) { if (dasDir === dir) return; dasStop(); dasDir = dir; game?.move(dir); dasTimer = setTimeout(() => { arrTimer = setInterval(() => { game?.move(dir); }, ARR); }, DAS); }
function dasStop() { clearTimeout(dasTimer); clearInterval(arrTimer); dasTimer = null; arrTimer = null; dasDir = 0; }

document.addEventListener('keydown', e => {
  const gameActive = document.getElementById('gameScreen')?.classList.contains('active');
  if (gameActive && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
  if (keys.has(e.code)) return; keys.add(e.code);
  if (!game || !gameRunning) return;
  switch (e.code) {
    case 'ArrowLeft': dasStart(-1); break;
    case 'ArrowRight': dasStart(1); break;
    case 'ArrowUp': game.rotate(1); break;
    case 'KeyX': e.preventDefault(); game.rotate(1); break;
    case 'KeyZ': e.preventDefault(); game.rotate(-1); break;
    case 'ArrowDown':
      if (!softDropInterval) { game.softDrop(); softDropInterval = setInterval(() => { if (game && gameRunning) game.softDrop(); }, 50); }
      break;
    case 'Space':
      if (game && !game.waiting) game.hardDrop();
      break;
    case 'KeyC': case 'ShiftLeft': case 'ShiftRight': case 'Shift':
      e.preventDefault(); game.hold(); break;
    case 'KeyV': triggerBurst(); break;
  }
});
document.addEventListener('keyup', e => {
  keys.delete(e.code);
  if (e.code === 'ArrowLeft' && dasDir === -1) dasStop();
  if (e.code === 'ArrowRight' && dasDir === 1) dasStop();
  if (e.code === 'ArrowDown') { clearInterval(softDropInterval); softDropInterval = null; }
});
window.addEventListener('blur', () => {
  keys.clear(); dasStop(); clearInterval(softDropInterval); softDropInterval = null;
});


function triggerBurst() {
  if (!game || !gameRunning || game.over) return;
  const atk = game.useBurst();
  if (atk > 0) {
    statAtkSent += atk;
    botGame.pendGarb += atk;
    pushLog('NEON BURST!!', 'var(--accent)');
    const bf = document.createElement('div'); bf.style.cssText = 'position:fixed;inset:0;background:rgba(0,245,255,0.25);z-index:30;pointer-events:none;';
    document.body.appendChild(bf); setTimeout(() => bf.remove(), 400);
    const bw = document.querySelector('.board-wrap');
    if (bw) { bw.classList.remove('shake'); void bw.offsetWidth; bw.classList.add('shake'); setTimeout(() => bw.classList.remove('shake'), 300); }
    showActionPopup("NEON BURST!!"); updateGameUI();
  }
}
function flashAttack() { const f = document.getElementById('attackFlash'); f.classList.add('show'); setTimeout(() => f.classList.remove('show'), 280); const bw = document.querySelector('.board-wrap'); if (bw) { bw.classList.remove('shake'); void bw.offsetWidth; bw.classList.add('shake'); setTimeout(() => bw.classList.remove('shake'), 260); } }

function pushLog(msg, color) {
  const log = document.getElementById('gameLog');
  if (!log) return;
  const div = document.createElement('div');
  div.textContent = msg;
  if (color) div.style.color = color;
  log.insertBefore(div, log.firstChild);
  while (log.children.length > 6) log.removeChild(log.lastChild);
}

function updateGameUI() {
  if (!game) return;
  const bg = game.burstGauge || 0;
  const canB = game.canBurst();
  if (bg !== uiCache.burst || canB !== uiCache.canBurst) {
    const bar = document.getElementById('burstGaugeBar');
    if (bar) bar.style.width = bg + '%';
    if (canB && !uiCache.canBurst) pushLog('BURST READY!!', 'var(--accent)');
    document.getElementById('burstReadyText').style.display = canB ? 'block' : 'none';
    const btnB = document.getElementById('btnBurst');
    if (btnB) btnB.style.display = canB ? 'flex' : 'none';
    uiCache.burst = bg; uiCache.canBurst = canB;
  }
  if (game.score !== uiCache.score) { const sd = document.getElementById('scoreDisplay'); sd.classList.remove('score-pop'); void sd.offsetWidth; sd.classList.add('score-pop'); sd.textContent = game.score; uiCache.score = game.score; }
  if (game.level !== uiCache.level) { document.getElementById('levelDisplay').textContent = game.level; uiCache.level = game.level; }
  if (game.lines !== uiCache.lines) { document.getElementById('linesDisplay').textContent = game.lines; uiCache.lines = game.lines; }
  if (game.combo !== uiCache.combo) { const cd = document.getElementById('comboDisplay'); if (game.combo > 1) { cd.classList.remove('pop'); void cd.offsetWidth; cd.classList.add('pop'); } cd.textContent = game.combo > 1 ? game.combo : 0; uiCache.combo = game.combo; if (game.combo > statMaxCombo) statMaxCombo = game.combo; }
  if (game.b2b !== uiCache.b2b) { document.getElementById('b2bBadge').className = 'b2b-badge ' + (game.b2b ? 'on' : 'off'); uiCache.b2b = game.b2b; }
  if (statAtkSent !== uiCache.sent) { document.getElementById('atkSentDisplay').textContent = statAtkSent; uiCache.sent = statAtkSent; }
  if (statAtkRecv !== uiCache.recv) { document.getElementById('atkRecvDisplay').textContent = statAtkRecv; uiCache.recv = statAtkRecv; }
  const pg = game.pendGarb || 0;
  if (pg !== uiCache.pg) {
    document.getElementById('pendGarbDisplay').textContent = pg;
    const pgc = document.getElementById('pendGarbCells'); pgc.innerHTML = '';
    for (let i = 0; i < Math.min(pg, 10); i++) { const d = document.createElement('div'); d.className = 'pg-cell' + (pg >= 8 ? ' warn' : ''); pgc.appendChild(d); }
    const gb = document.getElementById('garbBar'); gb.innerHTML = '';
    for (let i = 0; i < Math.min(pg, 20); i++) { const d = document.createElement('div'); d.className = 'garb-cell' + (pg >= 10 ? ' warn' : ''); gb.appendChild(d); }
    uiCache.pg = pg;
  }
}

document.getElementById('playerName').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });

initBgCanvas();

(function () {
  let _fbType = null;
  const s = document.createElement('style');
  s.textContent = `
#fb-btn{position:fixed;bottom:48px;right:14px;z-index:9000;width:44px;height:44px;border-radius:50%;
  background:linear-gradient(135deg,#7700ff,#cc00ff);border:2px solid rgba(204,0,255,.5);
  box-shadow:0 4px 16px rgba(204,0,255,.4);cursor:pointer;display:flex;align-items:center;
  justify-content:center;transition:transform .2s,box-shadow .2s;color:#fff;user-select:none;padding:0;}
#fb-btn:hover{transform:scale(1.12);box-shadow:0 6px 24px rgba(204,0,255,.7);}
#fb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9001;display:none;
  align-items:center;justify-content:center;backdrop-filter:blur(4px);}
#fb-overlay.show{display:flex;}
#fb-modal{background:#080d18;border:1px solid rgba(204,0,255,.4);border-radius:6px;
  padding:28px 26px;width:min(420px,92vw);position:relative;
  box-shadow:0 0 40px rgba(204,0,255,.2);font-family:'Orbitron',monospace;}
#fb-modal::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;
  background:linear-gradient(90deg,#7700ff,#cc00ff,#00f5ff);border-radius:6px 6px 0 0;}
#fb-modal h2{font-family:'Press Start 2P',monospace;font-size:11px;color:#cc00ff;letter-spacing:2px;margin-bottom:20px;}
.fb-x{position:absolute;top:12px;right:16px;background:none;border:none;color:#4a6080;font-size:22px;cursor:pointer;line-height:1;padding:0;transition:color .2s;}
.fb-x:hover{color:#cc00ff;}
.fb-lbl{font-size:10px;color:#4a6080;letter-spacing:2px;margin-bottom:8px;display:block;}
.fb-types{display:flex;gap:7px;margin-bottom:18px;}
.fb-t{flex:1;padding:9px 2px;border-radius:4px;cursor:pointer;font-family:'Orbitron',monospace;font-size:8px;font-weight:700;letter-spacing:1px;text-align:center;transition:all .15s;border:1px solid #1a2540;color:#4a6080;background:transparent;}
.fb-t:hover{border-color:#cc00ff;color:#cc00ff;}
.fb-t.sel-bug{border-color:#ff3355;color:#ff3355;background:rgba(255,51,85,.08);}
.fb-t.sel-feedback{border-color:#00f5ff;color:#00f5ff;background:rgba(0,245,255,.08);}
.fb-t.sel-idea{border-color:#aaff00;color:#aaff00;background:rgba(170,255,0,.08);}
.fb-t.sel-other{border-color:#ff8800;color:#ff8800;background:rgba(255,136,0,.08);}
.fb-ta{width:100%;min-height:100px;background:rgba(0,0,0,.4);border:1px solid #1a2540;border-radius:4px;color:#e0f0ff;font-family:'Orbitron',monospace;font-size:12px;padding:11px;resize:vertical;outline:none;transition:border-color .2s;margin-bottom:14px;box-sizing:border-box;}
.fb-ta:focus{border-color:#cc00ff;}
.fb-ta::placeholder{color:#2a3a55;}
.fb-sub{width:100%;padding:12px;border:none;border-radius:4px;background:linear-gradient(135deg,#7700ff,#cc00ff);color:#fff;font-family:'Orbitron',monospace;font-size:11px;font-weight:700;letter-spacing:2px;cursor:pointer;transition:all .2s;box-sizing:border-box;}
.fb-sub:hover{transform:translateY(-1px);box-shadow:0 0 20px rgba(204,0,255,.5);}
.fb-sub:disabled{opacity:.4;cursor:not-allowed;transform:none;}
.fb-err{font-size:10px;color:#ff3355;letter-spacing:1px;margin-bottom:10px;min-height:14px;}
.fb-ok{text-align:center;padding:24px 0;font-family:'Press Start 2P',monospace;font-size:10px;color:#aaff00;letter-spacing:2px;line-height:2.4;}
`;
  document.head.appendChild(s);
  const w = document.createElement('div');
  w.innerHTML = `
<button id="fb-btn" title="バグ報告・フィードバック">
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M17 13a1 1 0 01-1 1H6l-4 4V4a1 1 0 011-1h13a1 1 0 011 1v9z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <circle cx="7" cy="8.5" r="1" fill="currentColor"/>
    <circle cx="10" cy="8.5" r="1" fill="currentColor"/>
    <circle cx="13" cy="8.5" r="1" fill="currentColor"/>
  </svg>
</button>
<div id="fb-overlay">
  <div id="fb-modal">
    <button class="fb-x" id="fb-close">×</button>
    <h2>REPORT FEEDBACK</h2>
    <div id="fb-body">
      <span class="fb-lbl">CATEGORY</span>
      <div class="fb-types">
        <button class="fb-t" data-t="bug">BUG バグ</button>
        <button class="fb-t" data-t="feedback">MSG 感想</button>
        <button class="fb-t" data-t="idea">IDEA アイデア</button>
        <button class="fb-t" data-t="other">PIN その他</button>
      </div>
      <span class="fb-lbl">MESSAGE</span>
      <textarea class="fb-ta" id="fb-text" placeholder="例: ○○の操作をすると△△が起きます..." maxlength="1000"></textarea>
      <div class="fb-err" id="fb-err"></div>
      <button class="fb-sub" id="fb-send">送信する ▶</button>
    </div>
    <div id="fb-done" style="display:none">
      <div class="fb-ok">✓ 送信完了！<br>ありがとうございます</div>
      <button class="fb-sub" id="fb-done-close">閉じる</button>
    </div>
  </div>
</div>`;
  document.body.appendChild(w);
  const overlay = document.getElementById('fb-overlay');
  document.getElementById('fb-btn').onclick = () => {
    overlay.classList.add('show');
    document.getElementById('fb-body').style.display = '';
    document.getElementById('fb-done').style.display = 'none';
    document.getElementById('fb-text').value = '';
    document.getElementById('fb-err').textContent = '';
    _fbType = null;
    document.querySelectorAll('.fb-t').forEach(b => b.className = 'fb-t');
    setTimeout(() => document.getElementById('fb-text').focus(), 80);
  };
  document.getElementById('fb-close').onclick = () => overlay.classList.remove('show');
  document.getElementById('fb-done-close').onclick = () => overlay.classList.remove('show');
  overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('show'); };
  document.querySelectorAll('.fb-t').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.fb-t').forEach(b => b.className = 'fb-t');
      _fbType = btn.dataset.t;
      btn.className = 'fb-t sel-' + _fbType;
      document.getElementById('fb-err').textContent = '';
    };
  });
  document.getElementById('fb-text').addEventListener('keydown', e => { if (e.key === 'Enter' && e.ctrlKey) document.getElementById('fb-send').click(); });
  document.getElementById('fb-send').onclick = async () => {
    const text = document.getElementById('fb-text').value.trim();
    const errEl = document.getElementById('fb-err');
    if (!_fbType) { errEl.textContent = '⚠ カテゴリを選択してください'; return; }
    if (text.length < 5) { errEl.textContent = '⚠ もう少し詳しく教えてください'; return; }
    const btn = document.getElementById('fb-send');
    btn.disabled = true; btn.textContent = '送信中...'; errEl.textContent = '';
    try {
      const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      const { FB_CONFIG } = await import('./config.js');
      const app = getApps().length ? getApps()[0] : initializeApp(FB_CONFIG);
      const { getFirestore, collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      const fs = getFirestore(app);
      await addDoc(collection(fs, 'reports'), {
        type: _fbType, message: text, page: 'ボット対戦',
        version: APP_VERSION, ua: navigator.userAgent.slice(0, 200),
        ts: serverTimestamp(), status: 'new', gameMode: 'battle',
      });
      document.getElementById('fb-body').style.display = 'none';
      document.getElementById('fb-done').style.display = '';
    } catch (e) {
      errEl.textContent = '⚠ 送信失敗: ' + (e.message || 'エラー');
      btn.disabled = false; btn.textContent = '送信する ▶';
    }
  };
})();

setTimeout(() => {
  if (_loaderInstance && _loaderInstance.loader && _loaderInstance.loader.parentElement) {
    if (_loaderInstance.finish) _loaderInstance.finish();
    _loaderInstance.loader.classList.add('hide');
    setTimeout(() => { try { _loaderInstance.loader.remove(); } catch (e) { } }, 500);
  }
}, 5000);
