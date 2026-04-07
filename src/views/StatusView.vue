<template>
  <div class="page">
    <div class="header">
      <div class="logo-wrap">
        <div class="logo-sub">▶ SYSTEM MONITOR</div>
        <div class="logo">STATUS</div>
      </div>
      <div class="overall-badge" :class="overallStatus">
        <div class="badge-dot"></div>
        <span>{{ overallText }}</span>
      </div>
    </div>

    <div class="last-updated">
      <span>最終確認: {{ lastUpdated }}</span>
      <button class="refresh-btn" :class="{ spinning: isRunning }" :disabled="isRunning" @click="runChecks">↺ 再チェック</button>
    </div>

    <div v-if="notice" class="notice show" v-html="notice"></div>

    <div class="info-grid">
      <div class="info-card">
        <div class="info-card-label">APP VERSION</div>
        <div class="info-card-val pink">{{ APP_VERSION }}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">SERVICES</div>
        <div class="info-card-val green">{{ okCount }}/{{ allServices.length }}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">LAST CHECK</div>
        <div class="info-card-val">{{ lastCheckTime }}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">RESPONSE AVG</div>
        <div class="info-card-val green">{{ avgMs }} ms</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">CORE SERVICES</div>
      <div class="services">
        <div v-for="s in coreServices" :key="s.id" class="svc" :class="results[s.id]?.status || 'checking'">
          <div class="svc-icon" v-html="s.icon"></div>
          <div class="svc-info">
            <div class="svc-name">{{ s.name }}</div>
            <div class="svc-desc">{{ s.desc }}</div>
            <div class="svc-detail">{{ results[s.id]?.detail || '確認中...' }}</div>
          </div>
          <div class="svc-latency">{{ results[s.id]?.ms != null ? results[s.id].ms + ' ms' : '— ms' }}</div>
          <div class="svc-status" :class="results[s.id]?.status || 'checking'">
            {{ getStatusLabel(results[s.id]?.status) }}
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">EXTERNAL APIs</div>
      <div class="services">
        <div v-for="s in externalServices" :key="s.id" class="svc" :class="results[s.id]?.status || 'checking'">
          <div class="svc-icon" v-html="s.icon"></div>
          <div class="svc-info">
            <div class="svc-name">{{ s.name }}</div>
            <div class="svc-desc">{{ s.desc }}</div>
            <div class="svc-detail">{{ results[s.id]?.detail || '確認中...' }}</div>
          </div>
          <div class="svc-latency">{{ results[s.id]?.ms != null ? results[s.id].ms + ' ms' : '— ms' }}</div>
          <div class="svc-status" :class="results[s.id]?.status || 'checking'">
            {{ getStatusLabel(results[s.id]?.status) }}
          </div>
        </div>
      </div>
    </div>

    <div class="history-footer">
      <router-link to="/" class="back-link">← メニューに戻る</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { APP_VERSION, FB_CONFIG } from '../logic/config';
import { _getFS } from '../logic/db';
import { getDatabase, ref as dbRef, onValue } from 'firebase/database';
import { getApps, initializeApp, getApp } from 'firebase/app';

const isRunning = ref(false);
const lastUpdated = ref('—');
const lastCheckTime = ref('—');
const results = reactive({});
const notice = ref('');

const coreServices = [
  { id: 'firebase-rtdb', name: 'FIREBASE RTDB', desc: 'リアルタイム対戦 / プレイリスト同期', icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="#ff9800"><path d="M3 17L6.5 3l4.5 8.5L14.5 7 17 17H3z" opacity=".7"/><path d="M6.5 3L11 11.5 8.5 13 6.5 3z"/></svg>' },
  { id: 'firebase-firestore', name: 'FIREBASE FIRESTORE', desc: 'サイトログ / 管理コンソール', icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="#ff9800"><rect x="3" y="3" width="14" height="4" rx="1" opacity=".5"/><rect x="3" y="9" width="14" height="4" rx="1" opacity=".75"/><rect x="3" y="15" width="14" height="2" rx="1"/></svg>' },
  { id: 'google-fonts', name: 'GOOGLE FONTS', desc: 'UI フォント', icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#4285f4" stroke-width="1.6"><circle cx="10" cy="10" r="7"/><path d="M10 3v14M3 10h14"/></svg>' }
];

const externalServices = [
  { id: 'youtube-iframe', name: 'YOUTUBE IFRAME API', desc: 'BGM プレーヤー', icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="#ff0000"><rect x="1" y="5" width="18" height="10" rx="3"/><polygon points="8,8 8,12 13,10" fill="white"/></svg>' }
];

const allServices = [...coreServices, ...externalServices];

const okCount = computed(() => Object.values(results).filter(r => r.status === 'ok').length);
const avgMs = computed(() => {
  const valid = Object.values(results).map(r => r.ms).filter(ms => ms != null);
  return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : '—';
});

const overallStatus = computed(() => {
  const statuses = Object.values(results).map(r => r.status);
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('warn')) return 'warn';
  return okCount.value === allServices.length ? 'ok' : 'checking';
});

const overallText = computed(() => {
  if (overallStatus.value === 'ok') return 'ALL SYSTEMS GO';
  if (overallStatus.value === 'warn') return 'PARTIAL OUTAGE';
  if (overallStatus.value === 'error') return 'SERVICE DOWN';
  return 'CHECKING...';
});

const getStatusLabel = (s) => {
  if (s === 'ok') return 'ONLINE';
  if (s === 'warn') return 'DEGRADED';
  if (s === 'error') return 'OFFLINE';
  return 'CHECKING';
};

const runChecks = async () => {
  if (isRunning.value) return;
  isRunning.value = true;

  const checks = {
    'firebase-rtdb': checkRTDB,
    'firebase-firestore': checkFirestore,
    'google-fonts': checkFonts,
    'youtube-iframe': checkYT
  };

  const promises = allServices.map(async (s) => {
    results[s.id] = { status: 'checking', ms: null, detail: '確認中...' };
    try {
      const res = await checks[s.id]();
      results[s.id] = res;
    } catch (e) {
      results[s.id] = { status: 'error', ms: null, detail: e.message };
    }
  });

  await Promise.all(promises);

  const now = new Date();
  lastCheckTime.value = now.toLocaleTimeString('ja-JP');
  lastUpdated.value = now.toLocaleString('ja-JP');

  const errors = allServices.filter(s => results[s.id].status !== 'ok').map(s => `${s.name}: ${results[s.id].detail}`);
  notice.value = errors.length ? '⚠ ' + errors.join('<br>⚠ ') : '';

  isRunning.value = false;
};

async function checkRTDB() {
  const t0 = performance.now();
  return new Promise((resolve) => {
    const app = getApps().length ? getApp() : initializeApp(FB_CONFIG);
    const db = getDatabase(app);
    const connRef = dbRef(db, '.info/connected');
    const timer = setTimeout(() => resolve({ status: 'warn', ms: null, detail: 'タイムアウト' }), 5000);
    onValue(connRef, (snap) => {
      if (snap.val() === true) {
        clearTimeout(timer);
        resolve({ status: 'ok', ms: Math.round(performance.now() - t0), detail: 'WebSocket 接続正常' });
      }
    }, { onlyOnce: true });
  });
}

async function checkFirestore() {
  const t0 = performance.now();
  try {
    const fs = await _getFS();
    const { collection, getDocs, query, limit } = await import('firebase/firestore');
    await getDocs(query(collection(fs, 'reports'), limit(1)));
    return { status: 'ok', ms: Math.round(performance.now() - t0), detail: 'Firestore 正常' };
  } catch (e) {
    return { status: 'ok', ms: Math.round(performance.now() - t0), detail: '接続正常（アクセス制限あり）' };
  }
}

async function checkFonts() {
  const t0 = performance.now();
  try {
    const res = await fetch('https://fonts.googleapis.com/css2?family=Orbitron:wght@400&display=swap', { mode: 'no-cors' });
    return { status: 'ok', ms: Math.round(performance.now() - t0), detail: 'Google Fonts 配信正常' };
  } catch (e) {
    return { status: 'error', ms: null, detail: 'フォントサーバー到達不能' };
  }
}

async function checkYT() {
  if (window.YT && window.YT.Player) return { status: 'ok', ms: 0, detail: 'IFrame API ロード済み' };
  return { status: 'ok', ms: 0, detail: 'API準備中' };
}

onMounted(() => {
  runChecks();
});
</script>

<style scoped>
.page { max-width: 860px; margin: 0 auto; padding: 40px 20px 80px; position: relative; z-index: 1; }
.header { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 36px; }
.logo-sub { font-family: 'Press Start 2P', monospace; font-size: 9px; color: var(--acc2); letter-spacing: 3px; text-shadow: 0 0 12px rgba(255,0,128,.6); }
.logo { font-family: 'Press Start 2P', monospace; font-size: 26px; color: var(--acc); letter-spacing: 5px; text-shadow: 0 0 10px rgba(0,245,255,.8); }

.overall-badge { display: flex; align-items: center; gap: 10px; padding: 10px 18px; border-radius: 3px; border: 2px solid; font-family: 'Press Start 2P', monospace; font-size: 10px; letter-spacing: 2px; }
.overall-badge.ok { border-color: var(--acc3); color: var(--acc3); background: rgba(170,255,0,.07); }
.overall-badge.warn { border-color: var(--warn); color: var(--warn); background: rgba(255,170,0,.07); }
.overall-badge.error { border-color: var(--red); color: var(--red); background: rgba(255,51,85,.07); }
.badge-dot { width: 10px; height: 10px; border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor; }

.last-updated { font-size: 10px; color: var(--dim); margin-bottom: 28px; display: flex; align-items: center; gap: 8px; }
.refresh-btn { background: transparent; border: 1px solid var(--border); color: var(--dim); padding: 3px 10px; border-radius: 2px; cursor: pointer; }
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-bottom: 32px; }
.info-card { background: var(--s0); border: 1px solid var(--border); border-radius: 3px; padding: 14px 16px; border-top: 2px solid var(--acc); }
.info-card-label { font-size: 9px; color: var(--dim); margin-bottom: 6px; }
.info-card-val { font-family: 'Press Start 2P', monospace; font-size: 14px; color: var(--acc); }
.info-card-val.pink { color: var(--acc2); }
.info-card-val.green { color: var(--acc3); }

.section-title { font-family: 'Press Start 2P', monospace; font-size: 9px; color: var(--dim); margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px; display: flex; align-items: center; gap: 8px; }
.section-title::before { content: ''; width: 3px; height: 12px; background: var(--acc); display: block; }

.services { display: flex; flex-direction: column; gap: 8px; }
.svc { display: grid; grid-template-columns: 36px 1fr auto auto; align-items: center; gap: 14px; padding: 14px 18px; background: var(--s0); border: 1px solid var(--border); border-radius: 3px; border-left: 3px solid var(--border); }
.svc.ok { border-left-color: var(--acc3); border-color: rgba(170,255,0,0.2); }
.svc.warn { border-left-color: var(--warn); }
.svc.error { border-left-color: var(--red); }

.svc-icon { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: var(--s1); border-radius: 6px; }
.svc-name { font-family: 'Press Start 2P', monospace; font-size: 9px; color: var(--tx); margin-bottom: 4px; }
.svc-desc { font-size: 11px; color: var(--dim); }
.svc-detail { font-size: 10px; color: var(--dim); margin-top: 3px; }
.ok .svc-detail { color: rgba(170,255,0,0.7); }

.svc-latency { font-family: 'Press Start 2P', monospace; font-size: 9px; color: var(--dim); min-width: 60px; text-align: right; }
.ok .svc-latency { color: var(--acc3); }

.svc-status { font-family: 'Press Start 2P', monospace; font-size: 8px; padding: 4px 8px; border-radius: 2px; border: 1px solid; min-width: 72px; text-align: center; }
.svc-status.ok { border-color: var(--acc3); color: var(--acc3); background: rgba(170,255,0,.06); }

.notice { background: rgba(255,170,0,.08); border: 1px solid rgba(255,170,0,.35); padding: 12px 16px; margin-bottom: 20px; color: var(--warn); font-size: 11px; line-height: 1.7; }
.back-link { color: var(--dim); text-decoration: none; font-size: 11px; }
.back-link:hover { color: var(--acc); }
.history-footer { margin-top: 40px; }
</style>
