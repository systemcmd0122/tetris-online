<template>
  <div class="screen active">
    <!-- LOBBY -->
    <div v-if="gameState === 'lobby'" class="lobby-content">
      <div class="logo">TETRIS</div>
      <div class="subtitle">BATTLE — VS BOT</div>
      <div class="card">
        <div class="px-corner tl"></div><div class="px-corner tr"></div><div class="px-corner bl"></div><div class="px-corner br"></div>
        <AuthWidget />
        <div class="card-title">▶ PLAYER SETUP</div>
        <div class="input-group">
          <label>PLAYER NAME</label>
          <input type="text" v-model="playerName" :disabled="!!user" :style="user ? 'opacity:0.6;cursor:not-allowed' : ''" maxlength="12">
        </div>
        <button class="btn btn-bot" @click="showDifficulty = !showDifficulty">
           <span class="btn-inner">
             <svg width="14" height="14" viewBox="0 0 13 13" fill="currentColor">
               <rect x="2" y="4" width="9" height="7" rx="1" /><rect x="4" y="2" width="5" height="2" /><rect x="4" y="6" width="2" height="2" fill="black" opacity=".4" /><rect x="7" y="6" width="2" height="2" fill="black" opacity=".4" /><rect x="0" y="6" width="2" height="1.5" rx=".5" /><rect x="11" y="6" width="2" height="1.5" rx=".5" />
             </svg>
             VS BOT（ボット対戦）
           </span>
        </button>
        <div v-if="showDifficulty" class="bot-difficulty">
          <div class="bot-difficulty-label">DIFFICULTY</div>
          <div class="diff-btns">
            <button class="diff-btn diff-easy" @click="startCountdown(1)">EASY</button>
            <button class="diff-btn diff-normal" @click="startCountdown(2)">NORMAL</button>
            <button class="diff-btn diff-hard" @click="startCountdown(3)">HARD</button>
          </div>
        </div>
        <router-link to="/how-to" class="btn btn-secondary">あそびかた</router-link>
        <router-link to="/" class="btn btn-back">◀ MENU</router-link>
      </div>
    </div>

    <!-- GAME -->
    <div v-if="gameState === 'playing' || gameState === 'countdown'" class="game-screen-content">
       <div class="game-header">
         <span class="game-title">TETRIS BATTLE — BOT</span>
         <div class="game-header-right">
           <button class="sound-btn" :class="{ on: seOn }" @click="handleToggleSE">SE {{ seOn ? 'ON' : 'OFF' }}</button>
           <button class="btn-quit" @click="quitGame">QUIT</button>
         </div>
       </div>
       <div class="game-layout">
         <!-- PLAYER SECTION -->
         <div class="player-section">
           <div class="player-label you">YOU</div>
           <div class="player-name-tag">{{ playerName }}</div>
           <div class="board-with-garb">
             <div class="garbage-bar">
               <div v-for="i in Math.min(myPendGarb, 20)" :key="i" class="garb-cell" :class="{ warn: myPendGarb >= 10 }"></div>
             </div>
             <div class="board-wrap" :class="{ shake: myBoardShaking }">
               <canvas ref="myCanvas" width="200" height="400"></canvas>
               <div class="lock-flash" :class="{ show: showMyLockFlash }"></div>
               <div class="action-popup" :class="{ show: showPopup }">{{ popupText }}</div>
               <div class="attack-count-badge" :class="{ show: showAttackBadge }">+{{ attackValue }} !</div>
             </div>
           </div>
         </div>

         <!-- CENTER COL -->
         <div class="center-col">
           <div class="vs-text">VS</div>
           <div class="side-panel">
             <div class="panel-box"><div class="panel-box-title">HOLD</div><canvas ref="holdCanvas" width="80" height="80"></canvas></div>
             <div class="panel-box"><div class="panel-box-title">NEXT</div><canvas ref="nextCanvas" width="80" height="80"></canvas></div>
             <div class="panel-box"><div class="panel-box-title">SCORE</div><div class="score-value">{{ score }}</div></div>
             <div class="panel-box">
                <div class="lv-ln-row">
                  <div><div class="panel-box-title">LEVEL</div><div class="level-value">{{ level }}</div></div>
                  <div style="text-align:right;"><div class="panel-box-title">LINES</div><div class="lines-value">{{ lines }}</div></div>
                </div>
             </div>
             <div class="panel-box combo-box">
               <div class="panel-box-title">COMBO</div>
               <div class="combo-value" :class="{ pop: combo > 1 }">{{ combo > 1 ? combo : 0 }}</div>
               <div class="combo-label-inline">× COMBO</div>
               <div class="b2b-badge" :class="b2b ? 'on' : 'off'">BACK-TO-BACK</div>
             </div>
           </div>
         </div>

         <!-- BOT SECTION -->
         <div class="player-section">
           <div class="player-label bot">BOT</div>
           <div class="player-name-tag">{{ botName }} ({{ botScore }})</div>
           <canvas ref="botCanvas" width="200" height="400"></canvas>
         </div>
       </div>
    </div>

    <!-- RESULT -->
    <div v-if="gameState === 'result'" class="overlay show">
      <div class="overlay-title" :class="resultTitle.toLowerCase()">{{ resultTitle }}</div>
      <div class="result-stats-grid">
        <div class="rs-cell"><div class="rs-cell-label">SCORE</div><div class="rs-cell-val">{{ score }}</div></div>
        <div class="rs-cell"><div class="rs-cell-label">LEVEL</div><div class="rs-cell-val">{{ level }}</div></div>
        <div class="rs-cell"><div class="rs-cell-label">LINES</div><div class="rs-cell-val">{{ lines }}</div></div>
        <div class="rs-cell"><div class="rs-cell-label">ATK SENT</div><div class="rs-cell-val">{{ atkSent }}</div></div>
      </div>
      <button class="btn btn-primary" style="width:220px;margin-top:10px;" @click="goLobby">BACK TO LOBBY</button>
    </div>

    <!-- COUNTDOWN -->
    <div v-if="gameState === 'countdown'" class="countdown-overlay show">
      <div class="countdown-num" :key="countdownVal">{{ countdownVal === 0 ? 'GO!' : countdownVal }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { TetrisGame, BotController } from '../logic/tetris';
import { playSE, toggleSE, isSEOn } from '../logic/sound';
import { onAuthReady, getCachedProfile } from '../logic/auth';
import AuthWidget from '../components/AuthWidget.vue';

const gameState = ref('lobby'); // lobby, countdown, playing, result
const showDifficulty = ref(false);
const playerName = ref(localStorage.getItem('battle_playerName') || 'PLAYER');
const botName = ref('');
const botScore = ref(0);
const user = ref(null);
const seOn = ref(isSEOn());

const score = ref(0);
const level = ref(1);
const lines = ref(0);
const combo = ref(0);
const b2b = ref(false);
const myPendGarb = ref(0);
const atkSent = ref(0);
const resultTitle = ref('');

const countdownVal = ref(3);
const showPopup = ref(false);
const popupText = ref('');
const showAttackBadge = ref(false);
const attackValue = ref(0);
const myBoardShaking = ref(false);
const showMyLockFlash = ref(false);

const myCanvas = ref(null);
const botCanvas = ref(null);
const holdCanvas = ref(null);
const nextCanvas = ref(null);

let game = null;
let botGame = null;
let botCtrl = null;
let animId = null;
let unsubAuth = null;
let selectedDiff = 2;

onMounted(() => {
  unsubAuth = onAuthReady((u) => {
    user.value = u;
    if (u) {
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
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
});

const handleToggleSE = () => { seOn.value = toggleSE(); };
const goLobby = () => { gameState.value = 'lobby'; stopGame(); };
const quitGame = () => { if (confirm('終了しますか？')) goLobby(); };

const startCountdown = (diff) => {
  selectedDiff = diff;
  const botNames = ['BOT-EASY', 'BOT-NORMAL', 'BOT-HARD'];
  botName.value = botNames[diff - 1];
  showDifficulty.value = false;
  gameState.value = 'countdown';
  countdownVal.value = 3;
  const tick = () => {
    if (countdownVal.value > 0) {
      playSE('countdown');
      setTimeout(() => { countdownVal.value--; tick(); }, 1000);
    } else {
      playSE('go');
      setTimeout(startGame, 800);
    }
  };
  tick();
};

const startGame = async () => {
  gameState.value = 'playing';
  score.value = 0; level.value = 1; lines.value = 0; combo.value = 0; b2b.value = false;
  myPendGarb.value = 0; atkSent.value = 0; botScore.value = 0;

  await nextTick();
  game = new TetrisGame(myCanvas.value, holdCanvas.value, nextCanvas.value);
  botGame = new TetrisGame(botCanvas.value, null, null);
  botCtrl = new BotController(botGame, selectedDiff);

  const loop = (ts) => {
    if (gameState.value !== 'playing') return;

    game.update(ts);
    game.draw();
    botCtrl.tick(ts);
    botGame.update(ts);

    // Draw Bot with simplified view
    const bd = {
      board: botGame.board.slice(2).map(r => r.map(c => c || '')),
      cur: { name: botGame.current.name, rot: botGame.current.rot, x: botGame.current.x, y: botGame.current.y },
      gameOver: botGame.over
    };
    TetrisGame.drawOpp(botCanvas.value, bd, 200, 400);
    botScore.value = botGame.score;

    // Process results
    while (game.results.length > 0) {
      const res = game.results.shift();
      if (res.garbageOut > 0) { atkSent.value += res.garbageOut; botGame.pendGarb += res.garbageOut; }
      if (res.actionLabel) triggerPopup(res.actionLabel);
    }
    while (botGame.results.length > 0) {
      const res = botGame.results.shift();
      if (res.garbageOut > 0) {
        game.pendGarb += res.garbageOut;
        triggerAttackFlash(res.garbageOut);
      }
    }

    // Sync UI
    myPendGarb.value = game.pendGarb;
    score.value = game.score; level.value = game.level; lines.value = game.lines;
    combo.value = game.combo; b2b.value = game.b2b;

    if (game.over && botGame.over) { endBattle('DRAW'); return; }
    if (game.over) { endBattle('LOSE'); return; }
    if (botGame.over) { endBattle('WIN'); return; }

    animId = requestAnimationFrame(loop);
  };
  animId = requestAnimationFrame(loop);
};

const stopGame = () => { if (animId) cancelAnimationFrame(animId); game = null; botGame = null; };

const endBattle = (res) => {
  resultTitle.value = res === 'WIN' ? 'YOU WIN!' : (res === 'LOSE' ? 'YOU LOSE' : 'DRAW');
  gameState.value = 'result';
  if (res === 'WIN') playSE('win');
  stopGame();
};

const triggerPopup = (txt) => {
  popupText.value = txt.replace('\n', ' / ');
  showPopup.value = true;
  setTimeout(() => showPopup.value = false, 900);
};

const triggerAttackFlash = (n) => {
  attackValue.value = n;
  showAttackBadge.value = true;
  myBoardShaking.value = true;
  playSE('attack');
  setTimeout(() => { showAttackBadge.value = false; myBoardShaking.value = false; }, 1200);
};

// Input handling
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
.screen { display: flex; position: relative; z-index: 10; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
.logo { font-family: 'Press Start 2P', monospace; font-size: clamp(22px, 5vw, 46px); color: var(--acc); text-shadow: 0 0 20px rgba(0, 245, 255, .5), 0 0 60px rgba(0, 245, 255, .3); letter-spacing: 8px; margin-bottom: 6px; animation: pulse 2s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { text-shadow: 0 0 20px rgba(0, 245, 255, .5), 0 0 60px rgba(0, 245, 255, .3) } 50% { text-shadow: 0 0 40px rgba(0, 245, 255, .9), 0 0 80px rgba(0, 245, 255, .5) } }
.subtitle { font-size: 12px; color: var(--acc2); letter-spacing: 4px; margin-bottom: 44px; text-shadow: 0 0 20px rgba(255, 0, 128, .5) }

.card { background: #0a0f1a; border: 1px solid #1a2540; border-radius: 4px; padding: 32px; width: 100%; max-width: 400px; position: relative; }
.card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, var(--acc), var(--acc2)) }
.card-title { font-size: 12px; color: var(--acc); letter-spacing: 3px; margin-bottom: 22px }

.input-group { margin-bottom: 18px }
.input-group label { display: block; font-size: 11px; color: var(--dim); letter-spacing: 2px; margin-bottom: 7px }
input[type="text"] { width: 100%; background: rgba(0, 245, 255, .03); border: 1px solid #1a2540; border-radius: 2px; color: var(--tx); font-family: 'Orbitron', monospace; font-size: 13px; padding: 11px 14px; outline: none; transition: border-color .2s, box-shadow .2s }

.btn { display: block; width: 100%; padding: 13px; border: none; border-radius: 2px; cursor: pointer; font-family: 'Orbitron', monospace; font-size: 12px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; transition: all .2s; margin-top: 10px; text-align: center; text-decoration: none; }
.btn-bot { background: linear-gradient(135deg, #7700ff, #cc00ff); color: #fff }
.btn-secondary { background: transparent; border: 1px solid var(--acc2); color: var(--acc2); }
.btn-back { background: transparent; border: 1px solid var(--dim); color: var(--dim) }
.btn-inner { display:flex; align-items:center; justify-content:center; gap:8px; }

.bot-difficulty { margin-top: 16px; padding: 16px; background: rgba(204, 0, 255, .04); border: 1px solid rgba(204, 0, 255, .25); border-radius: 3px; }
.bot-difficulty-label { font-size: 11px; color: rgba(204, 0, 255, .9); letter-spacing: 3px; margin-bottom: 12px }
.diff-btns { display: flex; gap: 8px }
.diff-btn { flex: 1; padding: 12px 6px; border: 1px solid; border-radius: 2px; cursor: pointer; font-family: 'Orbitron', monospace; font-size: 10px; font-weight: 700; letter-spacing: 2px; transition: all .15s }
.diff-easy { border-color: var(--acc3); color: var(--acc3); background: rgba(170, 255, 0, .04) }
.diff-normal { border-color: #ffaa00; color: #ffaa00; background: rgba(255, 170, 0, .04) }
.diff-hard { border-color: #ff3355; color: #ff3355; background: rgba(255, 51, 85, .04) }

/* GAME UI */
.game-header { width: 100%; max-width: 720px; display: flex; align-items: center; gap: 8px; margin-bottom: 10px }
.game-title { font-family: 'Press Start 2P', monospace; font-size: 11px; color: var(--acc); text-shadow: 0 0 20px rgba(0, 245, 255, .5) }
.game-header-right { display: flex; gap: 8px; align-items: center; margin-left: auto }
.sound-btn { display: flex; align-items: center; gap: 4px; background: transparent; border: 1px solid #1a2540; color: var(--dim); font-family: 'Orbitron', monospace; font-size: 8px; letter-spacing: 1px; padding: 5px 10px; border-radius: 2px; cursor: pointer; }
.sound-btn.on { border-color: var(--acc3); color: var(--acc3) }
.btn-quit { background: transparent; border: 1px solid var(--acc2); color: var(--acc2); font-family: 'Orbitron', monospace; font-size: 8px; letter-spacing: 1px; padding: 5px 10px; border-radius: 2px; cursor: pointer }

.game-layout { display: flex; gap: 10px; align-items: flex-start }
.player-section { display: flex; flex-direction: column; align-items: center; gap: 6px }
.player-label { font-size: 11px; letter-spacing: 3px; padding: 3px 12px; border-radius: 2px }
.player-label.you { background: rgba(0, 245, 255, .1); border: 1px solid var(--acc); color: var(--acc) }
.player-label.bot { background: rgba(204, 0, 255, .1); border: 1px solid #cc00ff; color: #cc00ff }
.player-name-tag { font-size: 11px; color: var(--dim); letter-spacing: 1px }

canvas { display: block; image-rendering: pixelated; background: rgba(0,0,0,0.4); }
#myCanvas { border: 1px solid var(--acc); box-shadow: 0 0 20px rgba(0, 245, 255, .4) }
#botCanvas { border: 1px solid #cc00ff; box-shadow: 0 0 20px rgba(204, 0, 255, .4); opacity: .85 }

.center-col { display: flex; flex-direction: column; align-items: center; gap: 8px; align-self: center }
.vs-text { font-family: 'Press Start 2P', monospace; font-size: 16px; background: linear-gradient(180deg, var(--acc), var(--acc2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 10px rgba(0, 245, 255, .5)) }

.side-panel { display: flex; flex-direction: column; gap: 8px; min-width: 100px }
.panel-box { background: #0a0f1a; border: 1px solid #1a2540; border-radius: 2px; padding: 10px }
.panel-box-title { font-size: 11px; color: var(--dim); letter-spacing: 2px; margin-bottom: 7px }
.score-value { font-family: 'Press Start 2P', monospace; font-size: 12px; color: var(--acc3); word-break: break-all }
.level-value { font-family: 'Press Start 2P', monospace; font-size: 20px; color: var(--acc) }
.lines-value { font-family: 'Press Start 2P', monospace; font-size: 14px; color: var(--tx) }
.lv-ln-row { display:flex; justify-content:space-between; align-items:center; gap:8px; }

.combo-box { border-color: rgba(170, 255, 0, .35); background: rgba(170, 255, 0, .04) }
.combo-value { font-family: 'Press Start 2P', monospace; font-size: 22px; color: var(--acc3); text-shadow: 0 0 20px rgba(170, 255, 0, .8); line-height: 1.1 }
.combo-value.pop { animation: comboPop .3s ease-out }
@keyframes comboPop { 0% { transform: scale(1.8); color: #fff } 100% { transform: scale(1) } }
.combo-label-inline { font-size: 9px; color: rgba(170, 255, 0, .6); letter-spacing: 2px; margin-top: 2px }
.b2b-badge { display: inline-block; font-size: 8px; letter-spacing: 1px; padding: 3px 6px; border-radius: 2px; border: 1px solid; margin-top: 4px; }
.b2b-badge.off { border-color: #1a2540; color: var(--dim) }
.b2b-badge.on { border-color: #ff8800; color: #ff8800; background: rgba(255, 136, 0, .1); animation: b2bGlow 1s ease-in-out infinite alternate }
@keyframes b2bGlow { 0% { box-shadow: 0 0 4px rgba(255, 136, 0, .3) } 100% { box-shadow: 0 0 14px rgba(255, 136, 0, .7) } }

.board-with-garb { display: flex; gap: 3px; align-items: flex-end }
.garbage-bar { width: 10px; height: 400px; display: flex; flex-direction: column-reverse; gap: 1px; padding: 1px 0 }
.garb-cell { width: 10px; height: 18px; border-radius: 1px; background: rgba(255, 51, 85, .85); box-shadow: 0 0 4px rgba(255, 51, 85, .6); flex-shrink: 0 }
.garb-cell.warn { background: rgba(255, 170, 0, .9); animation: garbWarn .4s ease-in-out infinite alternate }
@keyframes garbWarn { 0% { opacity: .7 } 100% { opacity: 1; transform: scaleX(1.2) } }

.board-wrap { position: relative }
.lock-flash { position: absolute; inset: 0; background: rgba(255, 255, 255, .06); pointer-events: none; opacity: 0; border-radius: 1px; transition: opacity .05s }
.lock-flash.show { opacity: 1 }
.action-popup { position: absolute; top: 30px; left: 50%; transform: translateX(-50%); font-family: 'Press Start 2P', monospace; font-size: 9px; color: var(--acc3); text-shadow: 0 0 10px rgba(170, 255, 0, .8); pointer-events: none; opacity: 0; white-space: nowrap; z-index: 5 }
.action-popup.show { opacity: 1; animation: popUp .8s ease-out forwards }
@keyframes popUp { 0% { opacity: 1; transform: translateX(-50%) translateY(0) } 100% { opacity: 0; transform: translateX(-50%) translateY(-30px) } }

.attack-count-badge { position: absolute; top: 4px; left: 4px; background: rgba(255, 51, 85, .9); color: #fff; font-family: 'Press Start 2P', monospace; font-size: 7px; padding: 3px 5px; border-radius: 2px; opacity: 0; z-index: 6; pointer-events: none }
.attack-count-badge.show { opacity: 1; animation: badgePop .3s ease-out }
@keyframes badgePop { 0% { transform: scale(1.8) } 100% { transform: scale(1) } }

@keyframes boardShake { 0%, 100% { transform: translateX(0) } 20% { transform: translateX(-4px) } 40% { transform: translateX(4px) } 60% { transform: translateX(-3px) } 80% { transform: translateX(3px) } }
.board-wrap.shake { animation: boardShake .25s ease-out }

.overlay { position: fixed; inset: 0; background: rgba(2, 4, 8, .93); display: none; align-items: center; justify-content: center; z-index: 50; flex-direction: column; gap: 14px }
.overlay.show { display: flex }
.overlay-title { font-family: 'Press Start 2P', monospace; font-size: clamp(18px, 4vw, 34px); text-align: center }
.overlay-title.win { color: var(--acc3); text-shadow: 0 0 30px rgba(170, 255, 0, .6) }
.overlay-title.lose { color: var(--acc2); text-shadow: 0 0 30px rgba(255, 0, 128, .5) }
.overlay-title.draw { color: var(--acc); text-shadow: 0 0 20px rgba(0, 245, 255, .5) }

.result-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 10px 0; max-width: 320px }
.rs-cell { text-align: center; background: rgba(255, 255, 255, .03); border: 1px solid #1a2540; border-radius: 2px; padding: 8px }
.rs-cell-label { font-size: 9px; color: var(--dim); letter-spacing: 2px; margin-bottom: 4px }
.rs-cell-val { font-family: 'Press Start 2P', monospace; font-size: 14px; color: var(--acc3) }

.countdown-overlay { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; z-index: 40; pointer-events: none; background: rgba(2, 4, 8, .6) }
.countdown-overlay.show { display: flex }
.countdown-num { font-family: 'Press Start 2P', monospace; font-size: 90px; color: var(--acc); text-shadow: 0 0 20px rgba(0, 245, 255, .5), 0 0 100px rgba(0, 245, 255, .3); animation: countAnim .85s ease-out forwards }
@keyframes countAnim { 0% { transform: scale(2); opacity: 1 } 100% { transform: scale(.4); opacity: 0 } }
</style>
