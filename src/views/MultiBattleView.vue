<template>
  <div class="screen active">
    <!-- LOBBY -->
    <div v-if="gameState === 'lobby'" class="lobby-content">
      <div class="logo">TETRIS</div>
      <div class="subtitle">▶ MULTI BATTLE — 2〜4人対戦 ◀</div>
      <div class="card">
        <AuthWidget />
        <div class="card-title">▶ PLAYER SETUP</div>
        <div class="input-group">
          <label>PLAYER NAME</label>
          <input type="text" v-model="playerName" :disabled="!!user" :style="user ? 'opacity:0.6;cursor:not-allowed' : ''" maxlength="12">
        </div>

        <button class="btn btn-match" @click="startQuickMatch">
          <span class="btn-inner">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 1l1.8 3.6L13 5.1l-3 2.9.7 4.1L7 10.2l-3.7 1.9.7-4.1-3-2.9 4.2-.6z" />
            </svg>
            クイックマッチ（自動マッチング）
          </span>
        </button>
        <div class="hint">対戦相手を自動で探してマッチングします</div>

        <div class="input-group">
          <div class="max-players-label">最大プレイヤー数（ルーム作成時）</div>
          <div class="max-players-sel">
            <button v-for="n in [2, 3, 4]" :key="n" class="max-btn" :class="{ sel: maxPlayers === n }" @click="maxPlayers = n">{{ n }}人</button>
          </div>
        </div>

        <button class="btn btn-primary" @click="handleCreateRoom">＋ ルームを作成して待機</button>
        <div class="divider">OR JOIN</div>
        <div class="input-group">
          <label>ROOM CODE</label>
          <input type="text" v-model="roomCodeInput" placeholder="6桁コード" maxlength="6" class="code-input">
        </div>
        <button class="btn btn-secondary" @click="handleJoinRoom">→ ルームに参加</button>
        <router-link to="/" class="btn btn-danger">← メニューに戻る</router-link>
      </div>
    </div>

    <!-- QUICK MATCHING -->
    <div v-if="gameState === 'matching'" class="matching-content">
      <div class="logo small">MATCHING</div>
      <div class="subtitle">QUICK MATCH</div>
      <div class="card narrow">
        <div class="card-title">▶ 対戦相手を検索中...</div>
        <div class="match-status-text">{{ matchStatusText }}</div>
        <div class="match-timer-wrap">
          <div class="match-timer-bar" :style="{ width: matchTimerPercent + '%' }" :class="{ danger: matchTimerPercent < 30 }"></div>
        </div>
        <div class="hint">残り {{ Math.ceil(matchTimerRemain / 1000) }} 秒</div>

        <div v-if="matchFound" class="match-found-area">
          <div class="match-found-flash">MATCH FOUND!</div>
          <div class="match-player-preview">
            <span class="match-pname me">{{ playerName }}</span>
            <span class="match-vs">VS</span>
            <span class="match-pname opp">{{ matchOppName }}</span>
          </div>
        </div>

        <div v-else class="waiting-indicator">
          <div class="dot"></div><div class="dot"></div><div class="dot"></div>
          <span>SEARCHING</span>
        </div>
        <button class="btn btn-danger" @click="cancelQuickMatch">← キャンセル</button>
      </div>
    </div>

    <!-- WAITING ROOM -->
    <div v-if="gameState === 'waiting'" class="waiting-content">
      <div class="logo small">WAITING</div>
      <div class="subtitle">FOR PLAYERS</div>
      <div class="card wide">
        <div class="card-title">▶ ROOM CODE</div>
        <div class="room-code-display" @click="copyRoomCode">
          <span class="code-label">SHARE THIS CODE</span>
          <span class="code">{{ roomCode }}</span>
          <div class="copy-hint">クリックしてコピー</div>
        </div>
        <div class="player-count-info">{{ joinedPlayers.length }} / {{ maxPlayers }} 人が参加中</div>
        <div class="player-list">
          <div v-for="(p, i) in slots" :key="i" class="player-slot" :class="{ filled: !!roomData[p], empty: !roomData[p] }" :style="roomData[p] ? { borderColor: SBORDER[i+1] } : {}">
            <span class="slot-num" :style="{ color: roomData[p] ? SBORDER[i+1] : '' }">P{{ i+1 }}</span>
            <span class="slot-name">{{ roomData[p] ? roomData[p].name : 'WAITING...' }}</span>
            <span v-if="p === 'p1' && roomData[p]" class="slot-badge host">HOST</span>
            <span v-if="p === mySlot" class="slot-badge you">YOU</span>
          </div>
        </div>
        <div class="waiting-indicator">
          <div class="dot"></div><div class="dot"></div><div class="dot"></div>
          <span v-if="mySlot === 'p1'">{{ joinedPlayers.length >= 2 ? '準備完了！' : 'あと1人以上必要です' }}</span>
          <span v-else>ホストの開始を待っています</span>
        </div>
        <button v-if="mySlot === 'p1' && joinedPlayers.length >= 2" class="btn btn-green" @click="hostStartGame">▶ ゲーム開始 ({{ joinedPlayers.length }}人)</button>
        <button class="btn btn-danger" @click="cancelWaiting">← CANCEL</button>
      </div>
    </div>

    <!-- GAME -->
    <div v-if="gameState === 'playing' || gameState === 'countdown'" class="game-screen-content">
      <div class="game-header">
        <span class="game-title">TETRIS MULTI BATTLE</span>
        <div class="game-header-right">
          <button class="sound-btn" :class="{ on: seOn }" @click="handleToggleSE">SE {{ seOn ? 'ON' : 'OFF' }}</button>
          <button class="btn-quit" @click="leaveRoom">QUIT</button>
        </div>
      </div>

      <div class="game-scale-wrap">
        <div class="multi-layout">
          <div class="my-outer">
            <div class="side-col">
              <div class="panel-box"><div class="panel-box-title">HOLD</div><canvas ref="holdCanvas" width="68" height="68"></canvas></div>
              <div class="panel-box"><div class="panel-box-title">NEXT</div><canvas ref="nextCanvas" width="68" height="68"></canvas></div>
              <div class="panel-box"><div class="panel-box-title">SCORE</div><div class="score-value">{{ score }}</div></div>
              <div class="panel-box rank-box">
                <div class="panel-box-title">RANK</div>
                <div class="rank-val">{{ currentRank }}</div>
                <div class="alive-val">ALIVE: {{ aliveCount }}/{{ totalPlayers }}</div>
              </div>
              <div class="panel-box combo-box">
                <div class="panel-box-title">COMBO</div>
                <div class="combo-value" :class="{ pop: combo > 1 }">{{ combo > 1 ? combo : 0 }}</div>
                <div class="b2b-badge" :class="b2b ? 'on' : 'off'">B2B</div>
              </div>
              <div class="panel-box atk-box">
                <div class="panel-box-title">ATTACK</div>
                <div class="atk-row"><span class="atk-label">SENT</span><span class="atk-val sent">{{ atkSent }}</span></div>
                <div class="atk-row"><span class="atk-label">! NEXT</span><span class="atk-val recv">{{ myPendGarb }}</span></div>
              </div>
            </div>

            <div class="my-section">
              <div class="player-label" :class="'lp' + myIdx">P{{ myIdx }}</div>
              <div class="player-name-tag">{{ playerName }}</div>
              <div class="board-with-garb">
                <div class="garbage-bar">
                  <div v-for="i in Math.min(myPendGarb, 20)" :key="i" class="garb-cell" :class="{ warn: myPendGarb >= 10 }"></div>
                </div>
                <div class="board-wrap" :class="{ shake: isShaking }">
                  <canvas ref="myCanvas" width="200" height="400"></canvas>
                  <div class="lock-flash" :class="{ show: showLockFlash }"></div>
                  <div class="action-popup" :class="{ show: showPopup }">{{ popupText }}</div>
                  <div class="attack-count-badge" :class="{ show: showAttackBadge }">+{{ attackValue }} !</div>
                </div>
              </div>
            </div>
          </div>

          <div class="opponents-area">
            <div v-for="sk in otherActiveSlots" :key="sk" class="opp-section">
              <div class="player-label" :class="['lp' + sk.replace('p',''), { dead: !opponents[sk]?.alive }]">P{{ sk.replace('p','') }}</div>
              <div class="player-name-tag">{{ roomData[sk]?.name || sk }} ({{ opponents[sk]?.score || 0 }})</div>
              <div class="opp-canvas-wrap">
                <canvas :ref="el => setOppCanvas(el, sk)" width="200" height="400" :style="oppCanvasStyle(sk)"></canvas>
                <div class="opp-dead-overlay" :class="{ show: !opponents[sk]?.alive }">OUT</div>
              </div>
              <div class="opp-score-tag">{{ opponents[sk]?.score || 0 }} pts</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- RESULT -->
    <div v-if="gameState === 'result'" class="overlay show">
      <div class="final-rank" :class="'r' + Math.min(finalRank, 4)">{{ finalRank }}{{ rankSuffix(finalRank) }}</div>
      <div class="rank-label-text">PLACE</div>
      <div class="overlay-title" :class="finalRank === 1 ? 'win' : 'mid'">{{ finalRank === 1 ? 'WINNER!!' : 'TOP ' + finalRank }}</div>
      <div class="result-stats-grid">
        <div class="rs-cell"><div class="rs-cell-label">SCORE</div><div class="rs-cell-val">{{ score }}</div></div>
        <div class="rs-cell"><div class="rs-cell-label">LEVEL</div><div class="rs-cell-val">{{ level }}</div></div>
        <div class="rs-cell"><div class="rs-cell-label">LINES</div><div class="rs-cell-val">{{ lines }}</div></div>
        <div class="rs-cell"><div class="rs-cell-label">ATK SENT</div><div class="rs-cell-val">{{ atkSent }}</div></div>
      </div>
      <div class="result-sub">{{ totalPlayers }}人中 第{{ finalRank }}位</div>
      <div class="result-btn-row">
        <button v-if="!isBotMatch" class="btn btn-primary" style="width:180px;" @click="handleRematch" :disabled="rematchPending">{{ rematchPending ? 'WAITING...' : '▶ REMATCH' }}</button>
        <button class="btn btn-secondary" style="width:180px;" @click="goLobby">BACK TO LOBBY</button>
      </div>
    </div>

    <!-- COUNTDOWN -->
    <div v-if="gameState === 'countdown'" class="countdown-overlay show">
      <div class="countdown-num" :key="countdownVal">{{ countdownVal === 0 ? 'GO!' : countdownVal }}</div>
    </div>

    <div class="toast" :class="{ show: showToastFlag, ok: toastType === 'ok', warn: toastType === 'warn' }">{{ toastMsg }}</div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref as dbRef, set, get, onValue, update, remove, onDisconnect, runTransaction } from 'firebase/database';
import { FB_CONFIG } from '../logic/config';
import { TetrisGame, BotController } from '../logic/tetris';
import { playSE, toggleSE, isSEOn } from '../logic/sound';
import { onAuthReady, getCachedProfile } from '../logic/auth';
import { saveMultiResult, upsertUserProfile } from '../logic/db';
import AuthWidget from '../components/AuthWidget.vue';

const SBORDER = ['', '#00f5ff', '#ff0080', '#aaff00', '#ff8800'];
const SGLOW = ['', 'rgba(0,245,255,.3)', 'rgba(255,0,128,.3)', 'rgba(170,255,0,.3)', 'rgba(255,136,0,.3)'];

const app = getApps().length ? getApp() : initializeApp(FB_CONFIG);
const db = getDatabase(app);
let serverTimeOffset = 0;
onValue(dbRef(db, '.info/serverTimeOffset'), snap => { serverTimeOffset = snap.val() || 0; });
const getServerTime = () => Date.now() + serverTimeOffset;

const gameState = ref('lobby');
const playerName = ref(localStorage.getItem('multi_playerName') || 'PLAYER');
const user = ref(null);
const maxPlayers = ref(3);
const roomCodeInput = ref('');
const roomCode = ref(null);
const mySlot = ref(null);
const roomData = ref({});
const seOn = ref(isSEOn());

const matchStatusText = ref('');
const matchTimerRemain = ref(30000);
const matchTimerPercent = computed(() => (matchTimerRemain.value / 30000) * 100);
const matchFound = ref(false);
const matchOppName = ref('???');
const rematchPending = ref(false);

const score = ref(0);
const level = ref(1);
const lines = ref(0);
const combo = ref(0);
const b2b = ref(false);
const myPendGarb = ref(0);
const atkSent = ref(0);
const currentRank = ref('?');
const aliveCount = ref(0);
const totalPlayers = ref(0);
const finalRank = ref(null);
const isBotMatch = ref(false);
const isShaking = ref(false);
const showLockFlash = ref(false);
const showPopup = ref(false);
const popupText = ref('');
const showAttackBadge = ref(false);
const attackValue = ref(0);
const countdownVal = ref(3);

const myCanvas = ref(null);
const holdCanvas = ref(null);
const nextCanvas = ref(null);
const oppCanvases = reactive({});
const opponents = reactive({});

let game = null;
let qmBotGame = null;
let qmBotCtrl = null;
let animId = null;
let unsubAuth = null;
let qmTimerId = null;
let qmMyId = null;
const subs = {};

const showToastFlag = ref(false);
const toastMsg = ref('');
const toastType = ref('');
const showToast = (msg, type = '') => {
  toastMsg.value = msg; toastType.value = type; showToastFlag.value = true;
  setTimeout(() => showToastFlag.value = false, 3000);
};

const slots = computed(() => ['p1', 'p2', 'p3', 'p4'].slice(0, maxPlayers.value));
const joinedPlayers = computed(() => Object.keys(roomData.value).filter(k => k.startsWith('p') && roomData.value[k]));
const myIdx = computed(() => mySlot.value ? parseInt(mySlot.value.replace('p', '')) : 1);
const otherActiveSlots = computed(() => (roomData.value.activeSlots || []).filter(s => s !== mySlot.value));

onMounted(() => {
  unsubAuth = onAuthReady(async (u) => {
    user.value = u;
    if (u) {
      await upsertUserProfile(u).catch(() => {});
      const p = getCachedProfile();
      playerName.value = (p?.displayName || u.displayName || u.email || 'PLAYER').trim().toUpperCase().slice(0, 12);
    }
  });
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
});

onUnmounted(() => {
  if (unsubAuth) unsubAuth();
  stopGame();
  Object.values(subs).forEach(unsub => unsub());
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
});

const handleToggleSE = () => { seOn.value = toggleSE(); };
const goLobby = () => { leaveRoom(); gameState.value = 'lobby'; };
const rankSuffix = (r) => ['st', 'nd', 'rd', 'th'][Math.min(r - 1, 3)] || 'th';
const copyRoomCode = () => { if (!roomCode.value) return; navigator.clipboard?.writeText(roomCode.value).then(() => showToast('コードをコピーしました！', 'ok')); };
const setOppCanvas = (el, sk) => { if (el) oppCanvases[sk] = el; };
const oppCanvasStyle = (sk) => { const idx = parseInt(sk.replace('p', '')); return { border: `1px solid ${SBORDER[idx]}`, boxShadow: `0 0 12px ${SGLOW[idx]}` }; };

const handleCreateRoom = async () => {
  // 6-digit room code as requested by memory
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const rRef = dbRef(db, 'multi/' + code);
  const snap = await get(rRef);
  if (snap.exists()) return handleCreateRoom(); // collision check

  mySlot.value = 'p1';
  roomCode.value = code;
  await set(rRef, { p1: { name: playerName.value, alive: true }, status: 'waiting', maxPlayers: maxPlayers.value, ts: getServerTime() });
  onDisconnect(rRef).remove();
  gameState.value = 'waiting';
  listenRoom();
};

const handleJoinRoom = async () => {
  const code = roomCodeInput.value.trim();
  if (!/^\d{6}$/.test(code) && !/^\d{4}$/.test(code)) { showToast('ルームコードを入力してください', 'warn'); return; }
  const rRef = dbRef(db, 'multi/' + code);
  const snap = await get(rRef);
  if (!snap.exists()) { showToast('ルームが見つかりません', 'warn'); return; }
  const d = snap.val();
  if (d.status !== 'waiting') { showToast('参加できません', 'warn'); return; }
  const free = ['p1', 'p2', 'p3', 'p4'].slice(0, d.maxPlayers || 3).find(s => !d[s]);
  if (!free) { showToast('満員です', 'warn'); return; }

  mySlot.value = free;
  roomCode.value = code;
  await update(rRef, { [free]: { name: playerName.value, alive: true } });
  onDisconnect(dbRef(db, `multi/${code}/${free}`)).remove();
  gameState.value = 'waiting';
  listenRoom();
};

const listenRoom = () => {
  if (subs.room) subs.room();
  const rRef = dbRef(db, 'multi/' + roomCode.value);
  subs.room = onValue(rRef, snap => {
    const d = snap.val();
    if (!d) { if(gameState.value !== 'lobby') { goLobby(); showToast('ルームが削除されました', 'warn'); } return; }
    roomData.value = d;
    maxPlayers.value = d.maxPlayers || 3;
    if (d.status === 'started' && (gameState.value === 'waiting' || gameState.value === 'lobby' || gameState.value === 'result')) startGame(d);
    if (d.status === 'waiting' && gameState.value === 'result') {
      rematchPending.value = false;
      gameState.value = 'waiting';
    }
  });
};

const hostStartGame = async () => {
  const active = joinedPlayers.value;
  const gsa = getServerTime() + 5000;
  await update(dbRef(db, 'multi/' + roomCode.value), { status: 'started', gameStartAt: gsa, activeSlots: active });
};

const cancelWaiting = async () => {
  if (mySlot.value === 'p1') await remove(dbRef(db, 'multi/' + roomCode.value));
  else await update(dbRef(db, 'multi/' + roomCode.value), { [mySlot.value]: null });
  goLobby();
};

const startGame = async (d) => {
  if (gameState.value === 'playing') return;
  const active = d.activeSlots || joinedPlayers.value;
  totalPlayers.value = active.length;
  isBotMatch.value = false;

  active.forEach(sk => {
    if (sk !== mySlot.value) {
      opponents[sk] = { score: 0, alive: true, board: [] };
      if (subs['opp_'+sk]) subs['opp_'+sk]();
      subs['opp_' + sk] = onValue(dbRef(db, `multi/${roomCode.value}/game/${sk}`), snap => {
        const od = snap.val(); if (!od) return;
        opponents[sk].score = od.score;
        if (od.gameOver && opponents[sk].alive) { opponents[sk].alive = false; playSE('elim'); }
        if (oppCanvases[sk]) TetrisGame.drawOpp(oppCanvases[sk], od, 200, 400);
      });
    }
  });

  if (subs.garb) subs.garb();
  subs.garb = onValue(dbRef(db, `multi/${roomCode.value}/garb/${mySlot.value}`), snap => {
    const v = snap.val(); if (!v || !v.n || !game) return;
    const n = v.n;
    runTransaction(dbRef(db, `multi/${roomCode.value}/garb/${mySlot.value}`), cur => cur && cur.n > 0 ? { n: 0 } : cur);
    game.pendGarb += n;
    triggerAttackFlash(n);
  });

  gameState.value = 'countdown';
  const startAt = d.gameStartAt || (getServerTime() + 5000);
  const tick = () => {
    const now = getServerTime();
    const remain = startAt - now;
    if (remain > 3000) countdownVal.value = 3;
    else if (remain > 2000) { if(countdownVal.value!==2) playSE('countdown'); countdownVal.value = 2; }
    else if (remain > 1000) { if(countdownVal.value!==1) playSE('countdown'); countdownVal.value = 1; }
    else if (remain > 0) { if(countdownVal.value!==0) playSE('go'); countdownVal.value = 0; }
    else { runGameLoop(); return; }
    if (gameState.value === 'countdown') setTimeout(tick, 100);
  };
  tick();
};

const runGameLoop = async () => {
  gameState.value = 'playing';
  score.value = 0; level.value = 1; lines.value = 0; combo.value = 0; b2b.value = false; myPendGarb.value = 0; atkSent.value = 0;
  await nextTick();
  game = new TetrisGame(myCanvas.value, holdCanvas.value, nextCanvas.value);
  let lastPush = 0;
  const loop = (ts) => {
    if (gameState.value !== 'playing') return;
    game.update(ts); game.draw();
    while (game.results.length > 0) {
      const res = game.results.shift();
      if (res.garbageOut > 0) { atkSent.value += res.garbageOut; sendGarbage(res.garbageOut); }
      if (res.actionLabel) triggerPopup(res.actionLabel);
    }
    score.value = game.score; level.value = game.level; lines.value = game.lines; combo.value = game.combo; b2b.value = game.b2b; myPendGarb.value = game.pendGarb;
    if (ts - lastPush > 50) { lastPush = ts; set(dbRef(db, `multi/${roomCode.value}/game/${mySlot.value}`), game.serialize()); }
    const aliveOpps = Object.values(opponents).filter(o => o.alive).length;
    aliveCount.value = aliveOpps + (game.over ? 0 : 1);
    if (!game.over) currentRank.value = aliveOpps + 1;
    if (game.over) { set(dbRef(db, `multi/${roomCode.value}/game/${mySlot.value}`), game.serialize()); update(dbRef(db, `multi/${roomCode.value}/alive/${mySlot.value}`), false); endGame(aliveOpps + 1); return; }
    if (aliveOpps === 0 && totalPlayers.value > 1) { endGame(1); return; }
    animId = requestAnimationFrame(loop);
  };
  animId = requestAnimationFrame(loop);
};

const sendGarbage = (n) => {
  const aliveOpps = Object.keys(opponents).filter(sk => opponents[sk].alive);
  if (aliveOpps.length === 0) return;
  const target = aliveOpps[Math.floor(Math.random() * aliveOpps.length)];
  runTransaction(dbRef(db, `multi/${roomCode.value}/garb/${target}`), cur => {
    const prev = (cur && cur.n) || 0;
    return { n: prev + n };
  });
};

const endGame = (rank) => {
  finalRank.value = rank; gameState.value = 'result'; if (rank === 1) playSE('win'); stopGame();
  if (user.value) { saveMultiResult(user.value.uid, { rank, totalPlayers: totalPlayers.value, score: score.value, lines: lines.value, level: level.value, attackSent: atkSent.value, mode: isBotMatch.value ? 'qm_bot' : 'room' }); }
};

const handleRematch = async () => {
  if (rematchPending.value) return;
  rematchPending.value = true;
  if (mySlot.value === 'p1') {
    const code = roomCode.value;
    await Promise.all([
      remove(dbRef(db, `multi/${code}/game`)),
      remove(dbRef(db, `multi/${code}/garb`)),
      remove(dbRef(db, `multi/${code}/alive`))
    ]);
    const updateData = { status: 'waiting', gameStartAt: null, activeSlots: null };
    ['p2', 'p3', 'p4'].forEach(s => { updateData[s] = null; });
    await update(dbRef(db, `multi/${code}`), updateData);
    showToast('ルームをリセットしました', 'ok');
  } else {
    showToast('ホストのリマッチを待っています...', 'ok');
    // For non-host, we just wait for the host to reset the room status to 'waiting'
    // which is already handled in listenRoom()
  }
};

const leaveRoom = () => {
  if (roomCode.value && mySlot.value && !isBotMatch.value) {
    update(dbRef(db, `multi/${roomCode.value}/game/${mySlot.value}`), { gameOver: true });
    if (mySlot.value !== 'p1') update(dbRef(db, `multi/${roomCode.value}/${mySlot.value}`), null);
    else remove(dbRef(db, `multi/${roomCode.value}`));
  }
  stopGame();
  gameState.value = 'lobby';
};

const stopGame = () => { if (animId) cancelAnimationFrame(animId); game = null; };

const triggerPopup = (txt) => { popupText.value = txt.replace('\n', ' / '); showPopup.value = true; setTimeout(() => showPopup.value = false, 900); };
const triggerAttackFlash = (n) => { attackValue.value = n; showAttackBadge.value = true; isShaking.value = true; playSE('attack'); setTimeout(() => { showAttackBadge.value = false; isShaking.value = false; }, 1200); };

// Quick Match System (Fallback to Bot)
const quickMatch = async () => {
  gameState.value = 'matching';
  matchStatusText.value = '対戦相手を検索中...';
  matchFound.value = false;
  matchTimerRemain.value = 30000;

  qmMyId = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const myRef = dbRef(db, 'matchmaking/queue/' + qmMyId);
  await set(myRef, { name: playerName.value, ts: getServerTime(), id: qmMyId });
  onDisconnect(myRef).remove();

  qmTimerId = setInterval(() => {
    matchTimerRemain.value -= 500;
    if (matchTimerRemain.value <= 0) {
      clearInterval(qmTimerId);
      startBotMatch();
    }
  }, 500);

  subs.qm = onValue(dbRef(db, 'matchmaking/queue'), async snap => {
    const data = snap.val(); if (!data || gameState.value !== 'matching') return;
    const entries = Object.values(data).sort((a,b) => a.ts - b.ts);
    if (entries.length >= 2) {
      const p1 = entries[0], p2 = entries[1];
      if (p1.id === qmMyId || p2.id === qmMyId) {
        clearInterval(qmTimerId);
        matchFound.value = true;
        matchOppName.value = p1.id === qmMyId ? p2.name : p1.name;
        remove(dbRef(db, 'matchmaking/queue/' + p1.id));
        remove(dbRef(db, 'matchmaking/queue/' + p2.id));

        if (p1.id === qmMyId) {
          // I am p1, create room
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          const gsa = getServerTime() + 5000;
          await set(dbRef(db, 'multi/' + code), {
            p1: { name: p1.name, alive: true },
            p2: { name: p2.name, alive: true },
            status: 'started', maxPlayers: 2, gameStartAt: gsa, activeSlots: ['p1', 'p2'], ts: getServerTime()
          });
          // notify p2
          await set(dbRef(db, 'matchmaking/matches/' + p2.id), { code, gsa });

          setTimeout(() => {
            mySlot.value = 'p1'; roomCode.value = code;
            listenRoom();
          }, 2000);
        } else {
          // I am p2, wait for code
          const mRef = dbRef(db, 'matchmaking/matches/' + qmMyId);
          onValue(mRef, mSnap => {
            const md = mSnap.val(); if (!md) return;
            remove(mRef);
            setTimeout(() => {
              mySlot.value = 'p2'; roomCode.value = md.code;
              listenRoom();
            }, 2000);
          }, { onlyOnce: true });
        }
      }
    }
  });
};

const cancelQuickMatch = () => {
  clearInterval(qmTimerId);
  if (subs.qm) subs.qm();
  if (qmMyId) remove(dbRef(db, 'matchmaking/queue/' + qmMyId));
  goLobby();
};

const startBotMatch = () => {
  isBotMatch.value = true;
  matchStatusText.value = '対戦相手が見つかりました！';
  matchFound.value = true;
  matchOppName.value = 'BOT-NORMAL';
  setTimeout(async () => {
    gameState.value = 'playing';
    totalPlayers.value = 2;
    mySlot.value = 'p1';
    await nextTick();
    game = new TetrisGame(myCanvas.value, holdCanvas.value, nextCanvas.value);
    qmBotGame = new TetrisGame(null, null, null);
    qmBotCtrl = new BotController(qmBotGame, 2);
    runBotLoop();
  }, 2000);
};

const runBotLoop = () => {
  const loop = (ts) => {
    if (gameState.value !== 'playing') return;
    game.update(ts); game.draw();
    qmBotCtrl.tick(ts); qmBotGame.update(ts);

    const bd = qmBotGame.serialize();
    if (oppCanvases['p2']) TetrisGame.drawOpp(oppCanvases['p2'], bd, 200, 400);
    opponents['p2'] = { score: bd.score, alive: !bd.gameOver };

    while (game.results.length > 0) {
      const res = game.results.shift();
      if (res.garbageOut > 0) { atkSent.value += res.garbageOut; qmBotGame.pendGarb += res.garbageOut; }
      if (res.actionLabel) triggerPopup(res.actionLabel);
    }
    while (qmBotGame.results.length > 0) {
      const res = qmBotGame.results.shift();
      if (res.garbageOut > 0) { game.pendGarb += res.garbageOut; triggerAttackFlash(res.garbageOut); }
    }

    score.value = game.score; level.value = game.level; lines.value = game.lines; combo.value = game.combo; b2b.value = game.b2b;
    const aliveOpps = opponents['p2']?.alive ? 1 : 0;
    aliveCount.value = aliveOpps + (game.over ? 0 : 1);
    if (game.over) { endGame(aliveOpps + 1); return; }
    if (aliveOpps === 0) { endGame(1); return; }
    animId = requestAnimationFrame(loop);
  };
  animId = requestAnimationFrame(loop);
};

// Inputs
const keys = new Set();
let softDropInterval = null;
const handleKeyDown = (e) => {
  if (gameState.value !== 'playing' || !game) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  if (keys.has(e.code)) return;
  keys.add(e.code);
  switch (e.code) {
    case 'ArrowLeft': game.move(-1); break;
    case 'ArrowRight': game.move(1); break;
    case 'ArrowUp': case 'KeyX': game.rotate(1); break;
    case 'KeyZ': game.rotate(-1); break;
    case 'ArrowDown': softDropInterval = setInterval(() => game.softDrop(), 50); break;
    case 'Space': game.hardDrop(); break;
    case 'ShiftLeft': case 'ShiftRight': case 'KeyC': game.hold(); break;
  }
};
const handleKeyUp = (e) => {
  keys.delete(e.code);
  if (e.code === 'ArrowDown') { clearInterval(softDropInterval); softDropInterval = null; }
};
</script>

<style scoped>
/* Reuse and extend styles from MultiBattleView.vue */
.screen { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; z-index: 10; position: relative; color: #e0f0ff; }
.logo { font-family: 'Press Start 2P', monospace; font-size: clamp(18px, 4vw, 38px); color: #00f5ff; text-shadow: 0 0 20px rgba(0, 245, 255, .5); margin-bottom: 10px; }
.logo.small { font-size: 20px; }
.subtitle { font-size: 10px; color: #ff0080; letter-spacing: 4px; margin-bottom: 30px; }
.card { background: #0a0f1a; border: 1px solid #1a2540; border-radius: 4px; padding: 25px; width: 100%; max-width: 440px; position: relative; }
.card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, #00f5ff, #ff0080, #aaff00, #ff8800) }
.card.wide { max-width: 500px; }
.card.narrow { max-width: 400px; }

.btn { display: block; width: 100%; padding: 13px; border: none; border-radius: 2px; cursor: pointer; font-family: 'Orbitron', monospace; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; transition: all 0.2s; text-align: center; margin-top: 10px; }
.btn-match { background: linear-gradient(135deg, #ff8800, #ff4400); color: #fff; }
.btn-primary { background: linear-gradient(135deg, #00f5ff, #0080ff); color: #000 }
.btn-secondary { background: transparent; border: 1px solid #ff0080; color: #ff0080; }
.btn-danger { background: transparent; border: 1px solid #ff3355; color: #ff3355; }
.btn-green { background: linear-gradient(135deg, #00cc66, #009944); color: #000; }

.divider { display: flex; align-items: center; gap: 10px; margin: 15px 0; color: #4a6080; font-size: 10px; }
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: #1a2540 }

/* Matching */
.match-status-text { font-family: 'Press Start 2P'; font-size: 9px; color: #aaff00; text-align: center; min-height: 20px; }
.match-timer-wrap { width: 100%; height: 6px; background: #0d1525; border-radius: 3px; margin: 15px 0; overflow: hidden; }
.match-timer-bar { height: 100%; background: #00f5ff; transition: width 0.5s linear; }
.match-timer-bar.danger { background: #ff3355; }
.match-found-flash { font-family: 'Press Start 2P'; font-size: 18px; color: #aaff00; text-align: center; animation: pop 0.4s ease-out; }
@keyframes pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
.match-player-preview { display: flex; align-items: center; justify-content: center; gap: 20px; margin-top: 20px; }
.match-vs { font-family: 'Press Start 2P'; color: #ff0080; }
.match-pname { font-family: 'Press Start 2P'; font-size: 10px; }

/* Waiting */
.room-code-display { text-align: center; padding: 15px; background: rgba(0, 245, 255, 0.05); border: 1px dashed #00f5ff; cursor: pointer; margin-bottom: 15px; }
.code { font-family: 'Press Start 2P'; font-size: 24px; color: #00f5ff; letter-spacing: 5px; }
.player-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; }
.player-slot { display: flex; align-items: center; padding: 10px; border: 1px solid #1a2540; border-radius: 3px; gap: 10px; }
.slot-badge { font-size: 8px; padding: 2px 5px; border-radius: 2px; }
.slot-badge.host { background: rgba(255, 136, 0, 0.2); color: #ff8800; border: 1px solid #ff8800; }
.slot-badge.you { background: rgba(0, 245, 255, 0.2); color: #00f5ff; border: 1px solid #00f5ff; }

/* In Game */
.game-header { width: 100%; max-width: 1200px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.game-title { font-family: 'Press Start 2P'; font-size: 10px; color: #00f5ff; }
.multi-layout { display: flex; gap: 20px; align-items: flex-start; }
.my-outer { display: flex; gap: 10px; }
.side-col { width: 80px; display: flex; flex-direction: column; gap: 8px; }
.panel-box { background: #0a0f1a; border: 1px solid #1a2540; padding: 8px; border-radius: 3px; }
.panel-box-title { font-size: 9px; color: #4a6080; margin-bottom: 5px; }
.score-value { font-family: 'Press Start 2P'; font-size: 10px; color: #aaff00; }
.rank-val { font-family: 'Press Start 2P'; font-size: 18px; color: #ffd700; }
.my-section { display: flex; flex-direction: column; align-items: center; gap: 5px; }
canvas { background: rgba(0,0,0,0.5); }
#myCanvas { border: 1px solid #00f5ff; box-shadow: 0 0 15px rgba(0, 245, 255, 0.2); }

.opponents-area { display: flex; gap: 10px; flex-wrap: wrap; }
.opp-section { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.opp-canvas-wrap { position: relative; }
.opp-dead-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.7); display: none; align-items: center; justify-content: center; color: #ff3355; font-family: 'Press Start 2P'; font-size: 10px; }
.opp-dead-overlay.show { display: flex; }

/* Overlays */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 3000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15px; }
.final-rank { font-family: 'Press Start 2P'; font-size: 60px; }
.final-rank.r1 { color: #ffd700; text-shadow: 0 0 30px #ffd700; }
.overlay-title { font-family: 'Press Start 2P'; font-size: 20px; }
.win { color: #aaff00; }
.result-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 300px; }
.rs-cell { background: #0d1525; padding: 10px; border: 1px solid #1a2540; text-align: center; }
.rs-cell-label { font-size: 9px; color: #4a6080; }
.rs-cell-val { font-family: 'Press Start 2P'; font-size: 12px; color: #aaff00; }

.countdown-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2500; }
.countdown-num { font-family: 'Press Start 2P'; font-size: 100px; color: #00f5ff; text-shadow: 0 0 30px #00f5ff; }

.toast { position: fixed; top: 20px; background: #0a0f1a; border: 1px solid #ff0080; padding: 10px 20px; border-radius: 4px; font-size: 12px; z-index: 4000; transition: all 0.3s; opacity: 0; transform: translateY(-20px); }
.toast.show { opacity: 1; transform: translateY(0); }
.toast.ok { border-color: #aaff00; color: #aaff00; }

.btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
