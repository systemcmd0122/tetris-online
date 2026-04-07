<template>
  <div class="screen" :class="{ active: true }">
    <!-- LOBBY -->
    <div v-if="gameState === 'lobby'" class="lobby-content">
      <div class="logo">SPRINT</div>
      <div class="subtitle">40 LINES ATTACK</div>
      <div class="card">
        <AuthWidget />
        <div class="card-title">▶ PLAYER SETUP</div>
        <div class="input-group">
          <label>PLAYER NAME</label>
          <input type="text" v-model="playerName" :disabled="!!user" :style="user ? 'opacity:0.6;cursor:not-allowed' : ''" maxlength="12">
        </div>
        <div class="sprint-info">
          ▶ 40ライン消去のタイムを競う<br>
          ▶ クリアタイムはグローバルランキングに登録<br>
          ▶ 自己ベストは自動で更新
        </div>
        <button class="btn btn-sprint" @click="startCountdown">▶ START SPRINT</button>
        <button class="btn btn-rank" @click="showRanking">🏆 RANKING</button>
        <router-link to="/" class="btn btn-back">◀ MENU</router-link>
      </div>
      <div v-if="pb" class="pb-display">YOUR BEST: {{ formatTime(pb) }}</div>
    </div>

    <!-- GAME -->
    <div v-if="gameState === 'playing' || gameState === 'countdown'" class="game-screen-content">
      <div class="game-header">
        <div class="game-title">SPRINT — 40 LINES</div>
        <div class="game-header-right">
          <button class="sound-btn" :class="{ on: seOn }" @click="handleToggleSE">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
              <path d="M11 3L6 7H3a1 1 0 00-1 1v4a1 1 0 001 1h3l5 4V3zm4.07 1.93a9 9 0 010 12.74M15.54 6.46a5 5 0 010 7.07" />
            </svg> SE
          </button>
          <button class="btn-quit" @click="quitGame">QUIT</button>
        </div>
      </div>

      <div class="game-layout">
        <!-- LEFT PANEL -->
        <div class="side-panel">
          <div class="panel-box timer-box">
            <div class="timer-label">TIME</div>
            <div class="timer-value">{{ formatTime(elapsedMs) }}</div>
          </div>
          <div class="panel-box progress-box">
            <div class="progress-label">
              <span>LINES</span>
              <span>{{ linesCleared }} / 40</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" :style="{ width: (linesCleared / 40 * 100) + '%' }"></div>
            </div>
          </div>
          <div class="panel-box">
            <div class="panel-box-title">HOLD</div>
            <canvas ref="holdCanvas" width="80" height="80"></canvas>
          </div>
        </div>

        <!-- BOARD -->
        <div class="board-wrap" :class="{ shake: isShaking }">
          <canvas ref="mainCanvas" width="200" height="400"></canvas>
          <div class="lock-flash" :class="{ show: showLockFlash }"></div>
          <div class="action-popup" :class="{ show: showPopup }">{{ popupText }}</div>
        </div>

        <!-- RIGHT PANEL -->
        <div class="side-panel">
          <div class="panel-box">
            <div class="panel-box-title">NEXT</div>
            <canvas ref="nextCanvas" width="80" height="80"></canvas>
          </div>
          <div class="panel-box">
            <div class="panel-box-title">SCORE</div>
            <div class="score-value">{{ score }}</div>
          </div>
          <div class="panel-box">
            <div class="panel-box-title">LEVEL</div>
            <div class="level-value">{{ level }}</div>
          </div>
          <div class="panel-box">
            <div class="panel-box-title">PB</div>
            <div class="pb-panel">{{ pb ? formatTime(pb) : '--:--.---' }}</div>
          </div>
        </div>
      </div>

      <!-- Mobile Controls -->
      <div class="mobile-controls">
        <div class="mobile-row">
          <button class="mobile-btn" @touchstart.prevent="handleHold">C</button>
          <button class="mobile-btn" @touchstart.prevent="handleRotate(-1)">↺</button>
          <button class="mobile-btn" @touchstart.prevent="handleRotate(1)">↻</button>
        </div>
        <div class="mobile-row">
          <button class="mobile-btn" @touchstart.prevent="dasStart(-1)" @touchend.prevent="dasStop">◀</button>
          <button class="mobile-btn" @touchstart.prevent="softDropStart" @touchend.prevent="softDropStop">▼</button>
          <button class="mobile-btn" @touchstart.prevent="dasStart(1)" @touchend.prevent="dasStop">▶</button>
        </div>
        <div class="mobile-row">
          <button class="mobile-btn hard-btn" @touchstart.prevent="handleHardDrop">HARD DROP</button>
        </div>
      </div>
    </div>

    <!-- RESULT -->
    <div v-if="gameState === 'result'" class="overlay show">
      <div class="overlay-title" :class="resultStatus === 'CLEAR' ? 'clear' : 'fail'">
        {{ resultStatus === 'CLEAR' ? 'CLEARED!' : 'GAME OVER' }}
      </div>
      <div class="result-time">{{ resultStatus === 'CLEAR' ? formatTime(elapsedMs) : '--' }}</div>
      <div v-if="globalRank" class="result-rank-badge" :class="rankClass">{{ rankText }}</div>

      <div class="result-stats-grid">
        <div class="rs-cell"><div class="rs-cell-label">SCORE</div><div class="rs-cell-val">{{ score }}</div></div>
        <div class="rs-cell"><div class="rs-cell-label">LEVEL</div><div class="rs-cell-val">{{ level }}</div></div>
        <div class="rs-cell"><div class="rs-cell-label">LINES</div><div class="rs-cell-val">{{ linesCleared }}</div></div>
        <div class="rs-cell"><div class="rs-cell-label">TETRIS</div><div class="rs-cell-val">{{ tetrisCount }}</div></div>
      </div>

      <div v-if="isNewPB" class="pb-badge">🏅 NEW PERSONAL BEST!</div>

      <div class="result-btn-row">
        <button class="result-btn retry" @click="startCountdown">▶ RETRY</button>
        <button class="result-btn rank" @click="showRanking">🏆 RANKING</button>
        <button class="result-btn menu" @click="goLobby">LOBBY</button>
      </div>
    </div>

    <!-- COUNTDOWN -->
    <div v-if="gameState === 'countdown'" class="countdown-overlay show">
      <div class="countdown-num" :key="countdownVal">{{ countdownVal === 0 ? 'GO!' : countdownVal }}</div>
    </div>

    <!-- RANKING SCREEN -->
    <div v-if="gameState === 'ranking'" class="screen active rank-screen">
       <div class="rank-header">
         <div class="rank-title">🏆 SPRINT RANKING</div>
         <div class="rank-sub">40 LINES — GLOBAL TOP 50</div>
       </div>
       <div class="rank-container">
         <div v-if="loadingRank" class="rank-loading">🔄 読み込み中...</div>
         <div v-else-if="rankError" class="rank-err">{{ rankError }}</div>
         <table v-else class="rank-table">
           <thead><tr><th>RANK</th><th>PLAYER</th><th>TIME</th><th>DATE</th></tr></thead>
           <tbody>
             <tr v-for="(entry, i) in ranking" :key="i" class="rank-row" :class="{ 'my-row': entry.name === playerName }">
               <td>
                 <span v-if="i === 0" class="rank-pos gold">1st</span>
                 <span v-else-if="i === 1" class="rank-pos silver">2nd</span>
                 <span v-else-if="i === 2" class="rank-pos bronze">3rd</span>
                 <span v-else class="rank-pos">#{{ i + 1 }}</span>
               </td>
               <td style="font-weight:bold">{{ i < 3 ? ['🥇','🥈','🥉'][i] : '' }}{{ entry.name }}{{ entry.name === playerName ? ' ◀' : '' }}</td>
               <td class="rank-time-cell">{{ formatTime(entry.ms) }}</td>
               <td class="rank-date">{{ entry.date }}</td>
             </tr>
           </tbody>
         </table>
       </div>
       <div class="rank-actions">
         <button class="btn btn-sprint" @click="startCountdown">▶ PLAY NOW</button>
         <button class="btn btn-back" @click="goLobby">◀ BACK</button>
       </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { TetrisGame } from '../logic/tetris';
import { playSE, toggleSE, isSEOn } from '../logic/sound';
import { onAuthReady, getCachedProfile, getCurrentUser } from '../logic/auth';
import { saveSprintResult, _getFS, upsertUserProfile } from '../logic/db';
import AuthWidget from '../components/AuthWidget.vue';
import { collection, query, orderBy, limit, getDocs, doc, runTransaction, serverTimestamp } from 'firebase/firestore';

const gameState = ref('lobby'); // lobby, countdown, playing, result, ranking
const playerName = ref(localStorage.getItem('sprint_playerName') || 'PLAYER');
const user = ref(null);
const pb = ref(parseInt(localStorage.getItem('sprint_pb')) || null);
const seOn = ref(isSEOn());

const countdownVal = ref(3);
const elapsedMs = ref(0);
const linesCleared = ref(0);
const score = ref(0);
const level = ref(1);
const tetrisCount = ref(0);
const isShaking = ref(false);
const showLockFlash = ref(false);
const showPopup = ref(false);
const popupText = ref('');
const resultStatus = ref('');
const isNewPB = ref(false);
const globalRank = ref(null);

const mainCanvas = ref(null);
const holdCanvas = ref(null);
const nextCanvas = ref(null);

let game = null;
let animId = null;
let startTime = 0;
let unsubAuth = null;

const loadingRank = ref(false);
const rankError = ref(null);
const ranking = ref([]);

onMounted(() => {
  unsubAuth = onAuthReady(async (u) => {
    user.value = u;
    if (u) {
      await upsertUserProfile(u).catch(() => {});
      const profile = getCachedProfile();
      playerName.value = (profile?.displayName || u.displayName || u.email || 'PLAYER').trim().replace(/\//g, '_').toUpperCase().slice(0, 12);
    }
  });
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
});

onUnmounted(() => {
  if (unsubAuth) unsubAuth();
  stopGame();
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
});

const formatTime = (ms) => {
  if (ms == null) return '--:--.---';
  const totalMs = Math.floor(ms);
  const min = Math.floor(totalMs / 60000);
  const sec = Math.floor((totalMs % 60000) / 1000);
  const msi = totalMs % 1000;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(msi).padStart(3, '0')}`;
};

const handleToggleSE = () => { seOn.value = toggleSE(); };

const goLobby = () => { gameState.value = 'lobby'; stopGame(); };

const quitGame = () => { if (confirm('ゲームを終了しますか？')) goLobby(); };

const startCountdown = () => {
  if (!user.value) localStorage.setItem('sprint_playerName', playerName.value);
  gameState.value = 'countdown';
  countdownVal.value = 3;
  const tick = () => {
    if (countdownVal.value > 0) {
      playSE('countdown');
      setTimeout(() => {
        countdownVal.value--;
        tick();
      }, 1000);
    } else {
      playSE('go');
      setTimeout(startGame, 800);
    }
  };
  tick();
};

const startGame = async () => {
  gameState.value = 'playing';
  elapsedMs.value = 0;
  linesCleared.value = 0;
  score.value = 0;
  level.value = 1;
  tetrisCount.value = 0;

  await nextTick();
  game = new TetrisGame(mainCanvas.value, holdCanvas.value, nextCanvas.value);
  startTime = performance.now();

  const loop = (ts) => {
    if (gameState.value !== 'playing') return;
    game.update(ts);
    game.draw();

    while (game.results.length > 0) {
      const r = game.results.shift();
      if (r.actionLabel) triggerPopup(r.actionLabel);
      if (r.cleared > 0) {
        showLockFlash.value = true;
        setTimeout(() => showLockFlash.value = false, 60);
      }
    }

    score.value = game.score;
    level.value = game.level;
    linesCleared.value = game.lines;
    tetrisCount.value = game.tetrisCount;
    elapsedMs.value = performance.now() - startTime;

    if (game.lines >= 40) { endSprint('CLEAR'); return; }
    if (game.over) { endSprint('FAIL'); return; }

    animId = requestAnimationFrame(loop);
  };
  animId = requestAnimationFrame(loop);
};

const stopGame = () => {
  if (animId) cancelAnimationFrame(animId);
  game = null;
  dasStop();
  softDropStop();
};

const endSprint = async (result) => {
  const finalTime = Math.floor(performance.now() - startTime);
  elapsedMs.value = finalTime;
  resultStatus.value = result;
  gameState.value = 'result';
  stopGame();

  if (result === 'CLEAR') {
    playSE('complete');
    if (!pb.value || finalTime < pb.value) {
      pb.value = finalTime;
      localStorage.setItem('sprint_pb', finalTime);
      isNewPB.value = true;
    } else {
      isNewPB.value = false;
    }

    try {
      globalRank.value = await uploadScore(playerName.value, finalTime);
      if (user.value) {
        await saveSprintResult(user.value.uid, { ms: finalTime, score: score.value, lines: 40, globalRank: globalRank.value });
      }
    } catch (e) {
      console.error('Score upload failed', e);
    }
  } else {
    playSE('fail');
  }
};

const triggerPopup = (text) => {
  popupText.value = text.split('\n')[0];
  showPopup.value = true;
  setTimeout(() => showPopup.value = false, 900);
};

const uploadScore = async (name, ms) => {
  const fs = await _getFS();
  const docRef = doc(fs, 'sprint_scores', name);
  await runTransaction(fs, async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists() || ms < snap.data().ms) {
      tx.set(docRef, { name, ms, updatedAt: serverTimestamp() });
    }
  });
  const snap = await getDocs(query(collection(fs, 'sprint_scores'), orderBy('ms'), limit(50)));
  const entries = snap.docs.map(d => d.data());
  const rank = entries.findIndex(e => e.name === name) + 1;
  return rank > 0 ? rank : 51;
};

const showRanking = async () => {
  gameState.value = 'ranking';
  loadingRank.value = true;
  rankError.value = null;
  try {
    const fs = await _getFS();
    const snap = await getDocs(query(collection(fs, 'sprint_scores'), orderBy('ms'), limit(50)));
    ranking.value = snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        date: data.updatedAt?.toDate ? data.updatedAt.toDate().toLocaleDateString('ja-JP') : '—'
      };
    });
  } catch (e) {
    rankError.value = '⚠ 読み込み失敗: ' + e.message;
  } finally {
    loadingRank.value = false;
  }
};

const rankText = computed(() => {
  if (globalRank.value === 1) return '🥇 WORLD #1';
  if (globalRank.value === 2) return '🥈 WORLD #2';
  if (globalRank.value === 3) return '🥉 WORLD #3';
  return `GLOBAL #${globalRank.value}`;
});

const rankClass = computed(() => {
  if (globalRank.value === 1) return 'gold';
  if (globalRank.value === 2) return 'silver';
  if (globalRank.value === 3) return 'bronze';
  return 'ranked';
});

// Input handling
const DAS = 170, ARR = 35;
const keys = new Set();
let dasTimer = null, dasDir = 0, arrTimer = null;
let softDropInterval = null;

const dasStart = (dir) => {
  if (dasDir === dir) return;
  dasStop();
  dasDir = dir;
  game?.move(dir);
  dasTimer = setTimeout(() => {
    arrTimer = setInterval(() => { game?.move(dir); }, ARR);
  }, DAS);
};
const dasStop = () => {
  clearTimeout(dasTimer);
  clearInterval(arrTimer);
  dasTimer = null; arrTimer = null; dasDir = 0;
};

const softDropStart = () => {
  if (softDropInterval) return;
  game?.softDrop();
  softDropInterval = setInterval(() => game?.softDrop(), 50);
};
const softDropStop = () => {
  clearInterval(softDropInterval);
  softDropInterval = null;
};

const handleHold = () => game?.hold();
const handleRotate = (dir) => game?.rotate(dir);
const handleHardDrop = () => game?.hardDrop();

const handleKeyDown = (e) => {
  if (gameState.value !== 'playing') return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  if (keys.has(e.code)) return;
  keys.add(e.code);

  if (!game) return;
  switch (e.code) {
    case 'ArrowLeft': dasStart(-1); break;
    case 'ArrowRight': dasStart(1); break;
    case 'ArrowUp': case 'KeyX': game.rotate(1); break;
    case 'KeyZ': game.rotate(-1); break;
    case 'ArrowDown': softDropStart(); break;
    case 'Space': game.hardDrop(); break;
    case 'ShiftLeft': case 'ShiftRight': case 'KeyC': game.hold(); break;
  }
};

const handleKeyUp = (e) => {
  keys.delete(e.code);
  if (e.code === 'ArrowLeft' && dasDir === -1) dasStop();
  if (e.code === 'ArrowRight' && dasDir === 1) dasStop();
  if (e.code === 'ArrowDown') softDropStop();
};
</script>

<style scoped>
.screen { display: none; position: relative; z-index: 10; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
.screen.active { display: flex; }

.logo { font-family: 'Press Start 2P', monospace; font-size: clamp(22px, 5vw, 44px); color: var(--acc); text-shadow: 0 0 20px rgba(0, 245, 255, .5), 0 0 60px rgba(0, 245, 255, .3); letter-spacing: 8px; margin-bottom: 6px; animation: pulse 2s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { text-shadow: 0 0 20px rgba(0, 245, 255, .5), 0 0 60px rgba(0, 245, 255, .3) } 50% { text-shadow: 0 0 40px rgba(0, 245, 255, .9), 0 0 80px rgba(0, 245, 255, .5) } }
.subtitle { font-size: 12px; color: var(--acc3); letter-spacing: 4px; margin-bottom: 36px; text-shadow: 0 0 20px rgba(170, 255, 0, .5) }

.card { background: var(--s0); border: 1px solid var(--border); border-radius: 4px; padding: 28px 32px; width: 100%; max-width: 420px; position: relative; }
.card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, var(--acc3), var(--acc)) }
.card-title { font-size: 12px; color: var(--acc3); letter-spacing: 3px; margin-bottom: 20px }

.input-group { margin-bottom: 16px }
.input-group label { display: block; font-size: 11px; color: var(--dim); letter-spacing: 2px; margin-bottom: 7px }
input[type="text"] { width: 100%; background: rgba(0, 245, 255, .03); border: 1px solid var(--border); border-radius: 2px; color: var(--tx); font-family: 'Orbitron', monospace; font-size: 13px; padding: 11px 14px; outline: none; transition: border-color .2s, box-shadow .2s }

.sprint-info { font-size: 10px; color: var(--dim); letter-spacing: 1px; margin-bottom: 16px; line-height: 1.8; padding: 10px; background: rgba(170,255,0,.04); border: 1px solid rgba(170,255,0,.15); border-radius: 2px; }

.btn { display: block; width: 100%; padding: 13px; border: none; border-radius: 2px; cursor: pointer; font-family: 'Orbitron', monospace; font-size: 12px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; transition: all .2s; margin-top: 8px; text-align: center; text-decoration: none; }
.btn-sprint { background: linear-gradient(135deg, var(--acc3), #44cc00); color: #000 }
.btn-sprint:hover { transform: translateY(-1px); box-shadow: 0 0 22px rgba(170, 255, 0, .5) }
.btn-rank { background: transparent; border: 1px solid var(--acc); color: var(--acc) }
.btn-back { background: transparent; border: 1px solid var(--dim); color: var(--dim) }

.pb-display { font-size: 9px; color: var(--dim); letter-spacing: 2px; margin-top: 18px }

/* GAME UI */
.game-header { width: 100%; max-width: 640px; display: flex; align-items: center; gap: 8px; margin-bottom: 10px }
.game-title { font-family: 'Press Start 2P', monospace; font-size: 10px; color: var(--acc3) }
.game-header-right { display: flex; gap: 8px; align-items: center; margin-left: auto }
.sound-btn { display: flex; align-items: center; gap: 4px; background: transparent; border: 1px solid var(--border); color: var(--dim); font-family: 'Orbitron', monospace; font-size: 8px; letter-spacing: 1px; padding: 5px 10px; border-radius: 2px; cursor: pointer; }
.sound-btn.on { border-color: var(--acc3); color: var(--acc3) }
.btn-quit { background: transparent; border: 1px solid var(--dim); color: var(--dim); font-family: 'Orbitron', monospace; font-size: 8px; letter-spacing: 1px; padding: 5px 10px; border-radius: 2px; cursor: pointer }

.game-layout { display: flex; gap: 10px; align-items: flex-start; justify-content: center }
canvas { display: block; image-rendering: pixelated; background: rgba(0,0,0,0.4); }
#myCanvas { border: 1px solid var(--acc3); box-shadow: 0 0 20px rgba(170, 255, 0, .35) }

.side-panel { display: flex; flex-direction: column; gap: 8px; min-width: 110px }
.panel-box { background: var(--s0); border: 1px solid var(--border); border-radius: 2px; padding: 10px }
.panel-box-title { font-size: 10px; color: var(--dim); letter-spacing: 2px; margin-bottom: 6px }
.score-value { font-family: 'Press Start 2P', monospace; font-size: 11px; color: var(--acc3); word-break: break-all; text-shadow: 0 0 10px rgba(170, 255, 0, .4) }
.level-value { font-family: 'Press Start 2P', monospace; font-size: 18px; color: var(--acc); text-shadow: 0 0 15px rgba(0, 245, 255, .4) }

.timer-box { background: rgba(170, 255, 0, .05); border: 1px solid rgba(170, 255, 0, .35); text-align: center }
.timer-label { font-size: 9px; color: rgba(170, 255, 0, .7); letter-spacing: 2px; margin-bottom: 4px }
.timer-value { font-family: 'Press Start 2P', monospace; font-size: 16px; color: var(--acc3); text-shadow: 0 0 14px rgba(170, 255, 0, .7); letter-spacing: 1px }

.progress-box { background: rgba(170, 255, 0, .04); border: 1px solid rgba(170, 255, 0, .25); }
.progress-label { font-size: 9px; color: rgba(170, 255, 0, .7); letter-spacing: 2px; margin-bottom: 6px; display: flex; justify-content: space-between }
.progress-bar-bg { background: rgba(255, 255, 255, .05); border-radius: 1px; height: 8px; overflow: hidden }
.progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--acc3), var(--acc)); transition: width .2s ease; border-radius: 1px; box-shadow: 0 0 8px rgba(170, 255, 0, .5) }

.board-wrap { position: relative }
.lock-flash { position: absolute; inset: 0; background: rgba(255, 255, 255, .06); pointer-events: none; opacity: 0; border-radius: 1px; transition: opacity .05s }
.lock-flash.show { opacity: 1 }
.action-popup { position: absolute; top: 30px; left: 50%; transform: translateX(-50%); font-family: 'Press Start 2P', monospace; font-size: 9px; color: var(--acc3); text-shadow: 0 0 10px rgba(170, 255, 0, .8); pointer-events: none; opacity: 0; white-space: nowrap; z-index: 5 }
.action-popup.show { opacity: 1; animation: popUp .8s ease-out forwards }
@keyframes popUp { 0% { opacity: 1; transform: translateX(-50%) translateY(0) } 100% { opacity: 0; transform: translateX(-50%) translateY(-30px) } }

.overlay { position: fixed; inset: 0; background: rgba(2, 4, 8, .94); display: none; align-items: center; justify-content: center; z-index: 50; flex-direction: column; gap: 14px }
.overlay.show { display: flex }
.overlay-title { font-family: 'Press Start 2P', monospace; font-size: clamp(16px, 3.5vw, 30px); text-align: center }
.overlay-title.clear { color: var(--acc3); text-shadow: 0 0 30px rgba(170, 255, 0, .7) }
.overlay-title.fail { color: var(--acc2); text-shadow: 0 0 30px rgba(255, 0, 128, .5) }

.result-time { font-family: 'Press Start 2P', monospace; font-size: clamp(22px, 4vw, 38px); color: var(--acc3); text-shadow: 0 0 30px rgba(170, 255, 0, .8); margin: 4px 0 }
.result-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 10px 0; max-width: 320px; width: 100% }
.rs-cell { text-align: center; background: rgba(255, 255, 255, .03); border: 1px solid var(--border); border-radius: 2px; padding: 8px }
.rs-cell-label { font-size: 9px; color: var(--dim); letter-spacing: 2px; margin-bottom: 4px }
.rs-cell-val { font-family: 'Press Start 2P', monospace; font-size: 13px; color: var(--acc3) }
.result-rank-badge { font-family: 'Press Start 2P', monospace; font-size: 11px; padding: 6px 14px; border-radius: 2px; margin-top: 2px; border: 1px solid; }
.result-rank-badge.gold { color: #ffd700; border-color: #ffd700; }
.result-rank-badge.silver { color: #c0c0c0; border-color: #c0c0c0; }
.result-rank-badge.bronze { color: #cd7f32; border-color: #cd7f32; }
.result-rank-badge.ranked { color: var(--acc); border-color: var(--acc); }

.pb-badge { font-family: 'Press Start 2P', monospace; font-size: 9px; color: #ffd700; border: 1px solid #ffd700; padding: 4px 10px; border-radius: 2px; margin-top: 4px; text-shadow: 0 0 8px rgba(255, 215, 0, .6) }
.result-btn-row { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; justify-content: center }
.result-btn { padding: 11px 22px; border: none; border-radius: 2px; cursor: pointer; font-family: 'Orbitron', monospace; font-size: 11px; font-weight: 700; letter-spacing: 2px; transition: all .2s }
.result-btn.retry { background: linear-gradient(135deg, var(--acc3), #44cc00); color: #000 }
.result-btn.rank { background: transparent; border: 1px solid var(--acc); color: var(--acc) }
.result-btn.menu { background: transparent; border: 1px solid var(--dim); color: var(--dim) }

.countdown-overlay { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; z-index: 40; pointer-events: none; background: rgba(2, 4, 8, .7) }
.countdown-overlay.show { display: flex }
.countdown-num { font-family: 'Press Start 2P', monospace; font-size: 90px; color: var(--acc3); text-shadow: 0 0 20px rgba(170, 255, 0, .5), 0 0 100px rgba(170, 255, 0, .3); animation: countAnim .85s ease-out forwards }
@keyframes countAnim { 0% { transform: scale(2); opacity: 1 } 100% { transform: scale(.4); opacity: 0 } }

/* Mobile Controls */
.mobile-controls { display: none; flex-direction: column; align-items: center; gap: 6px; margin-top: 10px }
.mobile-row { display: flex; gap: 6px }
.mobile-btn { width: 54px; height: 54px; background: var(--s0); border: 1px solid var(--border); border-radius: 4px; color: var(--tx); font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; user-select: none; -webkit-user-select: none; touch-action: manipulation; }
.mobile-btn:active { background: rgba(170, 255, 0, 0.15); border-color: var(--acc3); }
.hard-btn { width: 120px; font-size: 12px; }

/* RANKING */
.rank-screen { padding: 30px 20px; justify-content: flex-start !important; }
.rank-header { text-align: center; margin-bottom: 28px; width: 100%; max-width: 520px }
.rank-title { font-family: 'Press Start 2P', monospace; font-size: clamp(14px, 3vw, 22px); color: var(--acc3); letter-spacing: 4px; margin-bottom: 6px }
.rank-container { width:100%; max-width:520px; overflow-y: auto; flex: 1; }
.rank-table { width: 100%; border-collapse: collapse }
.rank-table th { font-size: 9px; color: var(--dim); letter-spacing: 2px; padding: 7px 10px; border-bottom: 1px solid var(--border); text-align: left }
.rank-table td { padding: 8px 10px; border-bottom: 1px solid rgba(26, 37, 64, .5); font-size: 12px; }
.my-row td { background: rgba(170, 255, 0, .06); color: var(--acc3) }
.rank-pos { font-family: 'Press Start 2P', monospace; font-size: 11px; }
.rank-pos.gold { color: #ffd700 }
.rank-pos.silver { color: #c0c0c0 }
.rank-pos.bronze { color: #cd7f32 }
.rank-time-cell { font-family: 'Press Start 2P', monospace; font-size: 11px; color: var(--acc3) }
.rank-loading, .rank-err { text-align: center; padding: 40px; color: var(--dim); }
.rank-actions { margin-top:20px; display:flex; gap:10px; flex-wrap:wrap; justify-content:center; width: 100%; }

@media(max-width:600px) {
  .side-panel { min-width: 80px }
  .timer-value { font-size: 13px }
  .mobile-controls { display: flex; }
}
</style>
