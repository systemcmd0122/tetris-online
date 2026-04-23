import { mountNav, notifyOk, notifyErr, notifyWarn, notifyInfo } from './nav.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, off, update, remove, onDisconnect, runTransaction }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { APP_VERSION, FB_CONFIG } from './config.js';
import { onAuthReady, getCachedProfile, mountAuthWidget, getCurrentUser } from './auth.js';
import { saveMultiResult, upsertUserProfile } from './db.js';
import { TetrisGame, getServerTime, setServerTimeOffset, COLS, ROWS, CELL, COLORS, PIECES, NAMES, RN, LS, TS, mkP } from './tetris-engine.js';
import { BotController } from './tetris-bot.js';

mountNav();

const fbApp = initializeApp(FB_CONFIG);
const db = getDatabase(fbApp);
onValue(ref(db, '.info/serverTimeOffset'), snap => { setServerTimeOffset(snap.val() || 0); });

document.getElementById('statusText').textContent = 'ONLINE';
document.getElementById('statusText').className = 'status-online';
document.getElementById('versionDisp').textContent = `VER ${APP_VERSION}`;

// ── BOT CONFIG SYNC ──
let BOT_DELAYS = [750, 400, 80];
let BOT_NOISE = [0.4, 0.15, 0.0];
try {
  const snap = await get(ref(db, 'config/bot'));
  if (snap.exists()) {
    const d = snap.val();
    if (d.delays) BOT_DELAYS = d.delays;
    if (d.noise) BOT_NOISE = d.noise;
  }
} catch (e) { }

// ── AUTH WIDGET & NAME LOCK ──
mountAuthWidget('multiAuthWidget');
let _authUser = null;
function _getPlayerName() {
  if (_authUser) {
    const p = getCachedProfile();
    return ((p?.displayName || _authUser.displayName || _authUser.email || 'PLAYER')
      .trim().replace(/\//g, '_').slice(0, 12).toUpperCase() || 'PLAYER');
  }
  return (document.getElementById('playerName')?.value.trim() || 'PLAYER').toUpperCase().slice(0, 12);
}
onAuthReady(async user => {
  _authUser = user;
  const inp = document.getElementById('playerName');
  if (!inp) return;
  if (user) {
    await upsertUserProfile(user).catch(() => { });
    const name = _getPlayerName();
    inp.value = name; inp.readOnly = true;
    inp.style.opacity = '0.6'; inp.style.cursor = 'not-allowed';
    inp.title = 'ログイン中はアカウント名が使用されます';
  } else {
    inp.readOnly = false; inp.style.opacity = ''; inp.style.cursor = ''; inp.title = '';
  }
});

// マッチングキューの古いエントリ（5分以上）をページ読み込み時に清掃
(async () => {
  try {
    const snap = await get(ref(db, 'matchmaking/queue'));
    if (!snap.exists()) return;
    const now = getServerTime();
    const removes = [];
    snap.forEach(child => {
      const d = child.val();
      if (d && d.ts && (now - d.ts) > 10 * 60 * 1000) removes.push(remove(ref(db, 'matchmaking/queue/' + child.key)));
    });
    if (removes.length) await Promise.all(removes);
  } catch (e) { }
})();

const playSound = () => { };

// ── GAME STATE ──
let roomCode = null, mySlot = null, game = null, gameRunning = false, animId = null;
let _rematchActive = false;
let endedOnce = false, _maxPlayers = 3, totalPlayers = 0, myFinalRank = null, statAtkSent = 0;
const oppInfo = {};

const _subs = {};
function _addSub(key, fn) { _removeSub(key); _subs[key] = fn; }
function _removeSub(key) { if (_subs[key]) { try { _subs[key](); } catch (e) { } delete _subs[key]; } }
const genCode = () => Math.floor(1000 + Math.random() * 9000).toString();
const SBORDER = ['', '#00f5ff', '#ff0080', '#aaff00', '#ff8800'];
const SGLOW = ['', 'rgba(0,245,255,.3)', 'rgba(255,0,128,.3)', 'rgba(170,255,0,.3)', 'rgba(255,136,0,.3)'];
const SLCLS = ['', 'lp1', 'lp2', 'lp3', 'lp4'];

let _qmBotGame = null, _qmBotCtrl = null;

const QM_TIMEOUT_MS = 30000;
const QM_QUEUE_PATH = 'matchmaking/queue';
const QM_MATCH_PATH = 'matchmaking/matches';

let _qmState = null;
let _qmMyId = null;
let _qmTimerStart = 0;
let _qmTimerInterval = null;
let _qmListenerOff = null;
let _qmMatchListenerOff = null;
let _qmIsBot = false;

function _qmUpdateTimer() {
  if (_qmState !== 'searching') return;
  const elapsed = Date.now() - _qmTimerStart;
  const remain = Math.max(0, QM_TIMEOUT_MS - elapsed);
  const pct = (remain / QM_TIMEOUT_MS) * 100;
  const bar = document.getElementById('matchTimerBar');
  const txt = document.getElementById('matchTimerText');
  if (bar) { bar.style.width = pct + '%'; bar.className = 'match-timer-bar' + (pct < 30 ? ' danger' : ''); }
  if (txt) txt.textContent = Math.ceil(remain / 1000);
  if (remain <= 0) { clearInterval(_qmTimerInterval); _startBotFallback(); }
}

window.quickMatch = async () => {
  const user = getCurrentUser();
  if (!user) {
    showToast('クイックマッチを利用するには Google アカウントでログインしてください', 'err');
    return;
  }

  if (_qmState) return;
  const name = _getPlayerName();
  _qmState = 'searching';
  _qmIsBot = false;
  showScreen('matchingScreen');
  document.getElementById('matchStatusText').textContent = 'キューに参加しています...';
  document.getElementById('matchFoundArea').style.display = 'none';
  document.getElementById('matchDots').style.display = 'flex';
  document.getElementById('matchMyName').textContent = name;
  document.getElementById('matchOppName').textContent = '???';
  document.getElementById('matchTimerBar').style.width = '100%';
  document.getElementById('matchTimerBar').className = 'match-timer-bar';

  _qmMyId = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const myRef = ref(db, QM_QUEUE_PATH + '/' + _qmMyId);
  try {
    await set(myRef, { name, ts: getServerTime(), id: _qmMyId });
    onDisconnect(myRef).remove();
  } catch (e) {
    _qmCleanup();
    showScreen('lobbyScreen');
    showToast('接続エラー: ' + e.message, 'warn');
    return;
  }

  _qmTimerStart = Date.now();
  _qmTimerInterval = setInterval(_qmUpdateTimer, 500);

  const queueRef = ref(db, QM_QUEUE_PATH);
  let _matching = false;
  let _qmUnsubQueue = null;
  const _qmListen = async snap => {
    if (_qmState !== 'searching' || _matching) return;
    const data = snap.val();
    if (!data) return;

    const entries = Object.values(data)
      .filter(e => e && e.id && e.ts)
      .sort((a, b) => a.ts - b.ts);

    if (entries.length < 2) {
      document.getElementById('matchStatusText').textContent = 'マッチング中... (' + entries.length + '人待機中)';
      return;
    }

    const p1Entry = entries[0];
    const p2Entry = entries[1];

    const amIp1 = p1Entry.id === _qmMyId;
    const amIp2 = p2Entry.id === _qmMyId;
    if (!amIp1 && !amIp2) return;

    _matching = true;
    document.getElementById('matchStatusText').textContent = '対戦相手が見つかりました！';

    if (amIp1) {
      const code = genCode();
      const gsa = getServerTime() + 5000;
      try {
        const rRef = ref(db, 'multi/' + code);
        await set(rRef, {
          p1: { name: p1Entry.name, alive: true },
          p2: { name: p2Entry.name, alive: true },
          status: 'started',
          maxPlayers: 2,
          gameStartAt: gsa,
          activeSlots: ['p1', 'p2'],
          ts: getServerTime()
        });
        onDisconnect(rRef).remove();
        await set(ref(db, QM_MATCH_PATH + '/' + p2Entry.id), {
          code, role: 'p2', ts: getServerTime(),
          gameStartAt: gsa,
          p1name: p1Entry.name, p2name: p2Entry.name
        });
        await remove(ref(db, QM_QUEUE_PATH + '/' + p1Entry.id));
        await remove(ref(db, QM_QUEUE_PATH + '/' + p2Entry.id));

        _qmShowMatchFound(p1Entry.name, p2Entry.name, () => {
          _qmCleanup();
          mySlot = 'p1'; roomCode = code; endedOnce = false;
          document.getElementById('statusRoom').textContent = 'QM: ' + code;
          const roomData = { p1: { name: p1Entry.name, alive: true }, p2: { name: p2Entry.name, alive: true }, status: 'started', maxPlayers: 2, gameStartAt: gsa, activeSlots: ['p1', 'p2'] };
          startGame(roomData, true);
        });
      } catch (e) {
        _matching = false;
        _qmCleanup();
        showScreen('lobbyScreen');
        showToast('マッチングエラー: ' + e.message, 'warn');
      }
    } else {
      document.getElementById('matchStatusText').textContent = '対戦相手が見つかりました！接続中...';
      const matchRef = ref(db, QM_MATCH_PATH + '/' + _qmMyId);
      _qmMatchListenerOff = onValue(matchRef, async msnap => {
        const md = msnap.val();
        if (!md || !md.code) return;
        if (_qmMatchListenerOff) { try { _qmMatchListenerOff(); } catch (e) { } _qmMatchListenerOff = null; }
        const code = md.code;
        try { await remove(ref(db, QM_MATCH_PATH + '/' + _qmMyId)); } catch (e) { }

        _qmShowMatchFound(p2Entry.name, p1Entry.name, async () => {
          _qmCleanup();
          mySlot = 'p2'; roomCode = code; endedOnce = false;
          document.getElementById('statusRoom').textContent = 'QM: ' + code;
          const qmRoomData = {
            p1: { name: md.p1name || p1Entry.name, alive: true },
            p2: { name: md.p2name || p2Entry.name, alive: true },
            status: 'started',
            maxPlayers: 2,
            gameStartAt: md.gameStartAt || (getServerTime() + 5000),
            activeSlots: ['p1', 'p2']
          };
          startGame(qmRoomData, true);
        });
      });
    }
  };
  _qmUnsubQueue = onValue(queueRef, _qmListen);
  _qmListenerOff = () => { if (_qmUnsubQueue) { try { _qmUnsubQueue(); } catch (e) { } } _qmUnsubQueue = null; };
};

const _QM_BOT_NAMES = [
  'HARUKI', 'RIKU', 'SORA', 'KAITO', 'YUI', 'AIKA', 'RINA', 'TOMO',
  'KENTO', 'NANA', 'SHUN', 'MIKU', 'DAIKI', 'HINA', 'SOTA', 'YUNA',
  'PLAYER7', 'PLAYER13', 'PLAYER42', 'PLAYER88', 'PLAYER99',
  'ACE', 'NOVA', 'PIXEL', 'GHOST', 'ZERO', 'BLAZE', 'STORM',
  'RYUSEI', 'HIKARU', 'AKIRA', 'MISAKI', 'KOHARU', 'TAKUMI',
];
function _qmRandomBotName() {
  return _QM_BOT_NAMES[Math.floor(Math.random() * _QM_BOT_NAMES.length)];
}
let _qmBotDisplayName = '';

function _qmShowMatchFound(myName, oppName, cb) {
  document.getElementById('matchOppName').textContent = oppName || 'PLAYER';
  document.getElementById('matchMyName').textContent = myName || 'PLAYER';
  document.getElementById('matchFoundArea').style.display = 'block';
  document.getElementById('matchDots').style.display = 'none';
  document.getElementById('matchStatusText').textContent = '';
  clearInterval(_qmTimerInterval);
  playSound('go');
  setTimeout(cb, 1800);
}

function _startBotFallback() {
  if (_qmState !== 'searching') return;
  _qmState = 'bot';
  _qmIsBot = true;
  _qmBotDisplayName = _qmRandomBotName();
  _qmCleanupQueue();
  document.getElementById('matchStatusText').textContent = '対戦相手が見つかりました！';
  document.getElementById('matchFoundArea').style.display = 'block';
  document.getElementById('matchDots').style.display = 'none';
  document.getElementById('matchOppName').textContent = _qmBotDisplayName;
  document.getElementById('matchTimerBar').style.width = '0%';
  playSound('go');
  setTimeout(() => {
    if (_qmState !== 'bot') return;
    _qmCleanup();
    _startQmBotGame();
  }, 1800);
}

async function _qmCleanupQueue() {
  if (_qmMyId) {
    try { await remove(ref(db, QM_QUEUE_PATH + '/' + _qmMyId)); } catch (e) { }
    try { await remove(ref(db, QM_MATCH_PATH + '/' + _qmMyId)); } catch (e) { }
  }
}
function _qmCleanup() {
  _qmState = null;
  clearInterval(_qmTimerInterval); _qmTimerInterval = null;
  if (_qmListenerOff) { try { _qmListenerOff(); } catch (e) { } _qmListenerOff = null; }
  if (_qmMatchListenerOff) { try { _qmMatchListenerOff(); } catch (e) { } _qmMatchListenerOff = null; }
  _qmCleanupQueue();
  _qmMyId = null;
}

window.cancelQuickMatch = async () => {
  _qmCleanup();
  _qmIsBot = false;
  _qmBotStop();
  showScreen('lobbyScreen');
};

function _qmBotStop() {
  if (_qmBotCtrl) { _qmBotCtrl = null; }
  if (_qmBotGame) { _qmBotGame = null; }
}

function _startQmBotGame() {
  const name = _getPlayerName();
  endedOnce = false;
  mySlot = 'p1'; roomCode = null; totalPlayers = 2;
  showScreen('gameScreen');
  clearBoards();

  document.getElementById('myNameTag').textContent = name;
  document.getElementById('myLabel').className = 'player-label lp1';
  document.getElementById('myLabel').textContent = 'P1';
  document.getElementById('myCanvas').style.cssText = `display:block;image-rendering:pixelated;border:1px solid ${SBORDER[1]};box-shadow:0 0 16px ${SGLOW[1]}`;

  const active = ['p1', 'p2'];
  buildOppArea(active);
  if (!_qmBotDisplayName) _qmBotDisplayName = _qmRandomBotName();
  const oppNtEl = document.getElementById('oppName_p2');
  if (oppNtEl) oppNtEl.textContent = _qmBotDisplayName;

  document.getElementById('statusRoom').textContent = 'QUICK MATCH';

  game = new TetrisGame('myCanvas', 'holdCanvas', 'nextCanvas');
  _qmBotGame = new TetrisGame('oppCvs_p2', null, null);
  _qmBotCtrl = new BotController(_qmBotGame, 2, BOT_DELAYS, BOT_NOISE);
  gameRunning = true; endedOnce = false;

  const gsa = getServerTime() + 4000;
  doCountdown(gsa).then(aborted => {
    if (aborted) return;

    const loop = ts => {
      if (!gameRunning) return;
      game._lastTs = ts;
      game.update(ts); game.draw();
      _qmBotCtrl.tick(ts); _qmBotGame.update(ts);

      const bd = {
        board: _qmBotGame.board.slice(2).map(r => r.map(c => c || '')),
        cur: { name: _qmBotGame.current.name, rot: _qmBotGame.current.rot, x: _qmBotGame.current.x, y: _qmBotGame.current.y },
        gameOver: _qmBotGame.over
      };
      const oppCvs = document.getElementById('oppCvs_p2');
      if (oppCvs) TetrisGame.drawOpp(oppCvs, bd, 300, 600);

      const oppNt = document.getElementById('oppName_p2');
      if (oppNt) oppNt.textContent = _qmBotDisplayName + ' (' + _qmBotGame.score + ')';

      while (game.results.length > 0) {
        const res = game.results.shift();
        if (res.garbageOut > 0) { statAtkSent += res.garbageOut; _qmBotGame.pendGarb += res.garbageOut; }
        if (res.actionLabel) { showAP(res.actionLabel); pushLog(res.actionLabel.replace("\n", " "), "var(--accent)"); }
      }
      while (_qmBotGame.results.length > 0) {
        const res = _qmBotGame.results.shift();
        if (res.garbageOut > 0) {
          game.pendGarb += res.garbageOut;
          const badge = document.getElementById('attackBadge');
          badge.textContent = '+' + res.garbageOut + ' !';
          badge.classList.remove('show'); void badge.offsetWidth; badge.classList.add('show');
          setTimeout(() => badge.classList.remove('show'), 1200);
          flashAttack(); playSound('attack');
        }
      }
      updateUI();

      if (game.over && _qmBotGame.over && !endedOnce) { endGame(2); return; }
      if (game.over && !endedOnce) { endGame(2); return; }
      if (_qmBotGame.over && !game.over && !endedOnce) { endGame(1); return; }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
  });
}

function offAll() {
  Object.keys(_subs).forEach(k => _removeSub(k));
}
function resetState() {
  offAll(); gameRunning = false; endedOnce = false;
  _rematchActive = false;
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  roomCode = null; mySlot = null; game = null; myFinalRank = null; totalPlayers = 0; statAtkSent = 0;
  Object.keys(oppInfo).forEach(k => delete oppInfo[k]);
  dasStop(); clearInterval(sdi); sdi = null;
  Object.keys(uiC).forEach(k => uiC[k] = -1); uiC.b2b = null;
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.body.classList.toggle('game-active', id === 'gameScreen');
}
function showToast(msg, type = '') { const t = document.getElementById('toast'); t.textContent = msg; t.className = 'toast' + (type ? ' ' + type : ''); t.classList.remove('show'); t.offsetHeight; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
function flashAttack() { const f = document.getElementById('attackFlash'); f.classList.add('show'); setTimeout(() => f.classList.remove('show'), 280); const bw = document.querySelector('.board-wrap'); if (bw) { bw.classList.remove('shake'); void bw.offsetWidth; bw.classList.add('shake'); setTimeout(() => bw.classList.remove('shake'), 260); } }
function showAP(lbl) { const p = document.getElementById('actionPopup'); p.textContent = lbl.replace('\n', ' / '); p.classList.remove('show'); p.offsetHeight; p.classList.add('show'); }

function pushLog(msg, color) {
  const log = document.getElementById("gameLog");
  if (!log) return;
  const div = document.createElement("div");
  div.textContent = msg;
  if (color) div.style.color = color;
  log.insertBefore(div, log.firstChild);
  while (log.children.length > 6) log.removeChild(log.lastChild);
}

function triggerBurst() {
  if (!game || !gameRunning || game.over) return;
  const atk = game.useBurst();
  if (atk > 0) {
    game.results.push({ cleared: 0, garbageOut: atk, actionLabel: "NEON BURST!!" });
    const bf = document.getElementById('burstFlash');
    if (bf) { bf.classList.add('show'); setTimeout(() => bf.classList.remove('show'), 400); }
    const bw = document.querySelector('.board-wrap');
    if (bw) { bw.classList.remove('shake'); void bw.offsetWidth; bw.classList.add('shake'); setTimeout(() => bw.classList.remove('shake'), 300); }
    updateUI();
  }
}

const uiC = { score: -1, level: -1, lines: -1, combo: -1, b2b: null, sent: -1, pg: -1, burst: -1, canBurst: null };
function updateUI() {
  if (!game) return;
  if (game.score !== uiC.score) { const sd = document.getElementById('scoreDisplay'); sd.classList.remove('score-pop'); void sd.offsetWidth; sd.classList.add('score-pop'); sd.textContent = game.score; uiC.score = game.score; }
  if (game.level !== uiC.level) { document.getElementById('levelDisplay').textContent = game.level; uiC.level = game.level; }
  if (game.lines !== uiC.lines) { document.getElementById('linesDisplay').textContent = game.lines; uiC.lines = game.lines; }
  if (game.combo !== uiC.combo) { const cd = document.getElementById('comboDisplay'); if (game.combo > 1) { cd.classList.remove('pop'); void cd.offsetWidth; cd.classList.add('pop'); } cd.textContent = game.combo > 1 ? game.combo : 0; uiC.combo = game.combo; }
  if (game.b2b !== uiC.b2b) { document.getElementById('b2bBadge').className = 'b2b-badge ' + (game.b2b ? 'on' : 'off'); uiC.b2b = game.b2b; }
  if (statAtkSent !== uiC.sent) { document.getElementById('atkSentDisplay').textContent = statAtkSent; uiC.sent = statAtkSent; }
  const pg = game.pendGarb || 0;
  if (pg !== uiC.pg) {
    document.getElementById('pendGarbDisplay').textContent = pg;
    const pgc = document.getElementById('pendGarbCells'); pgc.innerHTML = '';
    for (let i = 0; i < Math.min(pg, 10); i++) { const d = document.createElement('div'); d.className = 'pg-cell' + (pg >= 8 ? ' warn' : ''); pgc.appendChild(d); }
    const gb = document.getElementById('garbBar'); gb.innerHTML = '';
    for (let i = 0; i < Math.min(pg, 20); i++) { const d = document.createElement('div'); d.className = 'garb-cell' + (pg >= 10 ? ' warn' : ''); gb.appendChild(d); }
    uiC.pg = pg;
  }
  const aliveOpps = Object.values(oppInfo).filter(d => d.alive).length;
  const myAlive = game.over ? 0 : 1;
  const tot = myAlive + aliveOpps;
  document.getElementById('aliveDisplay').textContent = tot + '/' + totalPlayers;
  if (myFinalRank === null) document.getElementById('rankDisplay').textContent = tot;

  const bg = game.burstGauge || 0;
  const canB = game.canBurst();
  if (bg !== uiC.burst || canB !== uiC.canBurst) {
    const bar = document.getElementById('burstGaugeBar');
    if (bar) bar.style.width = bg + '%';
    document.getElementById('burstReadyText').style.display = canB ? 'block' : 'none';
    document.getElementById('btnBurst').style.display = canB ? 'flex' : 'none';
    uiC.burst = bg;
    uiC.canBurst = canB;
  }
}
function clearBoards() {
  ['myCanvas', 'holdCanvas', 'nextCanvas'].forEach(id => { const el = document.getElementById(id); if (el) { const ctx = el.getContext('2d'); ctx.clearRect(0, 0, el.width, el.height); } });
  document.getElementById('scoreDisplay').textContent = '0'; document.getElementById('levelDisplay').textContent = '1'; document.getElementById('linesDisplay').textContent = '0'; document.getElementById('comboDisplay').textContent = '0'; document.getElementById('b2bBadge').className = 'b2b-badge off'; document.getElementById('atkSentDisplay').textContent = '0'; document.getElementById('pendGarbDisplay').textContent = '0'; document.getElementById('pendGarbCells').innerHTML = ''; document.getElementById('garbBar').innerHTML = ''; document.getElementById('attackBadge').classList.remove('show'); document.getElementById('rankDisplay').textContent = '?'; document.getElementById('aliveDisplay').textContent = '?'; statAtkSent = 0; myFinalRank = null;
  const bar = document.getElementById('burstGaugeBar'); if (bar) bar.style.width = '0%';
  const ready = document.getElementById('burstReadyText'); if (ready) ready.style.display = 'none';
  Object.keys(uiC).forEach(k => { uiC[k] = -1 }); uiC.b2b = null;
  const rb = document.getElementById('rematchBtn'); if (rb) rb.disabled = false;
  const rs = document.getElementById('rematchStatus'); if (rs) rs.textContent = '';
}
function buildOppArea(activeSlots) {
  const area = document.getElementById('opponentsArea');
  area.innerHTML = '';
  Object.keys(oppInfo).forEach(k => delete oppInfo[k]);
  const ops = activeSlots.filter(s => s !== mySlot);
  const W = 300, H = 600;
  ops.forEach(sk => {
    const idx = parseInt(sk.replace('p', ''));
    const sec = document.createElement('div');
    sec.className = 'opp-section'; sec.id = 'oppSec_' + sk;

    const lb = document.createElement('div'); lb.className = `player-label ${SLCLS[idx] || 'lp2'}`; lb.textContent = 'P' + idx; lb.id = 'oppLabel_' + sk;
    const nt = document.createElement('div'); nt.className = 'player-name-tag'; nt.id = 'oppName_' + sk; nt.textContent = '...';
    const wrap = document.createElement('div'); wrap.className = 'opp-canvas-wrap'; wrap.id = 'oppWrap_' + sk; wrap.style.position = 'relative';
    const cvs = document.createElement('canvas');
    cvs.id = 'oppCvs_' + sk; cvs.width = W; cvs.height = H;
    cvs.style.cssText = `border:1px solid ${SBORDER[idx] || '#ff0080'};box-shadow:0 0 12px ${SGLOW[idx] || 'rgba(255,0,128,.3)'};display:block;image-rendering:pixelated`;
    const dead = document.createElement('div'); dead.className = 'opp-dead-overlay'; dead.id = 'oppDead_' + sk; dead.textContent = 'OUT';

    const stag = document.createElement('div'); stag.className = 'opp-score-tag'; stag.id = 'oppScore_' + sk; stag.textContent = '0';
    wrap.appendChild(cvs); wrap.appendChild(dead);
    sec.appendChild(lb); sec.appendChild(nt); sec.appendChild(wrap); sec.appendChild(stag);
    area.appendChild(sec);
    oppInfo[sk] = { canvas: cvs, W, H, alive: true };
  });
  requestAnimationFrame(() => requestAnimationFrame(scaleGameLayout));
}

function scaleGameLayout() {
  const layout = document.getElementById('multiLayout');
  if (!layout) return;

  layout.style.transform = '';
  layout.style.marginBottom = '';

  const naturalW = layout.offsetWidth;
  if (!naturalW) return;

  const padding = 32;
  const availW = window.innerWidth - padding;

  if (naturalW > availW) {
    const scale = availW / naturalW;
    layout.style.transform = `scale(${scale})`;
    layout.style.transformOrigin = 'top center';
    const naturalH = layout.offsetHeight;
    const collapsedH = naturalH * scale;
    const gap = naturalH - collapsedH;
    layout.style.marginBottom = `-${gap}px`;
  }
}
window.addEventListener('resize', scaleGameLayout);

window.setMaxPlayers = (n) => { _maxPlayers = n;[2, 3, 4].forEach(x => { const b = document.getElementById('maxBtn' + x); if (b) b.className = 'max-btn' + (x === n ? ' sel' : ''); }); };
window.copyRoomCode = () => { if (!roomCode) return; navigator.clipboard?.writeText(roomCode).then(() => showToast('コードをコピーしました！', 'ok')).catch(() => showToast('コード: ' + roomCode)); };

window.createRoom = async () => {
  const name = _getPlayerName();
  mySlot = 'p1'; roomCode = genCode(); endedOnce = false;
  const rRef = ref(db, 'multi/' + roomCode);
  await set(rRef, { p1: { name, alive: true }, status: 'waiting', maxPlayers: _maxPlayers, ts: getServerTime() });
  onDisconnect(rRef).remove();
  showScreen('waitingScreen');
  document.getElementById('displayRoomCode').textContent = roomCode;
  document.getElementById('statusRoom').textContent = 'MULTI: ' + roomCode;
  listenWait();
};
function listenWait() {
  _removeSub('room');
  const rRef = ref(db, 'multi/' + roomCode);
  _addSub('room', onValue(rRef, snap => {
    const d = snap.val();
    if (!d) { offAll(); resetState(); showScreen('lobbyScreen'); showToast('ルームが削除されました', 'warn'); return; }
    if (d.status === 'started') { _removeSub('room'); startGame(d); return; }
    renderWait(d);
  }));
}
function renderWait(d) {
  const max = d.maxPlayers || 3, slots = ['p1', 'p2', 'p3', 'p4'].slice(0, max);
  const filled = slots.filter(s => !!d[s]);
  document.getElementById('playerCountInfo').textContent = `${filled.length} / ${max} 人が参加中`;
  const list = document.getElementById('playerList'); list.innerHTML = '';
  slots.forEach((s, i) => {
    const idx = i + 1, div = document.createElement('div');
    div.className = 'player-slot' + (d[s] ? ' filled' : ' empty');
    if (d[s]) div.style.borderColor = SBORDER[idx];
    const bgs = []; if (s === 'p1') bgs.push('<span class="slot-badge host">HOST</span>'); if (s === mySlot) bgs.push('<span class="slot-badge you">YOU</span>');
    div.innerHTML = d[s] ? `<span class="slot-num" style="color:${SBORDER[idx]}">P${idx}</span><span class="slot-name">${d[s].name}</span>${bgs.join('')}` : `<span class="slot-num">P${idx}</span><span class="slot-name">WAITING...</span>`;
    list.appendChild(div);
  });
  const sb = document.getElementById('startGameBtn'), wl = document.getElementById('waitingLabel');
  if (filled.length >= 2 && mySlot === 'p1') { sb.style.display = 'block'; sb.textContent = `▶ ゲーム開始 (${filled.length}人)`; wl.textContent = filled.length < max ? `あと${max - filled.length}人参加可能` : '全員揃いました！'; }
  else { sb.style.display = 'none'; wl.textContent = mySlot === 'p1' ? 'あと1人以上必要です' : 'ホストのゲーム開始を待っています'; }
}

window.joinRoom = async () => {
  const user = getCurrentUser();
  if (!user) {
    showToast('ゲームを利用するには Google アカウントでログインしてください', 'err');
    return;
  }

  const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
  if (code.length !== 4 || !/^[0-9]{4}$/.test(code)) { showToast('4桁の数字コードを入力してください', 'warn'); return; }
  const name = _getPlayerName();
  const rRef = ref(db, 'multi/' + code);

  try {
    const result = await runTransaction(rRef, (d) => {
      if (!d) return d;
      if (d.status === 'started' || d.status !== 'waiting') return;
      const max = d.maxPlayers || 3, slots = ['p1', 'p2', 'p3', 'p4'].slice(0, max);
      const free = slots.find(s => !d[s]);
      if (!free) return;
      d[free] = { name, alive: true };
      return d;
    });

    if (!result.committed) {
      showToast('参加できませんでした（満員または開始済み）', 'warn');
      return;
    }

    const d = result.snapshot.val();
    if (!d) { showToast('ルームが見つかりません', 'warn'); return; }
    const max = d.maxPlayers || 3, slots = ['p1', 'p2', 'p3', 'p4'].slice(0, max);
    const assigned = slots.find(s => d[s] && d[s].name === name);
    if (!assigned) throw new Error('スロット割り当てに失敗しました');

    mySlot = assigned; roomCode = code; endedOnce = false;
    onDisconnect(ref(db, 'multi/' + code + '/' + assigned)).remove();
    document.getElementById('displayRoomCode').textContent = code;
    document.getElementById('statusRoom').textContent = 'MULTI: ' + code;
    showScreen('waitingScreen'); listenWait();
  } catch (e) {
    showToast('接続エラー: ' + e.message, 'warn');
  }
};

window.hostStartGame = async () => {
  if (mySlot !== 'p1' || !roomCode) return;
  let snap; try { snap = await get(ref(db, 'multi/' + roomCode)); } catch (e) { showToast('エラーが発生しました', 'warn'); return; }
  const d = snap.val(); if (!d) return;
  const max = d.maxPlayers || 3, slots = ['p1', 'p2', 'p3', 'p4'].slice(0, max);
  const active = slots.filter(s => !!d[s]);
  if (active.length < 2) { showToast('最低2人必要です', 'warn'); return; }
  const gsa = getServerTime() + 5000;
  try { await update(ref(db, 'multi/' + roomCode), { status: 'started', gameStartAt: gsa, activeSlots: active }); }
  catch (e) { showToast('ゲーム開始エラー', 'warn'); }
};

window.cancelWaiting = async () => {
  const code = roomCode, slot = mySlot; offAll(); resetState();
  if (code && slot && db) { try { if (slot === 'p1') await remove(ref(db, 'multi/' + code)); else await update(ref(db, 'multi/' + code), { [slot]: null }); } catch (e) { } }
  showScreen('lobbyScreen');
};

window.rematch = async () => {
  if (_qmIsBot) {
    _qmCleanup();
    _startQmBotGame();
    document.getElementById('resultOverlay').classList.remove('show');
    return;
  }
  if (!roomCode || !mySlot) return;
  const statusEl = document.getElementById('rematchStatus');
  const btn = document.getElementById('rematchBtn');
  btn.disabled = true;
  if (statusEl) statusEl.textContent = '接続中...';

  const prevCode = roomCode;
  const prevSlot = mySlot;
  const prevName = (document.getElementById('myNameTag')?.textContent || 'PLAYER').split(' ')[0] || 'PLAYER';

  try {
    if (prevSlot === 'p1') {
      const roomSnap = await get(ref(db, 'multi/' + prevCode));
      const roomVal = roomSnap.val();
      if (roomVal && roomVal.status === 'started') {
        const alive = roomVal.alive || {};
        const othersAlive = Object.entries(alive).some(([s, isAlive]) => s !== 'p1' && isAlive);
        if (othersAlive) {
          if (!confirm('まだ対戦中のプレイヤーがいますが、リセットしてよろしいですか？')) {
            btn.disabled = false;
            if (statusEl) statusEl.textContent = '';
            return;
          }
        }
      }

      offAll();
      gameRunning = false; endedOnce = false;
      if (animId) { cancelAnimationFrame(animId); animId = null; }
      game = null; myFinalRank = null; totalPlayers = 0; statAtkSent = 0;
      Object.keys(oppInfo).forEach(k => delete oppInfo[k]);
      dasStop(); clearInterval(sdi); sdi = null;
      Object.keys(uiC).forEach(k => uiC[k] = -1); uiC.b2b = null;

      const rSnap = await get(ref(db, 'multi/' + prevCode));
      if (!rSnap.exists()) throw new Error('ルームが見つかりません');

      const updateData = {
        status: 'waiting',
        gameStartAt: null,
        activeSlots: null,
        game: null,
        garb: null,
        alive: null,
        rematchReq: null,
        p1: { name: prevName, alive: true },
        p2: null,
        p3: null,
        p4: null
      };

      await update(ref(db, 'multi/' + prevCode), updateData);
      onDisconnect(ref(db, 'multi/' + prevCode)).remove();

      roomCode = prevCode; mySlot = 'p1'; endedOnce = false;
      document.getElementById('displayRoomCode').textContent = prevCode;
      document.getElementById('statusRoom').textContent = 'MULTI: ' + prevCode;
      document.getElementById('resultOverlay').classList.remove('show');
      showScreen('waitingScreen');
      listenWait();

    } else {
      offAll();
      gameRunning = false; endedOnce = false;
      if (animId) { cancelAnimationFrame(animId); animId = null; }
      game = null; myFinalRank = null; totalPlayers = 0; statAtkSent = 0;
      Object.keys(oppInfo).forEach(k => delete oppInfo[k]);
      dasStop(); clearInterval(sdi); sdi = null;
      Object.keys(uiC).forEach(k => uiC[k] = -1); uiC.b2b = null;

      _rematchActive = true;
      if (statusEl) statusEl.textContent = 'ホストのリマッチを待っています...';
      showToast('⏳ ホストのリマッチを待っています...', 'warn');

      try {
        set(ref(db, `multi/${prevCode}/rematchReq/${prevSlot}`), true);
      } catch (e) { }

      const rRef = ref(db, 'multi/' + prevCode);
      const roomData = await new Promise((resolve, reject) => {
        let unsub = null;
        const done = (fn) => {
          clearTimeout(timer);
          if (unsub) { try { unsub(); } catch (e) { } unsub = null; }
          fn();
        };
        const timer = setTimeout(() => done(() => reject(new Error('ホストが応答しません（30秒タイムアウト）'))), 30000);
        unsub = onValue(rRef, snap => {
          const d = snap.val();
          if (!d) { done(() => reject(new Error('ルームが削除されました'))); return; }
          if (d.status === 'waiting') { done(() => resolve(d)); }
        });
      });

      if (!_rematchActive) return;

      const joinResult = await runTransaction(rRef, (d) => {
        if (!d || d.status !== 'waiting') return;
        const max = d.maxPlayers || 3;
        const slots = ['p1', 'p2', 'p3', 'p4'].slice(0, max);
        let target = prevSlot;
        if (d[prevSlot] && d[prevSlot].name && d[prevSlot].name !== prevName) {
          target = slots.find(s => !d[s]) || null;
        }
        if (!target) return;
        d[target] = { name: prevName, alive: true };
        return d;
      });

      if (!joinResult.committed) throw new Error('リマッチに参加できませんでした');

      const finalData = joinResult.snapshot.val();
      const max = finalData.maxPlayers || 3;
      const slots = ['p1', 'p2', 'p3', 'p4'].slice(0, max);
      const assigned = slots.find(s => finalData[s] && finalData[s].name === prevName);
      if (!assigned) throw new Error('スロットの再確保に失敗しました');

      mySlot = assigned; roomCode = prevCode; endedOnce = false;
      onDisconnect(ref(db, 'multi/' + prevCode + '/' + assigned)).remove();

      if (!_rematchActive) return;
      _rematchActive = false;
      document.getElementById('displayRoomCode').textContent = prevCode;
      document.getElementById('statusRoom').textContent = 'MULTI: ' + prevCode;
      document.getElementById('resultOverlay').classList.remove('show');
      showScreen('waitingScreen');
      listenWait();
    }
  } catch (err) {
    _rematchActive = false;
    if (statusEl) statusEl.textContent = '⚠ ' + err.message;
    btn.disabled = false;
    roomCode = prevCode; mySlot = prevSlot;
  }
};

window.leaveRoom = async () => {
  const code = roomCode, slot = mySlot, wasBot = _qmIsBot;
  document.getElementById('resultOverlay').classList.remove('show');
  document.getElementById('countdownOverlay').classList.remove('show');
  _qmBotStop(); _qmIsBot = false;
  resetState();
  if (!wasBot && code && slot && db) {
    try {
      if (slot === 'p1') {
        await remove(ref(db, 'multi/' + code));
      } else {
        await update(ref(db, 'multi/' + code + '/game'), { [slot]: { gameOver: true, score: 0, board: [] } });
        await update(ref(db, 'multi/' + code + '/alive'), { [slot]: false });
        await update(ref(db, 'multi/' + code), { [slot]: null });
        try { await remove(ref(db, `multi/${code}/rematchReq/${slot}`)); } catch (e) { }
      }
    } catch (e) { }
  }
  showScreen('lobbyScreen');
};

async function startGame(roomData, wasBot = false) {
  document.activeElement?.blur();
  const d = roomData, max = d.maxPlayers || 3;
  const active = d.activeSlots || (([`p1`, `p2`, `p3`, `p4`].slice(0, max)).filter(s => !!d[s]));
  totalPlayers = active.length;
  showScreen('gameScreen'); clearBoards();
  const myIdx = parseInt(mySlot.replace('p', ''));
  document.getElementById('myNameTag').textContent = d[mySlot]?.name || 'YOU';
  document.getElementById('myLabel').className = 'player-label ' + SLCLS[myIdx];
  document.getElementById('myLabel').textContent = 'P' + myIdx;
  document.getElementById('myCanvas').style.cssText = `display:block;image-rendering:pixelated;border:1px solid ${SBORDER[myIdx]};box-shadow:0 0 16px ${SGLOW[myIdx]}`;
  buildOppArea(active);
  active.filter(s => s !== mySlot).forEach(s => { const el = document.getElementById('oppName_' + s); if (el) el.textContent = d[s]?.name || s.toUpperCase(); });

  const sysMsgRef = ref(db, 'multi/' + roomCode + '/sysMsgTs');
  const _joinTs = getServerTime();
  _addSub('sysMsg', onValue(sysMsgRef, snap => {
    if (!gameRunning) return;
    const ts = snap.val();
    if (!ts || ts < _joinTs) return;
    get(ref(db, 'multi/' + roomCode + '/sysMsg')).then(s => {
      const msg = s.val();
      if (msg && gameRunning) showToast('BC ' + msg, 'warn');
    }).catch(() => { });
  }));

  const aliveRef = ref(db, 'multi/' + roomCode + '/alive');
  _addSub('alive', onValue(aliveRef, snap => {
    const av = snap.val() || {};
    active.filter(s => s !== mySlot).forEach(s => { if (oppInfo[s]) oppInfo[s].alive = av[s] === true; });
  }));

  active.filter(s => s !== mySlot).forEach(sk => {
    const oRef = ref(db, 'multi/' + roomCode + '/game/' + sk);
    _addSub('opp_' + sk, onValue(oRef, snap => {
      const od = snap.val(); if (!od) return;
      const oc = oppInfo[sk]; if (oc) TetrisGame.drawOpp(oc.canvas, od, oc.W, oc.H);
      const ns = document.getElementById('oppName_' + sk); if (ns) ns.textContent = (d[sk]?.name || sk) + ' (' + od.score + ')';
      const sc = document.getElementById('oppScore_' + sk); if (sc) sc.textContent = od.score + ' pts';
      if (od.gameOver && oc && oc.alive) {
        oc.alive = false;
        const dd = document.getElementById('oppDead_' + sk); if (dd) dd.classList.add('show');
        const lb = document.getElementById('oppLabel_' + sk); if (lb) lb.classList.add('dead');
        playSound('elim');
        update(ref(db, 'multi/' + roomCode + '/alive'), { [sk]: false }).catch(() => { });
      }
    }));
  });

  if (mySlot === 'p1' && !wasBot) {
    _addSub('rematchReq', onValue(ref(db, `multi/${roomCode}/rematchReq`), snap => {
      const reqs = snap.val();
      const statusEl = document.getElementById('rematchStatus');
      if (!reqs) {
        if (statusEl) statusEl.textContent = '';
        return;
      }
      const slots = Object.keys(reqs).filter(s => reqs[s] === true);
      if (slots.length > 0) {
        const names = slots.map(s => d[s]?.name || s.toUpperCase());
        const msg = 'REMATCH REQUESTED: ' + names.join(', ');
        if (statusEl) statusEl.textContent = msg;
        if (document.getElementById('resultOverlay').classList.contains('show')) {
          showToast(msg, 'ok');
        }
      } else {
        if (statusEl) statusEl.textContent = '';
      }
    }));
  }

  const myGRef = ref(db, 'multi/' + roomCode + '/garb/' + mySlot);
  _addSub('garb_my', onValue(myGRef, snap => {
    const v = snap.val(); if (!v || !v.n || !game) return;
    if (v.n > 0) {
      const toAdd = v.n;
      runTransaction(myGRef, cur => cur && cur.n > 0 ? { n: 0 } : cur).catch(() => { });
      game.pendGarb += toAdd; pushLog("INCOMING +" + toAdd, "var(--red)");
      const badge = document.getElementById('attackBadge'); badge.textContent = '+' + v.n + ' !'; badge.classList.remove('show'); void badge.offsetWidth; badge.classList.add('show'); setTimeout(() => badge.classList.remove('show'), 1200);
      flashAttack(); playSound('attack');
    }
  }));

  const mf = document.getElementById('matchFlash'); mf.classList.add('show'); setTimeout(() => mf.classList.remove('show'), 2000);

  const gsa = d.gameStartAt || (getServerTime() + 5000);

  const myAliveRef = ref(db, 'multi/' + roomCode + '/alive/' + mySlot);
  set(myAliveRef, true).catch(() => { });
  onDisconnect(myAliveRef).set(false);

  const aborted = await doCountdown(gsa); if (aborted) return;

  game = new TetrisGame('myCanvas', 'holdCanvas', 'nextCanvas');
  gameRunning = true; endedOnce = false;

  const PUSH = 50; let lastPush = 0, pendOut = 0;
  const loop = ts => {
    if (!gameRunning) return;
    game._lastTs = ts;
    game.update(ts); game.draw();
    while (game.results.length > 0) { const res = game.results.shift(); if (res.garbageOut > 0) { statAtkSent += res.garbageOut; pendOut += res.garbageOut; pushLog("ATTACK +" + res.garbageOut, "var(--accent3)"); } if (res.actionLabel) { showAP(res.actionLabel); pushLog(res.actionLabel.replace("\n", " "), "var(--accent)"); } }
    updateUI();

    if (ts - lastPush > PUSH) {
      lastPush = ts;
      const gd = game.serialize();
      set(ref(db, 'multi/' + roomCode + '/game/' + mySlot), gd).catch(() => { });
      if (pendOut > 0) {
        const gn = pendOut; pendOut = 0;
        if (gameRunning && !game.over) {
          const aliveOpps = active.filter(s => s !== mySlot && oppInfo[s]?.alive);
          aliveOpps.forEach(oslot => {
            const tRef = ref(db, 'multi/' + roomCode + '/garb/' + oslot);
            runTransaction(tRef, cur => { const prev = (cur && cur.n) || 0; return { n: prev + gn }; }).catch(() => { });
          });
        }
      }
    }
    if (game.over && !endedOnce) {
      set(ref(db, 'multi/' + roomCode + '/game/' + mySlot), game.serialize()).catch(() => { });
      update(ref(db, 'multi/' + roomCode + '/alive'), { [mySlot]: false }).catch(() => { });
      const aliveOpps = active.filter(s => s !== mySlot && oppInfo[s]?.alive);
      endGame(aliveOpps.length + 1); return;
    }
    const anyAliveOpp = active.filter(s => s !== mySlot).some(s => oppInfo[s]?.alive);
    if (!anyAliveOpp && !endedOnce && gameRunning) { endGame(1); return; }
    animId = requestAnimationFrame(loop);
  };
  animId = requestAnimationFrame(loop);
}

function endGame(rank) {
  if (endedOnce) return; endedOnce = true; gameRunning = false; myFinalRank = rank;
  offAll();
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  const score = game?.score || 0, lvl = game?.level || 1, lines = game?.lines || 0;
  rank = Math.max(1, Math.min(totalPlayers, rank));
  const suf = ['st', 'nd', 'rd', 'th'][Math.min(rank - 1, 3)] || 'th';
  const re = document.getElementById('finalRank'); re.textContent = rank + suf; re.className = 'final-rank r' + Math.min(rank, 4);
  const te = document.getElementById('resultTitle'), ld = document.getElementById('rankLabelText'); ld.textContent = 'PLACE';
  if (rank === 1) {
    te.className = 'overlay-title win'; te.textContent = 'WINNER!!'; playSound('win');
    notifyOk(`優勝！`, `${totalPlayers}人中 第1位\nスコア: ${score}`);
  }
  else if (rank === totalPlayers) {
    te.className = 'overlay-title lose'; te.textContent = 'ELIMINATED';
    notifyWarn(`敗北`, `${totalPlayers}人中 最下位`);
  }
  else {
    te.className = 'overlay-title mid'; te.textContent = 'TOP ' + rank;
    notifyInfo(`ランクイン`, `${totalPlayers}人中 第${rank}位`);
  }
  document.getElementById('rs-score').textContent = score; document.getElementById('rs-level').textContent = lvl; document.getElementById('rs-lines').textContent = lines; document.getElementById('rs-atk').textContent = statAtkSent;
  document.getElementById('resultSub').textContent = totalPlayers + '人中 第' + rank + '位';
  document.getElementById('rankDisplay').textContent = rank;
  const rematchBtn = document.getElementById('rematchBtn');
  if (rematchBtn) rematchBtn.style.display = '';
  document.getElementById('resultOverlay').classList.add('show');

  const _u = getCurrentUser();
  if (_u) {
    const _oppNames = [];
    document.querySelectorAll('[id^="oppName_"]').forEach(el => {
      const n = el.textContent.replace(/\s*\(.*\)$/, '').trim();
      if (n && n !== '...') _oppNames.push(n);
    });
    saveMultiResult(_u.uid, {
      rank, totalPlayers, score, lines, level: game?.level || 1,
      attackSent: statAtkSent, mode: _qmIsBot ? 'qm' : (roomCode ? 'room' : 'qm'),
      opponentNames: _oppNames,
    }).catch(() => { });
  }
}

function doCountdown(startAt) {
  return new Promise(resolve => {
    const ov = document.getElementById('countdownOverlay'), num = document.getElementById('countdownNum');
    num.textContent = ''; num.style.animation = 'none'; ov.classList.add('show'); let resolved = false;
    function done(aborted) { if (resolved) return; resolved = true; ov.classList.remove('show'); resolve(aborted); }
    [3, 2, 1, 0].forEach((n, i) => {
      const delay = Math.max(0, startAt - (3 - i) * 1000 - getServerTime());
      setTimeout(() => { if (resolved) return; num.style.animation = 'none'; void num.offsetHeight; num.style.animation = 'countAnim .85s ease-out forwards'; num.textContent = n > 0 ? n : 'GO!'; playSound(n > 0 ? 'countdown' : 'go'); }, delay);
    });
    setTimeout(() => done(false), Math.max(200, startAt - getServerTime() + 750));
  });
}

const DAS = 167, ARR = 33, keys = new Set();
let dasTimer = null, dasDir = 0, arrTimer = null, sdi = null;
function dasStart(dir) { if (dasDir === dir) return; dasStop(); dasDir = dir; game?.move(dir); dasTimer = setTimeout(() => { arrTimer = setInterval(() => { game?.move(dir); }, ARR); }, DAS); }
function dasStop() { clearTimeout(dasTimer); clearInterval(arrTimer); dasTimer = null; arrTimer = null; dasDir = 0; }
document.addEventListener('keydown', e => {
  const gameActive = document.getElementById('gameScreen')?.classList.contains('active');
  if (gameActive && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
  if (keys.has(e.code)) return; keys.add(e.code); if (!game || !gameRunning) return;
  switch (e.code) {
    case 'ArrowLeft': dasStart(-1); break;
    case 'ArrowRight': dasStart(1); break;
    case 'ArrowUp': case 'KeyX': game.rotate(1); break;
    case 'KeyZ': e.preventDefault(); game.rotate(-1); break;
    case 'ArrowDown':
      if (!sdi) { game.softDrop(); sdi = setInterval(() => { if (game && gameRunning) game.softDrop(); }, 50); }
      break;
    case 'Space':
      if (game && !game.waiting) game.hardDrop();
      break;
    case 'KeyC': case 'ShiftLeft': case 'ShiftRight': e.preventDefault(); game.hold(); break;
    case 'KeyV': triggerBurst(); break;
  }
});
document.addEventListener('keyup', e => {
  keys.delete(e.code);
  if (e.code === 'ArrowLeft' && dasDir === -1) dasStop();
  if (e.code === 'ArrowRight' && dasDir === 1) dasStop();
  if (e.code === 'ArrowDown') { clearInterval(sdi); sdi = null; }
});
window.addEventListener('blur', () => {
  keys.clear(); dasStop(); clearInterval(sdi); sdi = null;
});

function setupMob(id, fn, rep = false) {
  const btn = document.getElementById(id); if (!btn) return;
  let iv = null, dasT = null;
  const st = e => {
    e.preventDefault();
    if (!game || !gameRunning) return;
    fn();
    if (rep) {
      if (id === 'btnLeft' || id === 'btnRight') {
        dasT = setTimeout(() => { iv = setInterval(() => { if (game && gameRunning) fn(); }, ARR); }, DAS);
      } else {
        iv = setInterval(() => { if (game && gameRunning) fn(); }, rep);
      }
    }
  };
  const sp = () => { clearTimeout(dasT); clearInterval(iv); dasT = null; iv = null; };
  btn.addEventListener('touchstart', st, { passive: false });
  btn.addEventListener('touchend', sp, { passive: true });
  btn.addEventListener('touchcancel', sp, { passive: true });
  btn.addEventListener('mousedown', st);
  btn.addEventListener('mouseup', sp);
  btn.addEventListener('mouseleave', sp);
}
setupMob('btnLeft', () => game?.move(-1), ARR); setupMob('btnRight', () => game?.move(1), ARR); setupMob('btnDown', () => game?.softDrop(), 50); setupMob('btnRotate', () => game?.rotate(1)); setupMob('btnRotateL', () => game?.rotate(-1)); setupMob('btnHardDrop', () => { if (game && !game.waiting) game.hardDrop(); }); setupMob('btnHold', () => game?.hold());
setupMob('btnBurst', () => triggerBurst());
(function () { let tx = 0, ty = 0; const c = document.getElementById('myCanvas'); c.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true }); c.addEventListener('touchend', e => { if (!game || !gameRunning || game.waiting) return; const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; if (Math.abs(dy) > 50 && dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.5) game.hardDrop(); }, { passive: true }); })();
document.getElementById('roomCodeInput').addEventListener('keydown', e => { if (e.key === 'Enter') window.joinRoom(); });
document.getElementById('roomCodeInput').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^0-9]/g, ''); });
document.getElementById('playerName').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });

(function () { const cv = document.getElementById('bgCanvas'); if (!cv) return; const ctx = cv.getContext('2d'); const C = { I: '#00f5ff', O: '#ffff00', T: '#cc00ff', S: '#aaff00', Z: '#ff0040', J: '#0066ff', L: '#ff8800' }; const N = Object.keys(C); const SZ = 28; const PM = { I: [[[1, 1, 1, 1]]], O: [[[1, 1], [1, 1]]], T: [[[0, 1, 0], [1, 1, 1]]], S: [[[0, 1, 1], [1, 1, 0]]], Z: [[[1, 1, 0], [0, 1, 1]]], J: [[[1, 0, 0], [1, 1, 1]]], L: [[[0, 0, 1], [1, 1, 1]]] }; let W, H; const ps = []; function resize() { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; } resize(); window.addEventListener('resize', resize); function spawn() { const nm = N[Math.random() * N.length | 0]; return { mat: PM[nm][0], color: C[nm], x: Math.random() * W, y: -SZ * 4, vy: .4 + Math.random() * 1.2, rot: Math.random() * 360, vr: (Math.random() - .5) * .7, sc: .5 + Math.random() * .9, alpha: .1 + Math.random() * .4 }; } for (let i = 0; i < 18; i++) { const p = spawn(); p.y = Math.random() * H; ps.push(p); } function db2(bx, by, color) { ctx.fillStyle = color + 'aa'; ctx.fillRect(bx + 1, by + 1, SZ - 2, SZ - 2); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(bx + 1, by + 1, SZ - 2, 5); ctx.fillRect(bx + 1, by + 1, 5, SZ - 2); ctx.strokeStyle = color; ctx.lineWidth = .7; ctx.strokeRect(bx + .5, by + .5, SZ - 1, SZ - 1); } function frame() { ctx.clearRect(0, 0, W, H); ps.forEach((p, i) => { p.y += p.vy; p.rot += p.vr; if (p.y > H + SZ * p.sc * 4) ps[i] = spawn(); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180); ctx.scale(p.sc, p.sc); ctx.globalAlpha = p.alpha; const mw = p.mat[0].length, mh = p.mat.length, ox = -mw * SZ / 2, oy = -mh * SZ / 2; p.mat.forEach((row, r) => row.forEach((cell, c) => { if (cell) db2(ox + c * SZ, oy + r * SZ, p.color); })); ctx.restore(); }); if (Math.random() < .012 && ps.length < 22) ps.push(spawn()); requestAnimationFrame(frame); } frame(); })();

(function () {
  const FEEDBACK_TYPES = {
    bug: { label: 'BUG バグ', cls: 'sel-bug' },
    feedback: { label: 'MSG 感想', cls: 'sel-feedback' },
    idea: { label: 'IDEA アイデア', cls: 'sel-idea' },
    other: { label: 'PIN その他', cls: 'sel-other' },
  };
  let _fbType = null;
  const s = document.createElement('style');
  s.textContent = `
#fb-btn{position:fixed;bottom:48px;right:14px;z-index:9000;width:44px;height:44px;border-radius:50%;
  background:linear-gradient(135deg,#7700ff,#cc00ff);border:2px solid rgba(204,0,255,.5);
  box-shadow:0 4px 16px rgba(204,0,255,.4);cursor:pointer;display:flex;align-items:center;
  justify-content:center;transition:transform .2s,box-shadow .2s;color:#fff;user-select:none;padding:0;}
#fb-btn:hover{transform:scale(1.12);box-shadow:0 6px 24px rgba(204,0,255,.7);}
#fb-unread{position:absolute;top:-4px;right:-4px;width:14px;height:14px;border-radius:50%;
  background:#ff0080;font-family:'Press Start 2P',monospace;font-size:7px;color:#fff;
  display:none;align-items:center;justify-content:center;border:2px solid #020408;}
#fb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9001;display:none;
  align-items:center;justify-content:center;backdrop-filter:blur(4px);}
#fb-overlay.show{display:flex;}
#fb-modal{background:#080d18;border:1px solid rgba(204,0,255,.4);border-radius:6px;
  padding:28px 26px;width:min(420px,92vw);position:relative;
  box-shadow:0 0 40px rgba(204,0,255,.2);font-family:'Orbitron',monospace;}
#fb-modal::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;
  background:linear-gradient(90deg,#7700ff,#cc00ff,#00f5ff);border-radius:6px 6px 0 0;}
#fb-modal h2{font-family:'Press Start 2P',monospace;font-size:11px;color:#cc00ff;
  letter-spacing:2px;margin-bottom:20px;}
.fb-x{position:absolute;top:12px;right:16px;background:none;border:none;color:#4a6080;
  font-size:22px;cursor:pointer;line-height:1;padding:0;transition:color .2s;}
.fb-x:hover{color:#cc00ff;}
.fb-lbl{font-size:10px;color:#4a6080;letter-spacing:2px;margin-bottom:8px;display:block;}
.fb-types{display:flex;gap:7px;margin-bottom:18px;}
.fb-t{flex:1;padding:9px 2px;border-radius:4px;cursor:pointer;
  font-family:'Orbitron',monospace;font-size:8px;font-weight:700;letter-spacing:1px;
  text-align:center;transition:all .15s;border:1px solid #1a2540;color:#4a6080;background:transparent;}
.fb-t:hover{border-color:#cc00ff;color:#cc00ff;}
.fb-t.sel-bug{border-color:#ff3355;color:#ff3355;background:rgba(255,51,85,.08);}
.fb-t.sel-feedback{border-color:#00f5ff;color:#00f5ff;background:rgba(0,245,255,.08);}
.fb-t.sel-idea{border-color:#aaff00;color:#aaff00;background:rgba(170,255,0,.08);}
.fb-t.sel-other{border-color:#ff8800;color:#ff8800;background:rgba(255,136,0,.08);}
.fb-ta{width:100%;min-height:100px;background:rgba(0,0,0,.4);border:1px solid #1a2540;
  border-radius:4px;color:#e0f0ff;font-family:'Orbitron',monospace;font-size:12px;
  padding:11px;resize:vertical;outline:none;transition:border-color .2s;margin-bottom:14px;box-sizing:border-box;}
.fb-ta:focus{border-color:#cc00ff;}
.fb-ta::placeholder{color:#2a3a55;}
.fb-sub{width:100%;padding:12px;border:none;border-radius:4px;
  background:linear-gradient(135deg,#7700ff,#cc00ff);color:#fff;
  font-family:'Orbitron',monospace;font-size:11px;font-weight:700;
  letter-spacing:2px;cursor:pointer;transition:all .2s;box-sizing:border-box;}
.fb-sub:hover{transform:translateY(-1px);box-shadow:0 0 20px rgba(204,0,255,.5);}
.fb-sub:disabled{opacity:.4;cursor:not-allowed;transform:none;}
.fb-err{font-size:10px;color:#ff3355;letter-spacing:1px;margin-bottom:10px;min-height:14px;}
.fb-ok{text-align:center;padding:24px 0;font-family:'Press Start 2P',monospace;
  font-size:10px;color:#aaff00;letter-spacing:2px;line-height:2.4;}
`;
  document.head.appendChild(s);
  const w = document.createElement('div');
  w.innerHTML = `
<button id="fb-btn" title="バグ報告・フィードバック">
  <div id="fb-unread"></div>
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M17 13a1 1 0 01-1 1H6l-4 4V4a1 1 0 011-1h13a1 1 0 011 1v9z"
          stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
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
  const btnOpen = document.getElementById('fb-btn');
  const btnClose = document.getElementById('fb-close');
  const btnSend = document.getElementById('fb-send');
  const btnDone = document.getElementById('fb-done-close');
  const fbBody = document.getElementById('fb-body');
  const fbDone = document.getElementById('fb-done');
  const fbErr = document.getElementById('fb-err');
  const fbText = document.getElementById('fb-text');

  function openFb() {
    overlay.classList.add('show');
    fbBody.style.display = ''; fbDone.style.display = 'none';
    fbText.value = ''; fbErr.textContent = ''; _fbType = null;
    document.querySelectorAll('.fb-t').forEach(b => b.className = 'fb-t');
    setTimeout(() => fbText.focus(), 80);
  }
  function closeFb() { overlay.classList.remove('show'); }

  btnOpen.onclick = openFb;
  btnClose.onclick = closeFb;
  btnDone.onclick = closeFb;
  overlay.onclick = e => { if (e.target === overlay) closeFb(); };

  document.querySelectorAll('.fb-t').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.fb-t').forEach(b => b.className = 'fb-t');
      _fbType = btn.dataset.t;
      btn.className = 'fb-t sel-' + _fbType;
      fbErr.textContent = '';
    };
  });

  fbText.addEventListener('keydown', e => { if (e.key === 'Enter' && e.ctrlKey) btnSend.click(); });

  btnSend.onclick = async () => {
    const text = fbText.value.trim();
    if (!_fbType) { fbErr.textContent = '⚠ カテゴリを選択してください'; return; }
    if (text.length < 5) { fbErr.textContent = '⚠ もう少し詳しく教えてください'; return; }
    btnSend.disabled = true; btnSend.textContent = '送信中...'; fbErr.textContent = '';
    try {
      const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      const { FB_CONFIG } = await import('./config.js');
      const app = getApps().length ? getApps()[0] : initializeApp(FB_CONFIG);
      const { getFirestore, collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      const fs = getFirestore(app);
      await addDoc(collection(fs, 'reports'), {
        type: _fbType, message: text,
        page: 'マルチ対戦', version: APP_VERSION,
        ua: navigator.userAgent.slice(0, 200),
        ts: serverTimestamp(), status: 'new',
        roomCode: roomCode || null,
        gameMode: 'multi',
      });
      fbBody.style.display = 'none'; fbDone.style.display = '';
    } catch (e) {
      fbErr.textContent = '⚠ 送信失敗: ' + (e.message || 'エラー');
      btnSend.disabled = false; btnSend.textContent = '送信する ▶';
    }
  };
})();

(function () { const loader = document.getElementById('pageLoader'), bar = document.getElementById('plBar'), txt = document.getElementById('plText'); if (!loader || !bar) return; const bc = ['#00f5ff', '#ffff00', '#cc00ff', '#aaff00', '#ff0040', '#0066ff', '#ff8800', '#00f5ff', '#ffff00', '#cc00ff']; const N = 10; for (let i = 0; i < N; i++) { const b = document.createElement('div'); b.className = 'pl-b'; bar.appendChild(b); } let f = 0; const next = () => { if (f >= N) { Array.from(bar.children).forEach(b => { b.style.background = 'rgba(255,255,255,.9)'; b.style.boxShadow = '0 0 20px #fff'; }); setTimeout(() => { loader.classList.add('hide'); setTimeout(() => { try { loader.remove(); } catch (e) { } }, 500); }, 150); return; } const b = bar.children[f]; b.classList.add('lit'); b.style.background = bc[f]; b.style.boxShadow = '0 0 14px ' + bc[f]; b.style.borderColor = bc[f]; f++; if (f === 4) txt.textContent = 'CONNECTING...'; if (f === 8) txt.textContent = 'READY!'; setTimeout(next, 55 + Math.random() * 75); }; setTimeout(next, 200); })();
