import { ref, set, get, onValue, off, update, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { db, getServerTime, persistLog } from './firebase-config.js';
import { showScreen, showToast, clearBoards, flashAttack, showActionPopup, updateGameUI } from './ui-manager.js';
import { playSound } from './sound-engine.js';
import { TetrisGame } from './tetris-core.js';
import { BotController, BOT_NAMES } from './bot-controller.js';
import { dasStop } from './input-handler.js';

export let roomCode = null;
export let myRole = null;
export let game = null;
export let gameRunning = false;
export let animId = null;
export let oppName = 'FOE';
export let endedOnce = false;
export let forceStopped = false;
export let botMode = false;
export let botGame = null;
export let botCtrl = null;

export const stats = {
  statMaxCombo: 0,
  statAtkSent: 0,
  statAtkRecv: 0,
  statTetris: 0
};

export const genCode = () => Math.floor(1000 + Math.random() * 9000).toString();
export const _listeners = { opp: null, room: null, garb: null, wait: null };

export function offAll() {
  for (const [k, r] of Object.entries(_listeners)) {
    if (r) {
      try { off(r); } catch (e) { }
      _listeners[k] = null;
    }
  }
}

export function resetState() {
  offAll();
  gameRunning = false;
  forceStopped = false;
  endedOnce = false;
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  roomCode = null;
  myRole = null;
  game = null;
  botGame = null;
  botCtrl = null;
  botMode = false;
  dasStop();
  // We'll need to clear softDropInterval if we can access it,
  // or handle it in input-handler.
  // For now let's assume it's handled or we can export a reset function from input-handler.
}

export function showForceStop(msg) {
  if (forceStopped) return;
  forceStopped = true;
  endedOnce = true;
  gameRunning = false;
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  offAll();
  document.getElementById('resultOverlay').classList.remove('show');
  document.getElementById('countdownOverlay').classList.remove('show');
  document.getElementById('forceStopMsg').textContent = (msg || '管理者によってこのルームは強制終了されました。').trim();
  document.getElementById('forceStopOverlay').classList.add('show');
}

let _lastSysMsgTs = 0;
export function handleSysMsg(data) {
  if (!data?.sysMsg || !data?.sysMsgTs) return;
  if (data.sysMsgTs <= _lastSysMsgTs) return;
  _lastSysMsgTs = data.sysMsgTs;
  document.getElementById('sysMsgText').textContent = '📢 ' + data.sysMsg;
  const banner = document.getElementById('sysMsgBanner');
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 8000);
}

export function setAnimId(id) { animId = id; }
export function setGameRunning(val) { gameRunning = val; }

export async function countdown(startAt) {
  return new Promise(resolve => {
    const ov = document.getElementById('countdownOverlay');
    const num = document.getElementById('countdownNum');
    const mf = document.getElementById('matchFlash');

    num.textContent = '';
    num.style.animation = 'none';

    if (!botMode && mf) {
      mf.classList.add('show');
      setTimeout(() => mf.classList.remove('show'), 2000);
    }

    ov.classList.add('show');
    let resolved = false;

    function done(aborted) {
      if (resolved) return; resolved = true;
      ov.classList.remove('show');
      resolve(aborted);
    }

    const abortIv = setInterval(() => { if (forceStopped) { clearInterval(abortIv); done(true); } }, 100);

    [3, 2, 1, 0].forEach((n, i) => {
      const showAt = startAt - (3 - i) * 1000;
      const delay = Math.max(0, showAt - getServerTime());
      setTimeout(() => {
        if (resolved) return;
        num.style.animation = 'none';
        void num.offsetHeight;
        num.style.animation = 'countAnim .85s ease-out forwards';
        num.textContent = n > 0 ? n.toString() : 'GO!';
        playSound(n > 0 ? 'countdown' : 'go');
      }, delay);
    });

    const endDelay = Math.max(200, startAt - getServerTime() + 750);
    setTimeout(() => { clearInterval(abortIv); done(false); }, endDelay);
  });
}

export function endGame(result) {
  if (endedOnce) return;
  endedOnce = true;
  gameRunning = false;
  persistLog(`Game ended in room ${roomCode}: ${result}`, result === 'WIN' ? 'success' : 'info', { code: roomCode, result, score: game?.score });
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  if (!botMode) offAll();
  const title = document.getElementById('resultTitle');
  const sub = document.getElementById('resultSub');
  const score = game?.score || 0, lvl = game?.level || 1, lines = game?.lines || 0;
  if (result === 'WIN') {
    title.className = 'overlay-title win'; title.textContent = 'YOU WIN!'; playSound('win');
    if (!botMode && roomCode) update(ref(db, `rooms/${roomCode}`), { status: 'ended' }).catch(() => { });
  } else if (result === 'LOSE') {
    title.className = 'overlay-title lose'; title.textContent = 'YOU LOSE';
  } else if (result === 'DRAW') {
    title.className = 'overlay-title draw'; title.textContent = 'DRAW';
  } else if (result === 'OPPONENT_LEFT') {
    title.className = 'overlay-title draw'; title.textContent = 'OPPONENT LEFT';
    if (!botMode && myRole === 'p1' && roomCode) remove(ref(db, `rooms/${roomCode}`)).catch(() => { });
  }
  document.getElementById('rs-score').textContent = score;
  document.getElementById('rs-level').textContent = lvl;
  document.getElementById('rs-lines').textContent = lines;
  document.getElementById('rs-combo').textContent = stats.statMaxCombo;
  document.getElementById('rs-atk').textContent = stats.statAtkSent;
  document.getElementById('rs-tetris').textContent = stats.statTetris;
  if (sub) sub.innerHTML = '';
  document.getElementById('resultOverlay').classList.add('show');
}

export async function startGame(preloadedData) {
  document.activeElement?.blur();
  showScreen('gameScreen');
  clearBoards(stats);
  // Reset opponent label for online mode
  document.getElementById('oppLabel').textContent = 'FOE';
  document.getElementById('oppLabel').className = 'player-label opp';
  document.getElementById('opponentCanvas').className = '';

  const oppRole = myRole === 'p1' ? 'p2' : 'p1';

  let data = preloadedData;
  if (!data) {
    let snap;
    try { snap = await get(ref(db, `rooms/${roomCode}`)); }
    catch (e) { showToast('接続エラー', 'warn'); showScreen('lobbyScreen'); return; }
    data = snap?.val();
  }
  if (!data) { showScreen('lobbyScreen'); return; }
  if (data.status === 'force_ended') { showForceStop(data.forceMsg); return; }
  if (data.status === 'p2_left' || data.status === 'ended') { showScreen('lobbyScreen'); showToast('相手がいません', 'warn'); return; }

  const myName = data[myRole]?.name || 'YOU';
  oppName = data[oppRole]?.name || 'FOE';
  document.getElementById('myNameTag').textContent = myName;
  document.getElementById('oppNameTag').textContent = oppName;

  const roomRef = ref(db, `rooms/${roomCode}`);
  _listeners.room = roomRef;
  onValue(roomRef, snap => {
    const d = snap.val();
    if (!d) { if (!endedOnce && !forceStopped) endGame('OPPONENT_LEFT'); return; }
    handleSysMsg(d);
    if (d.status === 'force_ended' && !forceStopped) { off(roomRef); _listeners.room = null; showForceStop(d.forceMsg); return; }
    if (!endedOnce && !forceStopped) {
      if (myRole === 'p1' && d.status === 'p2_left') { endGame('OPPONENT_LEFT'); return; }
      if (myRole === 'p2' && d.status === 'p1_left') { endGame('OPPONENT_LEFT'); return; }
      if (d.status === 'ended') { endGame('OPPONENT_LEFT'); return; }
    }
  });

  let gameStartAt = data.gameStartAt;
  if (!gameStartAt) {
    try {
      const s = await get(ref(db, `rooms/${roomCode}`));
      gameStartAt = s.val()?.gameStartAt;
    } catch (e) { }
    gameStartAt = gameStartAt || (Date.now() + 4000);
  }

  const aborted = await countdown(gameStartAt);
  if (aborted) return;

  game = new TetrisGame('myCanvas', 'holdCanvas', 'nextCanvas');
  gameRunning = true; endedOnce = false;

  const oppRef = ref(db, `rooms/${roomCode}/game/${oppRole}`);
  _listeners.opp = oppRef;
  onValue(oppRef, snap => {
    const d = snap.val(); if (!d) return;
    TetrisGame.drawOpponent(document.getElementById('opponentCanvas'), d);
    document.getElementById('oppNameTag').textContent = `${oppName} (${d.score || 0})`;
    if (d.gameOver && !game?.gameOver && gameRunning && !endedOnce) endGame('WIN');
  });

  const myGRef = ref(db, `rooms/${roomCode}/garb/${myRole}`);
  _listeners.garb = myGRef;
  onValue(myGRef, snap => {
    const v = snap.val(); if (!v || !v.n || !game) return;
    if (v.n > 0) {
      stats.statAtkRecv += v.n;
      game.pendingGarbage += v.n;
      set(myGRef, { n: 0 });
      const badge = document.getElementById('attackBadge');
      if (badge) {
        badge.textContent = `+${v.n} ⚠`;
        badge.classList.remove('show'); void badge.offsetWidth; badge.classList.add('show');
        setTimeout(() => badge.classList.remove('show'), 1200);
      }
      flashAttack(); playSound('attack');
    }
  });

  const oppGRef = ref(db, `rooms/${roomCode}/garb/${oppRole}`);
  let lastPushTs = 0, pendingGarbageOut = 0;
  const PUSH_RATE = 50;

  const loop = ts => {
    if (!gameRunning) return;
    game.update(ts);
    game.draw();

    while (game.results.length > 0) {
      const res = game.results.shift();
      if (res.garbageOut > 0) {
        stats.statAtkSent += res.garbageOut;
        pendingGarbageOut += res.garbageOut;
      }
      if (res.cleared === 4) stats.statTetris++;
      if (res.actionLabel) showActionPopup(res.actionLabel);
    }

    updateGameUI(game, stats);

    if (ts - lastPushTs > PUSH_RATE) {
      lastPushTs = ts;
      set(ref(db, `rooms/${roomCode}/game/${myRole}`), game.serialize()).catch(() => { });
      if (pendingGarbageOut > 0) {
        const gn = pendingGarbageOut; pendingGarbageOut = 0;
        get(oppGRef).then(s => { const ex = s.val()?.n || 0; set(oppGRef, { n: ex + gn }).catch(() => { }); });
      }
    }

    if (game.gameOver) {
      set(ref(db, `rooms/${roomCode}/game/${myRole}`), game.serialize()).catch(() => { });
      endGame('LOSE'); return;
    }

    animId = requestAnimationFrame(loop);
  };
  animId = requestAnimationFrame(loop);
}

export async function createRoom() {
  const name = (document.getElementById('playerName').value.trim() || 'PLAYER').toUpperCase();
  myRole = 'p1'; roomCode = genCode(); endedOnce = false; forceStopped = false;
  const rRef = ref(db, `rooms/${roomCode}`);
  await set(rRef, { p1: { name }, status: 'waiting', ts: getServerTime() });
  persistLog(`Room ${roomCode} created by ${name}`, 'success', { code: roomCode, player: name });
  onDisconnect(rRef).remove();
  showScreen('waitingScreen');
  document.getElementById('displayRoomCode').textContent = roomCode;
  document.getElementById('statusRoom').textContent = `ROOM: ${roomCode}`;
  const waitRef = ref(db, `rooms/${roomCode}`);
  _listeners.wait = waitRef;
  onValue(waitRef, snap => {
    const d = snap.val();
    if (!d) {
      if (!forceStopped && !endedOnce) { off(waitRef); _listeners.wait = null; showScreen('lobbyScreen'); showToast('ルームが削除されました', 'warn'); }
      return;
    }
    handleSysMsg(d);
    if (d.status === 'force_ended' && !forceStopped) { off(waitRef); _listeners.wait = null; showForceStop(d.forceMsg); return; }
    if (d.status === 'ready' && !endedOnce && !forceStopped) { off(waitRef); _listeners.wait = null; startGame(d); }
  });
}

export async function joinRoom() {
  const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
  if (code.length !== 4 || !/^[0-9]{4}$/.test(code)) { showToast('4桁の数字コードを入力してください', 'warn'); return; }
  const name = (document.getElementById('playerName').value.trim() || 'PLAYER2').toUpperCase();
  const rRef = ref(db, `rooms/${code}`);
  let snap;
  try { snap = await get(rRef); } catch (e) { showToast('接続エラー: ' + e.message, 'warn'); return; }
  persistLog(`Player ${name} joined room ${code}`, 'info', { code: code, player: name });
  if (!snap.exists()) { showToast('ルームが見つかりません', 'warn'); return; }
  const d = snap.val();
  if (d.status === 'force_ended') { showToast('このルームは強制終了されています', 'warn'); return; }
  if (d.status !== 'waiting') { showToast('このルームは満員か既に開始しています', 'warn'); return; }
  myRole = 'p2'; roomCode = code; endedOnce = false; forceStopped = false;
  const gameStartAt = getServerTime() + 4800;
  await update(rRef, { p2: { name }, status: 'ready', gameStartAt });
  onDisconnect(rRef).remove();
  document.getElementById('statusRoom').textContent = `ROOM: ${roomCode}`;
  startGame({ ...d, p2: { name }, gameStartAt });
}

export async function startBotGame(difficulty) {
  document.activeElement?.blur();
  const name = (document.getElementById('playerName').value.trim() || 'PLAYER').toUpperCase();
  botMode = true;
  endedOnce = false; forceStopped = false;
  document.getElementById('botDifficulty').classList.remove('show');
  oppName = BOT_NAMES[difficulty - 1];

  showScreen('gameScreen');
  clearBoards(stats);
  document.getElementById('myNameTag').textContent = name;
  document.getElementById('oppNameTag').textContent = oppName;
  document.getElementById('oppLabel').textContent = 'BOT';
  document.getElementById('oppLabel').className = 'player-label bot';
  document.getElementById('opponentCanvas').className = 'bot-canvas';
  document.getElementById('statusRoom').textContent = 'BOT MODE';
  persistLog(`Bot game started: ${name} vs ${oppName}`, 'info', { player: name, bot: oppName });

  const aborted = await countdown(getServerTime() + 4000);
  if (aborted) return;

  game = new TetrisGame('myCanvas', 'holdCanvas', 'nextCanvas');
  botGame = new TetrisGame('opponentCanvas', null, null);
  botCtrl = new BotController(botGame, difficulty);
  gameRunning = true; endedOnce = false;

  const loop = ts => {
    if (!gameRunning) return;
    game.update(ts);
    game.draw();
    botCtrl.tick(ts);
    botGame.update(ts);
    botGame.draw();
    botCtrl.drawVisualization();

    while (game.results.length > 0) {
      const res = game.results.shift();
      if (res.garbageOut > 0) {
        stats.statAtkSent += res.garbageOut;
        botGame.pendingGarbage += res.garbageOut;
      }
      if (res.cleared === 4) stats.statTetris++;
      if (res.actionLabel) showActionPopup(res.actionLabel);
    }

    while (botGame.results.length > 0) {
      const res = botGame.results.shift();
      if (res.garbageOut > 0) {
        game.pendingGarbage += res.garbageOut;
        stats.statAtkRecv += res.garbageOut;
        const badge = document.getElementById('attackBadge');
        if (badge) {
          badge.textContent = `+${res.garbageOut} ⚠`;
          badge.classList.remove('show'); void badge.offsetWidth; badge.classList.add('show');
          setTimeout(() => badge.classList.remove('show'), 1200);
        }
        flashAttack(); playSound('attack');
      }
    }

    updateGameUI(game, stats);
    document.getElementById('oppNameTag').textContent = `${oppName} (${botGame.score})`;

    if (game.gameOver && !endedOnce) { endGame('LOSE'); return; }
    if (botGame.gameOver && !game.gameOver && !endedOnce) { endGame('WIN'); return; }
    if (game.gameOver && botGame.gameOver && !endedOnce) { endGame('DRAW'); return; }

    animId = requestAnimationFrame(loop);
  };
  animId = requestAnimationFrame(loop);
}

export async function leaveRoom() {
  const code = roomCode, role = myRole, wasBot = botMode;
  document.getElementById('resultOverlay').classList.remove('show');
  document.getElementById('forceStopOverlay').classList.remove('show');
  document.getElementById('sysMsgBanner').classList.remove('show');
  document.getElementById('countdownOverlay').classList.remove('show');
  document.getElementById('oppLabel').textContent = 'FOE';
  document.getElementById('oppLabel').className = 'player-label opp';
  document.getElementById('opponentCanvas').className = '';
  resetState();
  if (!wasBot && code && db) {
    try {
      await remove(ref(db, `rooms/${code}`));
    } catch (e) { }
  }
  showScreen('lobbyScreen');
}

export function cancelWaiting() {
  const code = roomCode;
  if (_listeners.wait) { try { off(_listeners.wait); } catch (e) { } _listeners.wait = null; }
  resetState();
  if (code && db) { try { remove(ref(db, `rooms/${code}`)); } catch (e) { } }
  document.getElementById('sysMsgBanner').classList.remove('show');
  showScreen('lobbyScreen');
}

export function copyRoomCode() {
  if (!roomCode) return;
  navigator.clipboard?.writeText(roomCode)
    .then(() => showToast('コードをコピーしました！', 'ok'))
    .catch(() => showToast('コード: ' + roomCode));
}
