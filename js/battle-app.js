import { db, ref, set, get, onValue, off, update, remove, onDisconnect, persistLog } from './firebase-init.js';
import { APP_VERSION } from '../config.js';
import { COLS, ROWS, CELL, COLORS, PIECES } from './constants.js';
import { TetrisGame } from './tetris-engine.js';
import { BotController, BOT_NAMES } from './bot-ai.js';
import { initServerTime, getServerTime, showToast, playSound } from './utils.js';
import { createRoom, joinRoom, startMultiplayerGame } from './multiplayer.js';

let audioCtx = null;
let soundEnabled = true;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

const triggerSound = (type) => playSound(type, getAudioCtx(), soundEnabled);

initServerTime(db, onValue, ref);

// Wait for DOM
window.addEventListener('DOMContentLoaded', () => {
    const statusText = document.getElementById('statusText');
    if (statusText) {
        statusText.textContent = 'ONLINE';
        statusText.className = 'status-online';
    }
    const versionDisp = document.getElementById('versionDisp');
    if (versionDisp) versionDisp.textContent = `VER ${APP_VERSION}`;

    setupHandlers();
    setupBanner();
});

function setupBanner() {
    const banner = document.getElementById('sysMsgBanner');
    const closeBtn = document.getElementById('closeSysMsg');
    if (closeBtn && banner) {
        closeBtn.onclick = () => banner.classList.remove('active');
    }
}

// ══ MULTIPLAYER STATE ══
let roomCode = null, myRole = null, game = null, gameRunning = false, animId = null;
let opponents = {};
let endedOnce = false, forceStopped = false;
let botMode = false, botGame = null, botCtrl = null;
let statMaxCombo = 0, statAtkSent = 0, statAtkRecv = 0, statTetris = 0;
let currentGameMode = 'classic';
let oppName = 'FOE';
const SPRINT_GOAL = 40;

const _listeners = { room: null, players: {}, garb: {} };

// ══ UI HELPERS ══
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}
function flashAttack() {
  const f = document.getElementById('attackFlash'); if (f) { f.classList.add('show'); setTimeout(() => f.classList.remove('show'), 280); }
  const bw = document.querySelector('.board-wrap');
  if (bw) { bw.classList.remove('shake'); void bw.offsetWidth; bw.classList.add('shake'); setTimeout(() => bw.classList.remove('shake'), 260); }
}
function showActionPopup(label) {
  const p = document.getElementById('actionPopup'); if (p) { p.textContent = label.replace('\n', ' / '); p.classList.remove('show'); void p.offsetWidth; p.classList.add('show'); }
}

function updateGameUI() {
  if (!game) return;
  const uiCache = window._uiCache || {};
  if (game.score !== uiCache.score) {
    const sd = document.getElementById('scoreDisplay');
    if (sd) { sd.classList.remove('score-pop'); void sd.offsetWidth; sd.classList.add('score-pop'); sd.textContent = game.score; }
    uiCache.score = game.score;
  }
  if (game.level !== uiCache.level) { const ld = document.getElementById('levelDisplay'); if (ld) ld.textContent = game.level; uiCache.level = game.level; }
  if (game.lines !== uiCache.lines) {
    const lnd = document.getElementById('linesDisplay'); if (lnd) lnd.textContent = game.lines;
    uiCache.lines = game.lines;
    if (currentGameMode === 'sprint') {
        const left = Math.max(0, SPRINT_GOAL - game.lines);
        const box = document.getElementById('sprintBox');
        if (box) {
            box.querySelector('.level-value').textContent = left;
            box.classList.add('pulse'); setTimeout(() => box.classList.remove('pulse'), 400);
        }
    }
  }
  if (game.combo !== uiCache.combo) {
    const cd = document.getElementById('comboDisplay');
    if (cd) { if (game.combo > 1) { cd.classList.remove('pop'); void cd.offsetWidth; cd.classList.add('pop'); } cd.textContent = game.combo > 1 ? game.combo : 0; }
    uiCache.combo = game.combo;
    if (game.combo > statMaxCombo) statMaxCombo = game.combo;
  }
  if (game.b2b !== uiCache.b2b) { const bd = document.getElementById('b2bBadge'); if (bd) bd.className = 'b2b-badge ' + (game.b2b ? 'on' : 'off'); uiCache.b2b = game.b2b; }

  if (currentGameMode !== 'sprint') {
      if (statAtkSent !== uiCache.sent) { const asd = document.getElementById('atkSentDisplay'); if (asd) asd.textContent = statAtkSent; uiCache.sent = statAtkSent; }
      if (statAtkRecv !== uiCache.recv) { const ard = document.getElementById('atkRecvDisplay'); if (ard) ard.textContent = statAtkRecv; uiCache.recv = statAtkRecv; }
      const pg = game.pendingGarbage || 0;
      if (pg !== uiCache.pg) {
        const pgd = document.getElementById('pendGarbDisplay'); if (pgd) pgd.textContent = pg;
        const pgc = document.getElementById('pendGarbCells');
        if (pgc) {
            pgc.innerHTML = '';
            const showN = Math.min(pg, 10);
            for (let i = 0; i < showN; i++) { const d = document.createElement('div'); d.className = 'pg-cell' + (pg >= 8 ? ' warn' : ''); pgc.appendChild(d); }
        }
        const gb = document.getElementById('garbBar');
        if (gb) {
            gb.innerHTML = '';
            const barN = Math.min(pg, 20);
            for (let i = 0; i < barN; i++) { const d = document.createElement('div'); d.className = 'garb-cell' + (pg >= 10 ? ' warn' : ''); gb.appendChild(d); }
        }
        uiCache.pg = pg;
      }
  }
  window._uiCache = uiCache;
}

function clearBoards() {
  ['myCanvas', 'holdCanvas', 'nextCanvas'].forEach(id => {
    const c = document.getElementById(id); if (c) { const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); }
  });
  const oppSection = document.getElementById('oppSection');
  if (oppSection) oppSection.innerHTML = '';
  opponents = {};
  const scoreDisplay = document.getElementById('scoreDisplay'); if (scoreDisplay) scoreDisplay.textContent = '0';
  const levelDisplay = document.getElementById('levelDisplay'); if (levelDisplay) levelDisplay.textContent = '1';
  const linesDisplay = document.getElementById('linesDisplay'); if (linesDisplay) linesDisplay.textContent = '0';
  const comboDisplay = document.getElementById('comboDisplay'); if (comboDisplay) comboDisplay.textContent = '0';
  const b2bBadge = document.getElementById('b2bBadge'); if (b2bBadge) b2bBadge.className = 'b2b-badge off';
  const atkSentDisplay = document.getElementById('atkSentDisplay'); if (atkSentDisplay) atkSentDisplay.textContent = '0';
  const atkRecvDisplay = document.getElementById('atkRecvDisplay'); if (atkRecvDisplay) atkRecvDisplay.textContent = '0';
  const pendGarbDisplay = document.getElementById('pendGarbDisplay'); if (pendGarbDisplay) pendGarbDisplay.textContent = '0';
  const pendGarbCells = document.getElementById('pendGarbCells'); if (pendGarbCells) pendGarbCells.innerHTML = '';
  const garbBar = document.getElementById('garbBar'); if (garbBar) garbBar.innerHTML = '';
  const attackBadge = document.getElementById('attackBadge'); if (attackBadge) attackBadge.classList.remove('show');

  if (currentGameMode === 'sprint') {
      const atkBox = document.getElementById('atkBox'); if (atkBox) atkBox.style.display = 'none';
      const sprintBox = document.getElementById('sprintBox'); if (sprintBox) sprintBox.style.display = 'block';
  } else {
      const atkBox = document.getElementById('atkBox'); if (atkBox) atkBox.style.display = 'block';
      const sprintBox = document.getElementById('sprintBox'); if (sprintBox) sprintBox.style.display = 'none';
  }

  statMaxCombo = 0; statAtkSent = 0; statAtkRecv = 0; statTetris = 0;
  window._uiCache = {};
}

function offAll() {
  if (_listeners.room && typeof _listeners.room.off === 'function') off(_listeners.room);
  for (const r in _listeners.players) if (_listeners.players[r]) off(_listeners.players[r]);
  for (const r in _listeners.garb) if (_listeners.garb[r]) off(_listeners.garb[r]);
  _listeners.players = {}; _listeners.garb = {};
}

function resetState() {
  offAll(); gameRunning = false; forceStopped = false; endedOnce = false;
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  roomCode = null; myRole = null; game = null; botGame = null; botCtrl = null; botMode = false;
  dasStop(); clearInterval(softDropInterval); softDropInterval = null;
  const manualBtn = document.getElementById('manualStartBtn');
  if (manualBtn) manualBtn.remove();
}

function showForceStop(msg) {
  if (forceStopped) return;
  forceStopped = true; endedOnce = true; gameRunning = false;
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  offAll();
  const resOv = document.getElementById('resultOverlay'); if (resOv) resOv.classList.remove('show');
  const countOv = document.getElementById('countdownOverlay'); if (countOv) countOv.classList.remove('show');
  const fsm = document.getElementById('forceStopMsg'); if (fsm) fsm.textContent = (msg || '管理者によってこのルームは強制終了されました。').trim();
  const fso = document.getElementById('forceStopOverlay'); if (fso) fso.classList.add('show');
}

function countdown(startAt) {
  return new Promise(resolve => {
    const ov = document.getElementById('countdownOverlay');
    const num = document.getElementById('countdownNum');
    const mf = document.getElementById('matchFlash');
    if (num) {
        num.textContent = '';
        num.style.animation = 'none';
    }
    if (!botMode && mf) { mf.classList.add('show'); setTimeout(() => mf.classList.remove('show'), 2000); }
    if (ov) ov.classList.add('show');
    let resolved = false;
    function done(aborted) { if (resolved) return; resolved = true; if (ov) ov.classList.remove('show'); resolve(aborted); }
    const abortIv = setInterval(() => { if (forceStopped) { clearInterval(abortIv); done(true); } }, 100);
    [3, 2, 1, 0].forEach((n, i) => {
      const showAt = startAt - (3 - i) * 1000;
      const delay = Math.max(0, showAt - getServerTime());
      setTimeout(() => {
        if (resolved) return;
        if (num) {
            num.style.animation = 'none'; void num.offsetHeight;
            num.style.animation = 'countAnim .85s ease-out forwards';
            num.textContent = n > 0 ? n.toString() : 'GO!';
        }
        triggerSound(n > 0 ? 'countdown' : 'go');
      }, delay);
    });
    const endDelay = Math.max(200, startAt - getServerTime() + 750);
    setTimeout(() => { clearInterval(abortIv); done(false); }, endDelay);
  });
}

function endGame(result) {
  if (endedOnce) return;
  endedOnce = true; gameRunning = false;
  persistLog(`Game ended in room ${roomCode}: ${result}`, result === 'WIN' ? 'success' : 'info', { code: roomCode, result, score: game?.score });
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  const title = document.getElementById('resultTitle');
  const score = game?.score || 0, lvl = game?.level || 1, lines = game?.lines || 0;
  if (title) {
      if (result === 'WIN') { title.className = 'overlay-title win'; title.textContent = 'YOU WIN!'; triggerSound('win'); }
      else if (result === 'LOSE') { title.className = 'overlay-title lose'; title.textContent = 'YOU LOSE'; }
      else { title.className = 'overlay-title draw'; title.textContent = result; }
  }
  const rsScore = document.getElementById('rs-score'); if (rsScore) rsScore.textContent = score;
  const rsLvl = document.getElementById('rs-level'); if (rsLvl) rsLvl.textContent = lvl;
  const rsLines = document.getElementById('rs-lines'); if (rsLines) rsLines.textContent = lines;
  const rsCombo = document.getElementById('rs-combo'); if (rsCombo) rsCombo.textContent = statMaxCombo;
  const rsAtk = document.getElementById('rs-atk'); if (rsAtk) rsAtk.textContent = statAtkSent;
  const rsTetris = document.getElementById('rs-tetris'); if (rsTetris) rsTetris.textContent = statTetris;
  const resOv = document.getElementById('resultOverlay'); if (resOv) resOv.classList.add('show');
}

function setupHandlers() {
    const createRoomBtn = document.getElementById('createRoomBtn');
    if (createRoomBtn) {
        createRoomBtn.onclick = async () => {
          const name = (document.getElementById('playerName').value.trim() || 'PLAYER').toUpperCase();
          const mode = document.getElementById('battleModeSelect').value;
          try {
            const result = await createRoom(name, mode);
            roomCode = result.roomCode; myRole = result.role; currentGameMode = mode;
            endedOnce = false; forceStopped = false;
            showScreen('waitingScreen');
            document.getElementById('displayRoomCode').textContent = roomCode;
            document.getElementById('statusRoom').textContent = `ROOM: ${roomCode}`;
            document.getElementById('modeLabel').textContent = `MODE: ${mode.toUpperCase()}`;
            const roomRef = ref(db, `rooms/${roomCode}`);
            _listeners.room = roomRef;
            onValue(roomRef, snap => {
              const d = snap.val();
              if (!d) { if (!forceStopped && !endedOnce) { showScreen('lobbyScreen'); showToast('ルームが削除されました', 'warn'); resetState(); } return; }
              if (d.status === 'force_ended' && !forceStopped) { showForceStop(d.forceMsg); return; }

              if (d.sysMsg && d.sysMsgTs) {
                const banner = document.getElementById('sysMsgBanner');
                const text = document.getElementById('sysMsgText');
                const lastTs = banner.getAttribute('data-ts') || 0;
                if (d.sysMsgTs > lastTs) {
                    text.textContent = d.sysMsg;
                    banner.classList.add('active');
                    banner.setAttribute('data-ts', d.sysMsgTs);
                }
              }

              const players = d.players || {};
              const count = Object.keys(players).length;
              const pcl = document.getElementById('playerCountLabel'); if (pcl) pcl.textContent = `PLAYERS: ${count}/4`;
              const pl = document.getElementById('playerList'); if (pl) pl.innerHTML = Object.values(players).map(p => `<div>▶ ${p.name}</div>`).join('');

              if (d.status === 'ready' && !endedOnce && !forceStopped) { startGame(d); }
              if (d.status === 'waiting') {
                 if (count >= 2 && myRole === 'p1') {
                    if (!document.getElementById('manualStartBtn')) {
                        const startBtn = document.createElement('button');
                        startBtn.className = 'btn btn-primary'; startBtn.textContent = 'GAME START';
                        startBtn.id = 'manualStartBtn'; startBtn.onclick = () => startMultiplayerGame(roomCode);
                        document.querySelector('#waitingScreen .card').appendChild(startBtn);
                    }
                 }
              }
            });
          } catch (e) { showToast(e.message, 'warn'); }
        };
    }

    const botBattleBtn = document.getElementById('botBattleBtn');
    if (botBattleBtn) botBattleBtn.onclick = () => { document.getElementById('botDifficulty').classList.toggle('show'); };
    const botEasyBtn = document.getElementById('botEasyBtn');
    if (botEasyBtn) botEasyBtn.onclick = () => startBotGame(1);
    const botNormalBtn = document.getElementById('botNormalBtn');
    if (botNormalBtn) botNormalBtn.onclick = () => startBotGame(2);
    const botHardBtn = document.getElementById('botHardBtn');
    if (botHardBtn) botHardBtn.onclick = () => startBotGame(3);

    const joinRoomBtn = document.getElementById('joinRoomBtn');
    if (joinRoomBtn) {
        joinRoomBtn.onclick = async () => {
          const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
          if (code.length !== 4) { showToast('4桁の数字コードを入力してください', 'warn'); return; }
          const name = (document.getElementById('playerName').value.trim() || 'PLAYER').toUpperCase();
          try {
            const d = await joinRoom(code, name);
            myRole = d.role; roomCode = code; currentGameMode = d.mode; endedOnce = false; forceStopped = false;
            showScreen('waitingScreen');
            document.getElementById('displayRoomCode').textContent = roomCode;
            document.getElementById('statusRoom').textContent = `ROOM: ${roomCode}`;
            document.getElementById('modeLabel').textContent = `MODE: ${d.mode.toUpperCase()}`;
            const roomRef = ref(db, `rooms/${roomCode}`);
            _listeners.room = roomRef;
            onValue(roomRef, snap => {
              const d = snap.val();
              if (!d) { if (!forceStopped && !endedOnce) { showScreen('lobbyScreen'); showToast('ルームが削除されました', 'warn'); resetState(); } return; }
              if (d.status === 'force_ended' && !forceStopped) { showForceStop(d.forceMsg); return; }

              if (d.sysMsg && d.sysMsgTs) {
                const banner = document.getElementById('sysMsgBanner');
                const text = document.getElementById('sysMsgText');
                const lastTs = banner.getAttribute('data-ts') || 0;
                if (d.sysMsgTs > lastTs) {
                    text.textContent = d.sysMsg;
                    banner.classList.add('active');
                    banner.setAttribute('data-ts', d.sysMsgTs);
                }
              }

              const players = d.players || {};
              const count = Object.keys(players).length;
              const pcl = document.getElementById('playerCountLabel'); if (pcl) pcl.textContent = `PLAYERS: ${count}/4`;
              const pl = document.getElementById('playerList'); if (pl) pl.innerHTML = Object.values(players).map(p => `<div>▶ ${p.name}</div>`).join('');

              if (d.status === 'ready' && !endedOnce && !forceStopped) { startGame(d); }
            });
          } catch (e) { showToast(e.message, 'warn'); }
        };
    }

    const cancelWaitingBtn = document.getElementById('cancelWaitingBtn');
    if (cancelWaitingBtn) cancelWaitingBtn.onclick = async () => {
      const code = roomCode; resetState();
      if (code && db) { try { await remove(ref(db, `rooms/${code}`)); } catch (e) { } }
      showScreen('lobbyScreen');
    };
    const leaveRoomBtn = document.getElementById('leaveRoomBtn');
    if (leaveRoomBtn) leaveRoomBtn.onclick = async () => {
      const code = roomCode, wasBot = botMode;
      const resOv = document.getElementById('resultOverlay'); if (resOv) resOv.classList.remove('show'); resetState();
      if (!wasBot && code && db) { try { await remove(ref(db, `rooms/${code}`)); } catch (e) { } }
      showScreen('lobbyScreen');
    };
    const backToLobbyBtn = document.getElementById('backToLobbyBtn');
    if (backToLobbyBtn) backToLobbyBtn.onclick = () => { const resOv = document.getElementById('resultOverlay'); if (resOv) resOv.classList.remove('show'); resetState(); showScreen('lobbyScreen'); };
    const fsBackBtn = document.getElementById('fsBackBtn');
    if (fsBackBtn) fsBackBtn.onclick = () => { const fsOv = document.getElementById('forceStopOverlay'); if (fsOv) fsOv.classList.remove('show'); resetState(); showScreen('lobbyScreen'); };
    const roomCodeDisplay = document.getElementById('roomCodeDisplay');
    if (roomCodeDisplay) roomCodeDisplay.onclick = () => { if (!roomCode) return; navigator.clipboard?.writeText(roomCode).then(() => showToast('コードをコピーしました！', 'ok')).catch(() => showToast('コード: ' + roomCode)); };
    const soundBtn = document.getElementById('soundBtn');
    if (soundBtn) soundBtn.onclick = () => { soundEnabled = !soundEnabled; soundBtn.textContent = soundEnabled ? '🔊 ON' : '🔇 OFF'; soundBtn.className = soundEnabled ? 'sound-btn on' : 'sound-btn'; };
}

async function startBotGame(difficulty) {
  document.activeElement?.blur();
  const name = (document.getElementById('playerName').value.trim() || 'PLAYER').toUpperCase();
  currentGameMode = document.getElementById('battleModeSelect').value;
  botMode = true; endedOnce = false; forceStopped = false;
  document.getElementById('botDifficulty').classList.remove('show');
  oppName = BOT_NAMES[difficulty - 1] || 'BOT';
  showScreen('gameScreen'); clearBoards();
  const gmt = document.getElementById('gameModeTitle'); if (gmt) gmt.textContent = `VS BOT — ${currentGameMode.toUpperCase()}`;
  document.getElementById('myNameTag').textContent = name;
  const oppSection = document.getElementById('oppSection');
  if (oppSection) {
      oppSection.innerHTML = `
        <div class="player-section">
          <div class="player-label bot">BOT</div>
          <div class="player-name-tag" id="oppNameTag">${oppName}</div>
          <canvas id="opponentCanvas" width="200" height="400" class="bot-canvas opp-board-mini"></canvas>
        </div>
      `;
  }
  document.getElementById('statusRoom').textContent = 'BOT MODE';
  const aborted = await countdown(getServerTime() + 4000);
  if (aborted) return;
  game = new TetrisGame('myCanvas', 'holdCanvas', 'nextCanvas', triggerSound);
  botGame = new TetrisGame('opponentCanvas', null, null, () => {});
  botCtrl = new BotController(botGame, difficulty);
  gameRunning = true; endedOnce = false;
  const loop = ts => {
    if (!gameRunning) return;
    game.update(ts); game.draw();
    botCtrl.tick(ts); botGame.update(ts); botGame.draw();
    botCtrl.drawVisualization(CELL);

    if (currentGameMode === 'sprint') {
        if (game.lines >= SPRINT_GOAL) { endGame('WIN'); return; }
        if (botGame.lines >= SPRINT_GOAL) { endGame('LOSE'); return; }
    }

    while (game.results.length > 0) {
      const res = game.results.shift();
      if (currentGameMode !== 'sprint' && res.garbageOut > 0) { statAtkSent += res.garbageOut; botGame.pendingGarbage += res.garbageOut; }
      if (res.cleared === 4) statTetris++;
      if (res.actionLabel) showActionPopup(res.actionLabel);
    }
    while (botGame.results.length > 0) {
      const res = botGame.results.shift();
      if (currentGameMode !== 'sprint' && res.garbageOut > 0) {
        game.pendingGarbage += res.garbageOut; statAtkRecv += res.garbageOut;
        const badge = document.getElementById('attackBadge');
        if (badge) {
            badge.textContent = `+${res.garbageOut} ⚠`;
            badge.classList.remove('show'); void badge.offsetWidth; badge.classList.add('show');
            setTimeout(() => badge.classList.remove('show'), 1200);
        }
        flashAttack(); triggerSound('attack');
      }
    }
    updateGameUI();
    const ont = document.getElementById('oppNameTag'); if (ont) ont.textContent = `${oppName} (${botGame.score})`;
    if (game.gameOver && !endedOnce) { endGame('LOSE'); return; }
    if (botGame.gameOver && !game.gameOver && !endedOnce) { endGame('WIN'); return; }
    animId = requestAnimationFrame(loop);
  };
  animId = requestAnimationFrame(loop);
}

async function startGame(roomData) {
  document.activeElement?.blur();
  showScreen('gameScreen'); clearBoards();
  document.getElementById('gameModeTitle').textContent = currentGameMode.toUpperCase();
  const players = roomData.players || {};
  const myName = players[myRole]?.name || 'YOU';
  document.getElementById('myNameTag').textContent = myName;
  const oppSection = document.getElementById('oppSection');
  if (oppSection) {
      oppSection.innerHTML = '';
      for (const role in players) {
        if (role === myRole) continue;
        const p = players[role];
        const div = document.createElement('div');
        div.className = 'player-section';
        div.innerHTML = `
          <div class="player-label opp">${role.toUpperCase()}</div>
          <div class="player-name-tag" id="nameTag-${role}">${p.name}</div>
          <canvas id="canvas-${role}" width="200" height="400" class="opp-board-mini"></canvas>
        `;
        oppSection.appendChild(div);
        opponents[role] = { name: p.name, canvas: div.querySelector('canvas'), gameOver: false, lines: 0 };
        const oppRef = ref(db, `rooms/${roomCode}/game/${role}`);
        _listeners.players[role] = oppRef;
        onValue(oppRef, snap => {
            const d = snap.val(); if (!d) return;
            TetrisGame.drawOpponent(opponents[role].canvas, d);
            const nt = document.getElementById(`nameTag-${role}`); if (nt) nt.textContent = `${p.name} (${d.score || 0})`;
            if (d.gameOver) opponents[role].gameOver = true;
            if (d.lines) opponents[role].lines = d.lines;
        });
      }
  }
  const myGRef = ref(db, `rooms/${roomCode}/garb/${myRole}`);
  _listeners.garb[myRole] = myGRef;
  onValue(myGRef, snap => {
    const v = snap.val(); if (!v || !v.n || !game) return;
    if (v.n > 0) {
      statAtkRecv += v.n; game.pendingGarbage += v.n; set(myGRef, { n: 0 });
      const badge = document.getElementById('attackBadge');
      if (badge) {
          badge.textContent = `+${v.n} ⚠`; badge.classList.remove('show'); void badge.offsetWidth; badge.classList.add('show');
          setTimeout(() => badge.classList.remove('show'), 1200);
      }
      flashAttack(); triggerSound('attack');
    }
  });
  const aborted = await countdown(roomData.gameStartAt);
  if (aborted) return;

  game = new TetrisGame('myCanvas', 'holdCanvas', 'nextCanvas', triggerSound);
  gameRunning = true; endedOnce = false;
  let lastPushTs = 0, pendingGarbageOut = 0;
  const loop = ts => {
    if (!gameRunning) return;
    game.update(ts); game.draw();

    if (currentGameMode === 'sprint' && game.lines >= SPRINT_GOAL) {
        set(ref(db, `rooms/${roomCode}/game/${myRole}`), { ...game.serialize(), winner: true }).catch(() => { });
        endGame('WIN'); return;
    }
    const sprintWinner = Object.values(opponents).find(o => o.lines >= SPRINT_GOAL);
    if (currentGameMode === 'sprint' && sprintWinner) { endGame('LOSE'); return; }

    while (game.results.length > 0) {
      const res = game.results.shift();
      if (currentGameMode !== 'sprint' && res.garbageOut > 0) { statAtkSent += res.garbageOut; pendingGarbageOut += res.garbageOut; }
      if (res.cleared === 4) statTetris++;
      if (res.actionLabel) showActionPopup(res.actionLabel);
    }
    updateGameUI();
    if (ts - lastPushTs > 50) {
      lastPushTs = ts;
      set(ref(db, `rooms/${roomCode}/game/${myRole}`), game.serialize()).catch(() => { });
      if (currentGameMode !== 'sprint' && pendingGarbageOut > 0) {
        const gn = pendingGarbageOut; pendingGarbageOut = 0;
        const activeOpponents = Object.keys(opponents).filter(r => !opponents[r].gameOver);
        if (activeOpponents.length > 0) {
            const target = activeOpponents[Math.floor(Math.random() * activeOpponents.length)];
            const oppGRef = ref(db, `rooms/${roomCode}/garb/${target}`);
            get(oppGRef).then(s => { const ex = s.val()?.n || 0; set(oppGRef, { n: ex + gn }).catch(() => { }); });
        }
      }
    }
    if (game.gameOver) {
        set(ref(db, `rooms/${roomCode}/game/${myRole}`), { ...game.serialize(), gameOver: true }).catch(() => { });
        endGame('LOSE'); return;
    }
    const allOppsOver = Object.values(opponents).every(o => o.gameOver);
    if (allOppsOver && currentGameMode !== 'sprint' && Object.keys(opponents).length > 0) { endGame('WIN'); return; }
    animId = requestAnimationFrame(loop);
  };
  animId = requestAnimationFrame(loop);
}

// ══ INPUT ══
const DAS = 167, ARR = 33;
const keys = new Set();
let dasTimer = null, dasDir = 0, arrTimer = null;
function dasStart(dir) { if (dasDir === dir) return; dasStop(); dasDir = dir; game?.move(dir); dasTimer = setTimeout(() => { arrTimer = setInterval(() => { game?.move(dir); }, ARR); }, DAS); }
function dasStop() { clearTimeout(dasTimer); clearInterval(arrTimer); dasTimer = null; arrTimer = null; dasDir = 0; }
document.addEventListener('keydown', e => {
  if (keys.has(e.code)) return; keys.add(e.code); if (!game || !gameRunning) return;
  switch (e.code) {
    case 'ArrowLeft': e.preventDefault(); dasStart(-1); break;
    case 'ArrowRight': e.preventDefault(); dasStart(1); break;
    case 'ArrowUp': e.preventDefault(); game.rotate(1); break;
    case 'KeyX': e.preventDefault(); game.rotate(1); break;
    case 'KeyZ': e.preventDefault(); game.rotate(-1); break;
    case 'Space': e.preventDefault(); game.hardDrop(); break;
    case 'KeyC': e.preventDefault(); game.hold(); break;
    case 'ShiftLeft': e.preventDefault(); game.hold(); break;
    case 'ShiftRight': e.preventDefault(); game.hold(); break;
    case 'Shift': e.preventDefault(); game.hold(); break;
  }
});
document.addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'ArrowLeft' && dasDir === -1) dasStop(); if (e.code === 'ArrowRight' && dasDir === 1) dasStop(); });
let softDropInterval = null;
document.addEventListener('keydown', e => { if (e.code === 'ArrowDown' && !softDropInterval && game && gameRunning) { e.preventDefault(); game?.softDrop(); softDropInterval = setInterval(() => { if (game && gameRunning) game.softDrop(); }, 50); } });
document.addEventListener('keyup', e => { if (e.code === 'ArrowDown') { clearInterval(softDropInterval); softDropInterval = null; } });
function setupMobile(id, fn, repeat = false) {
  const btn = document.getElementById(id); if (!btn) return;
  let iv = null;
  const start = e => { e.preventDefault(); if (!game || !gameRunning) return; fn(); if (repeat) iv = setInterval(() => { if (game && gameRunning) fn(); }, repeat); };
  const stop = () => { clearInterval(iv); iv = null; };
  btn.addEventListener('touchstart', start, { passive: false }); btn.addEventListener('touchend', stop); btn.addEventListener('mousedown', start); btn.addEventListener('mouseup', stop); btn.addEventListener('mouseleave', stop);
}
setupMobile('btnLeft', () => game?.move(-1), ARR); setupMobile('btnRight', () => game?.move(1), ARR); setupMobile('btnDown', () => game?.softDrop(), 50); setupMobile('btnRotate', () => game?.rotate(1), false); setupMobile('btnRotateL', () => game?.rotate(-1), false); setupMobile('btnHardDrop', () => game?.hardDrop(), false); setupMobile('btnHold', () => game?.hold(), false);
(function () {
  let tx0 = 0, ty0 = 0;
  window.addEventListener('load', () => {
      const cvs = document.getElementById('myCanvas');
      if (cvs) {
          cvs.addEventListener('touchstart', e => { tx0 = e.touches[0].clientX; ty0 = e.touches[0].clientY; }, { passive: true });
          cvs.addEventListener('touchend', e => { if (!game || !gameRunning) return; const dx = e.changedTouches[0].clientX - tx0, dy = e.changedTouches[0].clientY - ty0; if (Math.abs(dy) > 50 && dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.5) game.hardDrop(); }, { passive: true });
      }
  });
})();

// ══ BACKGROUND ══
(function () {
  const canvas = document.getElementById('bgCanvas'); if (!canvas) return; const ctx = canvas.getContext('2d');
  const PM = { I: [[[1, 1, 1, 1]], [[1], [1], [1], [1]]], O: [[[1, 1], [1, 1]]], T: [[[0, 1, 0], [1, 1, 1]], [[1, 0], [1, 1], [1, 0]]], S: [[[0, 1, 1], [1, 1, 0]]], Z: [[[1, 1, 0], [0, 1, 1]]], J: [[[1, 0, 0], [1, 1, 1]]], L: [[[0, 0, 1], [1, 1, 1]]] };
  let W, H; const pieces = [];
  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; } resize(); window.addEventListener('resize', resize);
  function spawn() { const names=['I','O','T','S','Z','J','L']; const name = names[Math.random() * 7 | 0]; const rots = PM[name]; const mat = rots[Math.random() * rots.length | 0]; return { mat, color: COLORS[name], x: Math.random() * W, y: -CELL * 4, vy: .4 + Math.random() * 1.2, rot: Math.random() * 360, vr: (Math.random() - .5) * .7, sc: .5 + Math.random() * .9, alpha: .1 + Math.random() * .4 }; }
  for (let i = 0; i < 18; i++) { const p = spawn(); p.y = Math.random() * H; pieces.push(p); }
  function drawBlock(bx, by, color) { ctx.fillStyle = color + 'aa'; ctx.fillRect(bx + 1, by + 1, CELL - 2, CELL - 2); ctx.fillStyle = 'rgba(255, 255, 255, .2)'; ctx.fillRect(bx + 1, by + 1, CELL - 2, 5); ctx.fillRect(bx + 1, by + 1, 5, CELL - 2); ctx.fillStyle = 'rgba(0, 0, 0, .25)'; ctx.fillRect(bx + 2, by + CELL - 4, CELL - 3, 3); ctx.strokeStyle = color; ctx.lineWidth = .7; ctx.strokeRect(bx + .5, by + .5, CELL - 1, CELL - 1); }
  function frame() { ctx.clearRect(0, 0, W, H); pieces.forEach((p, i) => { p.y += p.vy; p.rot += p.vr; if (p.y > H + CELL * p.sc * 4) pieces[i] = spawn(); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180); ctx.scale(p.sc, p.sc); ctx.globalAlpha = p.alpha; const mw = p.mat[0].length, mh = p.mat.length, ox = -mw * CELL / 2, oy = -mh * CELL / 2; p.mat.forEach((row, r) => row.forEach((cell, c) => { if (cell) drawBlock(ox + c * CELL, oy + r * CELL, p.color); })); ctx.restore(); }); if (Math.random() < .012 && pieces.length < 22) pieces.push(spawn()); requestAnimationFrame(frame); } frame();
})();

// ══ PAGE LOADER ══
(function () {
  const loader = document.getElementById('pageLoader'); const bar = document.getElementById('plBar'); const txt = document.getElementById('plText');
  if (!loader || !bar) return;
  const bColors = [COLORS.I, COLORS.O, COLORS.T, COLORS.S, COLORS.Z, COLORS.J, COLORS.L, COLORS.I, COLORS.O, COLORS.T];
  for (let i = 0; i < 10; i++) { const b = document.createElement('div'); b.className = 'pl-b'; bar.appendChild(b); }
  let f = 0;
  const next = () => {
    if (f >= 10) { Array.from(bar.children).forEach(b => { b.style.background = 'rgba(255, 255, 255, .9)'; b.style.boxShadow = '0 0 20px #fff'; }); setTimeout(() => { loader.classList.add('hide'); setTimeout(() => { try { loader.remove(); } catch (e) { } }, 500); }, 150); return; }
    const b = bar.children[f]; b.classList.add('lit'); b.style.background = bColors[f]; b.style.boxShadow = `0 0 14px ${bColors[f]}`; b.style.borderColor = bColors[f];
    f++; if (f === 4) txt.textContent = 'CONNECTING...'; if (f === 8) txt.textContent = 'READY!';
    setTimeout(next, 55 + Math.random() * 75);
  }; setTimeout(next, 200);
})();
