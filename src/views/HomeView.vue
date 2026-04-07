<template>
  <div class="container">
    <div class="pixel-deco">
      <div v-for="(row, i) in decoRows" :key="i" class="px-row">
        <div v-for="(c, j) in row" :key="j" :class="['px', c ? 'px-' + c : '']" :style="!c ? 'width:13px;height:13px' : ''"></div>
      </div>
    </div>
    <div class="logo">TETRIS BATTLE</div>
    <div class="subtitle">▶ ONLINE MODE ◀</div>

    <div class="menu-card">
      <div class="card-corner tl"></div>
      <div class="card-corner tr"></div>
      <div class="card-corner bl"></div>
      <div class="card-corner br"></div>

      <AuthWidget />

      <div class="menu">
        <router-link to="/sprint" class="menu-btn primary sprint-btn" @click="playSE('select')">
          <span class="btn-icon-wrap">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
              <path d="M2 10L6 2l2 4 2-2 1 6z" />
            </svg>スプリント 40LINES
          </span>
        </router-link>

        <router-link to="/battle" class="menu-btn primary bot-btn" @click="playSE('select')">
          <span class="btn-icon-wrap">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
              <rect x="2" y="4" width="9" height="7" rx="1" />
              <rect x="4" y="2" width="5" height="2" />
              <rect x="4" y="6" width="2" height="2" fill="black" opacity=".4" />
              <rect x="7" y="6" width="2" height="2" fill="black" opacity=".4" />
              <rect x="0" y="6" width="2" height="1.5" rx=".5" />
              <rect x="11" y="6" width="2" height="1.5" rx=".5" />
            </svg>ボット対戦
          </span>
        </router-link>

        <router-link to="/multi" class="menu-btn primary multi-btn" @click="playSE('select')">
          <span class="btn-icon-wrap">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
              <circle cx="4" cy="4" r="2.2" />
              <circle cx="9" cy="4" r="2.2" />
              <path d="M0 11c0-2.2 1.8-4 4-4h5c2.2 0 4 1.8 4 4H0z" />
            </svg>マルチ対戦（2〜4人）
          </span>
        </router-link>

        <router-link v-if="user" to="/profile" class="menu-btn secondary profile-btn" @click="playSE('click')">
          <span class="btn-icon-wrap">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
              <circle cx="6.5" cy="4" r="2.5"/>
              <path d="M1 12c0-3 2.5-5 5.5-5s5.5 2 5.5 5H1z"/>
            </svg>
            {{ profileName }} のプロフィール
          </span>
        </router-link>

        <router-link to="/how-to" class="menu-btn secondary" @click="playSE('click')">
          <span class="btn-icon-wrap">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="6.5" cy="6.5" r="5.5" />
              <path d="M6.5 4a1.5 1.5 0 0 1 1.5 1.5c0 1-1.5 1.5-1.5 2.5" />
              <circle cx="6.5" cy="10" r=".6" fill="currentColor" stroke="none" />
            </svg>あそびかた
          </span>
        </router-link>

        <router-link to="/updates" class="menu-btn secondary" @click="playSE('click')">
          <span class="btn-icon-wrap">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
              <rect x="1" y="2" width="11" height="1.5" rx=".5" />
              <rect x="1" y="5.5" width="11" height="1.5" rx=".5" />
              <rect x="1" y="9" width="7" height="1.5" rx=".5" />
            </svg>更新履歴
          </span>
        </router-link>
      </div>

      <div class="sound-toggle-wrap">
        <button class="se-toggle" @click="handleToggleSE">
          SE {{ seOn ? 'ON' : 'OFF' }}
        </button>
      </div>
    </div>

    <div class="footer">
      <span class="version">VER {{ APP_VERSION }}</span>
      <span>© 2026 TETRIS BATTLE ONLINE</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { APP_VERSION } from '../logic/config';
import { playSE, toggleSE, isSEOn } from '../logic/sound';
import { onAuthReady, getCachedProfile } from '../logic/auth';
import AuthWidget from '../components/AuthWidget.vue';

const decoRows = [
  ['I', 'I', 'I', 'I'],
  [null, 'T', 'T', 'T', null],
  [null, null, 'T', null, null]
];

const seOn = ref(isSEOn());
const user = ref(null);
const profile = ref(null);
let unsubAuth = null;

onMounted(() => {
  unsubAuth = onAuthReady((u) => {
    user.value = u;
    profile.value = getCachedProfile();
  });
});

onUnmounted(() => {
  if (unsubAuth) unsubAuth();
});

const profileName = computed(() => (profile.value?.displayName || user.value?.displayName || 'PLAYER').slice(0, 12));

const handleToggleSE = () => {
  seOn.value = toggleSE();
};
</script>

<style scoped>
.pixel-deco { display: flex; flex-direction: column; align-items: center; gap: 3px; margin-bottom: 14px; }
.px-row { display: flex; gap: 4px; }
.px { width: 13px; height: 13px; border-radius: 2px; animation: pxFloat 3s ease-in-out infinite; }
.px:nth-child(odd) { animation-delay: .15s; }
.px:nth-child(even) { animation-delay: .3s; }
@keyframes pxFloat { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
.px-I { background: #00f5ff; box-shadow: 0 0 6px #00f5ff; }
.px-O { background: #ffff00; box-shadow: 0 0 6px #ffff00; }
.px-T { background: #cc00ff; box-shadow: 0 0 6px #cc00ff; }
.px-S { background: #aaff00; box-shadow: 0 0 6px #aaff00; }
.px-Z { background: #ff0040; box-shadow: 0 0 6px #ff0040; }
.px-J { background: #0066ff; box-shadow: 0 0 6px #0066ff; }
.px-L { background: #ff8800; box-shadow: 0 0 6px #ff8800; }

.logo { font-family: 'Press Start 2P', monospace; font-size: clamp(22px, 5vw, 44px); color: var(--acc); text-shadow: 0 0 10px rgba(0, 245, 255, .9), 0 0 30px rgba(0, 245, 255, .5), 0 0 80px rgba(0, 245, 255, .3), 3px 3px 0 rgba(0, 60, 100, .9); letter-spacing: 6px; margin-bottom: 10px; animation: logoFlicker 5s ease-in-out infinite; }
@keyframes logoFlicker { 0%, 94%, 100% { opacity: 1 } 95% { opacity: .82 } 97% { opacity: 1 } 98% { opacity: .9 } }

.subtitle { font-family: 'Press Start 2P', monospace; font-size: clamp(8px, 1.5vw, 10px); color: var(--acc2); letter-spacing: 3px; margin-bottom: 40px; text-shadow: 0 0 15px rgba(255, 0, 128, .7); animation: subPulse 2.5s ease-in-out infinite; }
@keyframes subPulse { 0%, 100% { opacity: .7 } 50% { opacity: 1; text-shadow: 0 0 25px rgba(255, 0, 128, 1), 0 0 50px rgba(255, 0, 128, .4) } }

.menu-card { background: rgba(4, 6, 15, 0.88); border: 2px solid rgba(0, 245, 255, 0.22); border-radius: 2px; padding: 32px 36px; width: 100%; max-width: 320px; position: relative; overflow: hidden; backdrop-filter: blur(12px); }
.menu-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #cc00ff, #0066ff, #00f5ff, #aaff00, #ff8800, #ff0040, #cc00ff); background-size: 300% 100%; animation: rainbowShift 3s linear infinite; }
@keyframes rainbowShift { 0% { background-position: 0% 0 } 100% { background-position: 300% 0 } }

.card-corner { position: absolute; width: 10px; height: 10px; background: var(--acc); box-shadow: 0 0 8px var(--acc); }
.card-corner.tl { top: 4px; left: 0; }
.card-corner.tr { top: 4px; right: 0; }
.card-corner.bl { bottom: 0; left: 0; }
.card-corner.br { bottom: 0; right: 0; }

.menu { display: flex; flex-direction: column; gap: 14px; width: 100%; }
.menu-btn { display: block; width: 100%; padding: 15px 20px; font-family: 'Press Start 2P', monospace; font-size: 10px; letter-spacing: 2px; text-decoration: none; text-align: center; border: none; cursor: pointer; transition: all .12s; position: relative; overflow: hidden; border-radius: 2px; }
.btn-icon-wrap { display: flex; align-items: center; justify-content: center; gap: 8px; }

.menu-btn.primary { background: var(--acc); color: #000; box-shadow: 0 5px 0 rgba(0, 80, 100, .9), inset 0 1px 0 rgba(255, 255, 255, .4); }
.menu-btn.primary:hover { transform: translateY(-3px); box-shadow: 0 8px 0 rgba(0, 80, 100, .9), 0 0 35px rgba(0, 245, 255, .7), inset 0 1px 0 rgba(255, 255, 255, .4); }
.menu-btn.primary:active { transform: translateY(3px); box-shadow: 0 2px 0 rgba(0, 80, 100, .9); }

.sprint-btn { background: linear-gradient(135deg, #44aa00, #aaff00) !important; box-shadow: 0 5px 0 rgba(20, 60, 0, .9) !important; }
.bot-btn { background: linear-gradient(135deg, #7700ff, #cc00ff) !important; color: #fff !important; box-shadow: 0 5px 0 rgba(40, 0, 80, .9) !important; }
.multi-btn { background: linear-gradient(135deg, #cc00ff, #ff0080) !important; color: #fff !important; box-shadow: 0 5px 0 rgba(80, 0, 60, .9) !important; }

.menu-btn.secondary { background: rgba(255, 0, 128, 0.05); color: var(--acc2); border: 2px solid var(--acc2); box-shadow: 0 5px 0 rgba(100, 0, 50, .9); }
.menu-btn.secondary:hover { background: rgba(255, 0, 128, .1); transform: translateY(-3px); box-shadow: 0 8px 0 rgba(100, 0, 50, .9), 0 0 25px rgba(255, 0, 128, .6); }
.profile-btn { background: rgba(0, 245, 255, 0.05) !important; color: var(--acc) !important; border-color: var(--acc) !important; }

.sound-toggle-wrap { margin-top: 18px; display: flex; align-items: center; justify-content: center; }
.se-toggle { background: rgba(0, 245, 255, 0.08); border: 1px solid rgba(0, 245, 255, 0.3); color: var(--acc); font-family: 'Press Start 2P', monospace; font-size: 8px; padding: 7px 14px; border-radius: 2px; cursor: pointer; letter-spacing: 1px; transition: all .2s; }

.footer { margin-top: 22px; font-size: 9px; color: var(--dim); letter-spacing: 2px; position: relative; z-index: 10; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.version { color: var(--acc2); font-weight: bold; }
</style>
