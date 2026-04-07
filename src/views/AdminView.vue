<template>
  <div v-if="!isLoggedIn" id="loginWrap">
    <div class="login-logo">⬡ TETRIS BATTLE</div>
    <div class="login-tagline">ADMINISTRATOR CONSOLE</div>
    <div class="login-card">
      <div class="lc-title">🔒 認証が必要です</div>
      <div class="pw-wrap">
        <label class="pw-label">ADMIN PASSWORD</label>
        <input type="password" v-model="password" class="pw-input" placeholder="••••••••" @keydown.enter="doLogin">
      </div>
      <button class="pw-btn" @click="doLogin">→ ログイン</button>
      <div class="pw-err">{{ loginError }}</div>
    </div>
  </div>

  <div v-else id="shell" class="active">
    <div class="topbar">
      <div style="display:flex;align-items:center;gap:15px">
        <div class="topbar-logo">⬡ ADMIN CONSOLE</div>
        <div id="versionDisp">VER {{ APP_VERSION }}</div>
      </div>
      <div class="topbar-right">
        <span class="badge-online">● CONNECTED</span>
        <div class="clock">{{ currentTime }}</div>
        <button class="topbar-btn" @click="doLogout">LOGOUT</button>
      </div>
    </div>

    <div class="shell-body">
      <nav class="sidebar">
        <div class="sb-section">MONITOR</div>
        <div class="nav-item" :class="{ active: currentPanel === 'dashboard' }" @click="currentPanel = 'dashboard'">
          <span class="nav-icon">📊</span><span>Dashboard</span>
          <span class="nav-badge">{{ activeRoomCount }}</span>
        </div>
        <div class="nav-item" :class="{ active: currentPanel === 'rooms' }" @click="currentPanel = 'rooms'">
          <span class="nav-icon">🎮</span><span>Room List</span>
        </div>
        <div class="nav-item" :class="{ active: currentPanel === 'spectate' }" @click="currentPanel = 'spectate'">
          <span class="nav-icon">👁</span><span>Spectate</span>
        </div>
        <div class="sb-section">TOOLS</div>
        <div class="nav-item" :class="{ active: currentPanel === 'broadcast' }" @click="currentPanel = 'broadcast'">
          <span class="nav-icon">📢</span><span>Broadcast</span>
        </div>
        <div class="nav-item" :class="{ active: currentPanel === 'log' }" @click="currentPanel = 'log'">
          <span class="nav-icon">📋</span><span>Event Log</span>
        </div>
        <div class="nav-item" :class="{ active: currentPanel === 'feedback' }" @click="currentPanel = 'feedback'">
          <span class="nav-icon">📝</span><span>Feedback</span>
          <span v-if="newFeedbackCount > 0" class="nav-badge">{{ newFeedbackCount }}</span>
        </div>
        <div class="nav-item" :class="{ active: currentPanel === 'settings' }" @click="currentPanel = 'settings'">
          <span class="nav-icon">⚙</span><span>Settings</span>
        </div>
      </nav>

      <div class="main">
        <!-- Dashboard -->
        <div v-if="currentPanel === 'dashboard'" class="panel active">
          <div class="ph">
            <div class="ph-left">
              <div class="ph-title">DASHBOARD</div>
              <div class="ph-sub">リアルタイム統計 — 自動更新中</div>
            </div>
            <button class="sbtn" @click="refreshData">↻ 更新</button>
          </div>
          <div class="stats-grid">
            <div class="sc c1"><div class="sc-label">ACTIVE BATTLES</div><div class="sc-val c1">{{ stats.active }}</div></div>
            <div class="sc c2"><div class="sc-label">WAITING ROOMS</div><div class="sc-val c2">{{ stats.waiting }}</div></div>
            <div class="sc c3"><div class="sc-label">ONLINE PLAYERS</div><div class="sc-val c3">{{ stats.players }}</div></div>
            <div class="sc c4"><div class="sc-label">TOTAL ROOMS</div><div class="sc-val c4">{{ Object.keys(rooms).length }}</div></div>
          </div>
          <div class="tbl-wrap">
             <div class="tbl-head">
               <div class="tbl-head-title"><div class="live-dot"></div>LIVE ROOMS</div>
             </div>
             <table>
               <thead><tr><th>CODE</th><th>STATUS</th><th>P1</th><th>P2</th><th>CREATED</th><th>ACTIONS</th></tr></thead>
               <tbody>
                 <tr v-for="(r, code) in activeRooms" :key="code">
                   <td class="code-td">{{ code }}</td>
                   <td><span class="badge" :class="statusClass(r.status)">{{ r.status.toUpperCase() }}</span></td>
                   <td>{{ r.p1?.name || '—' }}</td>
                   <td>{{ r.p2?.name || '—' }}</td>
                   <td class="dim-txt">{{ formatTime(r.ts) }}</td>
                   <td>
                     <button v-if="r.status === 'ready'" class="abtn abtn-watch" @click="startSpectating(code)">👁 観戦</button>
                     <button class="abtn abtn-stop" @click="openForceStop(code)">🛑 停止</button>
                     <button class="abtn abtn-del" @click="deleteRoom(code)">🗑</button>
                   </td>
                 </tr>
                 <tr v-if="activeRooms.length === 0"><td colspan="6" class="empty-td">アクティブなルームなし</td></tr>
               </tbody>
             </table>
          </div>
        </div>

        <!-- Room List -->
        <div v-else-if="currentPanel === 'rooms'" class="panel active">
          <div class="ph">
            <div class="ph-left"><div class="ph-title">ROOM LIST</div><div class="ph-sub">全ルームの詳細管理</div></div>
          </div>
          <div class="tbl-wrap">
            <table>
              <thead><tr><th>CODE</th><th>STATUS</th><th>P1 NAME</th><th>SCORE</th><th>P2 NAME</th><th>SCORE</th><th>CREATED</th><th>ACTIONS</th></tr></thead>
              <tbody>
                <tr v-for="(r, code) in rooms" :key="code">
                  <td class="code-td">{{ code }}</td>
                  <td><span class="badge" :class="statusClass(r.status)">{{ r.status }}</span></td>
                  <td>{{ r.p1?.name || '—' }}</td>
                  <td class="acc3-txt">{{ r.game?.p1?.score ?? '—' }}</td>
                  <td>{{ r.p2?.name || '—' }}</td>
                  <td class="acc2-txt">{{ r.game?.p2?.score ?? '—' }}</td>
                  <td class="dim-txt">{{ formatTime(r.ts) }}</td>
                  <td>
                    <button v-if="r.status === 'ready'" class="abtn abtn-watch" @click="startSpectating(code)">👁</button>
                    <button class="abtn abtn-stop" @click="openForceStop(code)">🛑</button>
                    <button class="abtn abtn-del" @click="deleteRoom(code)">🗑</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Spectate -->
        <div v-else-if="currentPanel === 'spectate'" class="panel active">
          <div v-if="!specCode" id="spectateList">
            <div class="ph">
              <div class="ph-left"><div class="ph-title">SPECTATE</div><div class="ph-sub">対戦をリアルタイム観戦</div></div>
            </div>
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>CODE</th><th>PLAYER 1</th><th>P1 SCORE</th><th>PLAYER 2</th><th>P2 SCORE</th><th>ACTION</th></tr></thead>
                <tbody>
                  <tr v-for="(r, code) in readyRooms" :key="code">
                    <td class="code-td">{{ code }}</td>
                    <td>{{ r.p1?.name }}</td>
                    <td class="acc3-txt">{{ r.game?.p1?.score ?? 0 }}</td>
                    <td>{{ r.p2?.name }}</td>
                    <td class="acc2-txt">{{ r.game?.p2?.score ?? 0 }}</td>
                    <td><button class="abtn abtn-watch" @click="startSpectating(code)">👁 観戦開始</button></td>
                  </tr>
                  <tr v-if="readyRooms.length === 0"><td colspan="6" class="empty-td">対戦中のルームなし</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-else id="spectateView">
            <div class="ph">
              <div class="ph-left">
                <div style="display:flex;align-items:center;gap:10px">
                  <div class="live-label"><div class="live-dot"></div>LIVE</div>
                  <div class="ph-title">ROOM {{ specCode }}</div>
                </div>
              </div>
              <button class="sbtn" @click="stopSpectating">← 戻る</button>
            </div>
            <div class="spec-arena">
              <div class="spec-col">
                <div class="spec-badge p1">P1: {{ rooms[specCode]?.p1?.name }}</div>
                <canvas ref="specCv1" width="200" height="400" class="spec-cv p1"></canvas>
              </div>
              <div class="vs-txt">VS</div>
              <div class="spec-col">
                <div class="spec-badge p2">P2: {{ rooms[specCode]?.p2?.name }}</div>
                <canvas ref="specCv2" width="200" height="400" class="spec-cv p2"></canvas>
              </div>
            </div>
          </div>
        </div>

        <!-- Broadcast -->
        <div v-else-if="currentPanel === 'broadcast'" class="panel active">
          <div class="ph"><div class="ph-left"><div class="ph-title">BROADCAST</div><div class="ph-sub">全ルームへメッセージ送信</div></div></div>
          <div class="settings-grid">
            <div class="setting-item">
              <div class="si-name">メッセージ配信</div>
              <div class="si-desc">現在アクティブな全ルームにシステムメッセージを送信します</div>
              <input v-model="broadcastMsg" class="pw-input" placeholder="System message...">
              <button class="pw-btn" @click="sendBroadcast">📢 全ルームに送信</button>
            </div>
          </div>
        </div>

        <!-- Log -->
        <div v-else-if="currentPanel === 'log'" class="panel active">
          <div class="ph">
            <div class="ph-left"><div class="ph-title">EVENT LOG</div><div class="ph-sub">管理操作履歴</div></div>
            <button class="sbtn sbtn-red" @click="clearLogs">🗑 全削除</button>
          </div>
          <div class="log-box">
            <div v-for="l in logs" :key="l.id" class="log-entry">
              <span class="log-ts">{{ formatLogTime(l.timestamp) }}</span>
              <span class="log-msg" :class="l.type">{{ l.message }}</span>
            </div>
          </div>
        </div>

        <!-- Feedback -->
        <div v-else-if="currentPanel === 'feedback'" class="panel active">
          <div class="ph">
            <div class="ph-left"><div class="ph-title">FEEDBACK</div><div class="ph-sub">ユーザーからの報告</div></div>
          </div>
          <div class="fb-list">
            <div v-for="(fb, id) in feedbacks" :key="id" class="fb-card" :class="'status-' + fb.status">
              <div class="fb-header">
                <span class="fb-type">{{ fb.type?.toUpperCase() }}</span>
                <span class="fb-ts">{{ new Date(fb.ts).toLocaleString() }}</span>
              </div>
              <div class="fb-msg">{{ fb.message }}</div>
              <div class="fb-actions">
                <button v-if="fb.status === 'new'" @click="setFbStatus(id, 'read')">既読</button>
                <button v-if="fb.status !== 'resolved'" @click="setFbStatus(id, 'resolved')">解決</button>
                <button @click="deleteFeedback(id)">削除</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Settings -->
        <div v-else-if="currentPanel === 'settings'" class="panel active">
          <div class="ph"><div class="ph-left"><div class="ph-title">SETTINGS</div><div class="ph-sub">危険な操作</div></div></div>
          <div class="settings-grid">
            <div class="setting-item">
              <div class="si-name">NUKE ALL ROOMS</div>
              <div class="si-desc">全ルームを即座に削除します。</div>
              <button class="sbtn sbtn-red" @click="nukeAll">NUKE ALL</button>
            </div>
            <div class="setting-item">
              <div class="si-name">CLEANUP</div>
              <div class="si-desc">終了済みルームを削除します。</div>
              <button class="sbtn" @click="cleanupRooms">CLEANUP</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- Force Stop Modal -->
  <div v-if="showFsModal" class="modal-bg show">
    <div class="modal">
      <div class="modal-title">🛑 ルーム強制停止</div>
      <div class="dim-txt">ROOM: {{ fsCode }}</div>
      <input v-model="fsMsg" class="modal-input" placeholder="停止理由を入力...">
      <div class="modal-btns">
        <button class="modal-cancel" @click="showFsModal = false">キャンセル</button>
        <button class="modal-send" @click="execForceStop">停止実行</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watchEffect } from 'vue';
import { APP_VERSION, FB_CONFIG } from '../logic/config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref as dbRef, onValue, update, remove, get, set } from 'firebase/database';
import { getFirestore, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { TetrisGame } from '../logic/tetris';

const isLoggedIn = ref(false);
const password = ref('');
const loginError = ref('');
const currentPanel = ref('dashboard');
const rooms = ref({});
const feedbacks = ref({});
const logs = ref([]);
const currentTime = ref('');
const broadcastMsg = ref('');

const specCode = ref(null);
const specCv1 = ref(null);
const specCv2 = ref(null);

const showFsModal = ref(false);
const fsCode = ref('');
const fsMsg = ref('管理者によってこのルームは強制終了されました');

const app = getApps().length ? getApp() : initializeApp(FB_CONFIG);
const db = getDatabase(app);
const fs = getFirestore(app);

// Stats
const stats = computed(() => {
  const r = Object.values(rooms.value);
  return {
    active: r.filter(x => x.status === 'ready').length,
    waiting: r.filter(x => x.status === 'waiting').length,
    players: r.reduce((n, x) => n + (x.p1 ? 1 : 0) + (x.p2 ? 1 : 0), 0)
  };
});

const activeRooms = computed(() => {
  return Object.entries(rooms.value)
    .filter(([_, r]) => r.status === 'ready' || r.status === 'waiting')
    .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
});

const readyRooms = computed(() => {
  return Object.entries(rooms.value)
    .filter(([_, r]) => r.status === 'ready')
    .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
});

const activeRoomCount = computed(() => stats.value.active + stats.value.waiting);
const newFeedbackCount = computed(() => Object.values(feedbacks.value).filter(f => f.status === 'new').length);

const doLogin = () => {
  // Use environment variable if available, otherwise fallback to hardcoded (matching original)
  const masterPw = import.meta.env.VITE_ADMIN_PW || 'Runa1124';
  if (password.value === masterPw) {
    isLoggedIn.value = true;
    startListeners();
    addLog('管理者ログイン', 'success');
  } else {
    loginError.value = '✗ パスワードが違います';
    setTimeout(() => loginError.value = '', 3000);
  }
};

const doLogout = () => {
  isLoggedIn.value = false;
  password.value = '';
};

let unsubRooms = null;
let unsubLogs = null;
let unsubFB = null;

const startListeners = () => {
  unsubRooms = onValue(dbRef(db, 'multi'), snap => {
    rooms.value = snap.val() || {};
  });

  const qLogs = query(collection(fs, 'site_logs'), orderBy('timestamp', 'desc'), limit(100));
  unsubLogs = onSnapshot(qLogs, snap => {
    logs.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });

  unsubFB = onValue(dbRef(db, 'reports'), snap => {
    feedbacks.value = snap.val() || {};
  });
};

onUnmounted(() => {
  if (unsubRooms) unsubRooms();
  if (unsubLogs) unsubLogs();
  if (unsubFB) unsubFB();
});

const refreshData = async () => {
  const snap = await get(dbRef(db, 'multi'));
  rooms.value = snap.val() || {};
};

const formatTime = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('ja-JP');
};

const formatLogTime = (ts) => {
  if (!ts) return '—';
  return new Date(ts.seconds * 1000).toLocaleTimeString('ja-JP');
};

const statusClass = (s) => {
  if (s === 'waiting') return 'badge-wait';
  if (s === 'ready') return 'badge-live';
  return 'badge-end';
};

// Spectate logic
let specInterval = null;
const startSpectating = (code) => {
  specCode.value = code;
  currentPanel.value = 'spectate';
};

watchEffect(() => {
  if (specCode.value && currentPanel.value === 'spectate') {
    const r = rooms.value[specCode.value];
    if (r && r.game) {
      setTimeout(() => {
        if (specCv1.value) TetrisGame.drawOpp(specCv1.value, r.game.p1, 200, 400);
        if (specCv2.value) TetrisGame.drawOpp(specCv2.value, r.game.p2, 200, 400);
      }, 0);
    }
  }
});

const stopSpectating = () => {
  specCode.value = null;
};

// Admin Actions
const addLog = async (message, type = 'info') => {
  await addDoc(collection(fs, 'site_logs'), {
    message, type, timestamp: serverTimestamp(), source: 'admin'
  });
};

const deleteRoom = async (code) => {
  if (confirm(`ROOM ${code} を削除しますか？`)) {
    await remove(dbRef(db, `multi/${code}`));
    addLog(`ROOM ${code} 削除`, 'warn');
  }
};

const openForceStop = (code) => {
  fsCode.value = code;
  showFsModal.value = true;
};

const execForceStop = async () => {
  const code = fsCode.value;
  await update(dbRef(db, `multi/${code}`), {
    status: 'force_ended',
    forceMsg: fsMsg.value,
    forceTs: Date.now()
  });
  addLog(`ROOM ${code} 強制停止: ${fsMsg.value}`, 'admin');
  showFsModal.value = false;
  setTimeout(() => remove(dbRef(db, `multi/${code}`)), 10000);
};

const sendBroadcast = async () => {
  if (!broadcastMsg.value) return;
  const codes = Object.keys(rooms.value);
  const ts = Date.now();
  const updates = {};
  codes.forEach(c => {
    updates[`multi/${c}/sysMsg`] = broadcastMsg.value;
    updates[`multi/${c}/sysMsgTs`] = ts;
  });
  await update(dbRef(db), updates);
  addLog(`ブロードキャスト: ${broadcastMsg.value}`, 'warn');
  broadcastMsg.value = '';
};

const clearLogs = async () => {
  if (!confirm('ログを全削除しますか？')) return;
  const snap = await getDocs(collection(fs, 'site_logs'));
  const batch = writeBatch(fs);
  snap.forEach(d => batch.delete(d.ref));
  await batch.commit();
};

const setFbStatus = async (id, status) => {
  await update(dbRef(db, `reports/${id}`), { status });
};

const deleteFeedback = async (id) => {
  await remove(dbRef(db, `reports/${id}`));
};

const nukeAll = async () => {
  if (confirm('全ルームを削除しますか？')) {
    await remove(dbRef(db, 'multi'));
    addLog('NUKE ALL ROOMS', 'error');
  }
};

const cleanupRooms = async () => {
  const toDel = Object.entries(rooms.value).filter(([_, r]) =>
    ['ended', 'force_ended', 'p1_left', 'p2_left'].includes(r.status)
  );
  for (const [code] of toDel) {
    await remove(dbRef(db, `multi/${code}`));
  }
  addLog(`クリーンアップ: ${toDel.length}件`, 'info');
};

onMounted(() => {
  setInterval(() => {
    currentTime.value = new Date().toLocaleTimeString('ja-JP');
  }, 1000);
});
</script>

<style scoped>
#loginWrap { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 200; background: #010306 }
.login-logo { font-family: 'Press Start 2P', monospace; font-size: 22px; color: #ff0080; text-shadow: 0 0 20px rgba(255,0,128,.7); margin-bottom: 6px; }
.login-card { background: #080d18; border: 1px solid #1a2540; padding: 36px 32px; width: 380px; position: relative; border-top: 2px solid #ff0080; }
.pw-input { width: 100%; background: rgba(255,0,128,.04); border: 1px solid #243050; color: #e0f0ff; padding: 13px 15px; margin-bottom: 20px; outline: none; }
.pw-btn { width: 100%; padding: 14px; background: linear-gradient(135deg, #ff0080, #cc0066); color: #fff; border: none; cursor: pointer; font-weight: bold; }

#shell { display: flex; height: 100vh; flex-direction: column; z-index: 10; position: relative; background: #020408; color: #e0f0ff; }
.topbar { height: 52px; background: #080d18; border-bottom: 1px solid #1a2540; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; flex-shrink: 0; }
.topbar-logo { font-family: 'Press Start 2P', monospace; font-size: 10px; color: #ff0080; }
.topbar-right { display: flex; align-items: center; gap: 15px; }
.clock { font-size: 12px; color: #4a6080; }
.topbar-btn { background: transparent; border: 1px solid #243050; color: #4a6080; padding: 5px 12px; border-radius: 2px; cursor: pointer; }

.shell-body { display: flex; flex: 1; overflow: hidden; }
.sidebar { width: 210px; background: #080d18; border-right: 1px solid #1a2540; overflow-y: auto; }
.sb-section { padding: 15px 16px 5px; font-size: 10px; color: #2a3a55; border-bottom: 1px solid #2a3a55; margin-bottom: 5px; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 12px 16px; cursor: pointer; color: #4a6080; transition: .2s; }
.nav-item:hover { background: rgba(0,245,255,.05); color: #e0f0ff; }
.nav-item.active { color: #00f5ff; background: rgba(0,245,255,.08); border-left: 2px solid #00f5ff; }
.nav-badge { margin-left: auto; background: #ff0080; color: #fff; font-size: 9px; padding: 2px 6px; border-radius: 10px; font-family: 'Press Start 2P'; }

.main { flex: 1; padding: 20px; overflow-y: auto; }
.ph { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.ph-title { font-family: 'Press Start 2P'; font-size: 12px; color: #00f5ff; }
.ph-sub { font-size: 11px; color: #4a6080; margin-top: 5px; }

.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 22px }
.sc { background: #0d1525; border: 1px solid #1a2540; padding: 16px; border-top: 2px solid #00f5ff; }
.sc.c2 { border-top-color: #ff0080; }
.sc.c3 { border-top-color: #aaff00; }
.sc.c4 { border-top-color: #ffaa00; }
.sc-label { font-size: 10px; color: #4a6080; margin-bottom: 10px; }
.sc-val { font-family: 'Press Start 2P'; font-size: 20px; }
.sc-val.c1 { color: #00f5ff; }
.sc-val.c2 { color: #ff0080; }
.sc-val.c3 { color: #aaff00; }

.tbl-wrap { background: #0d1525; border: 1px solid #1a2540; border-radius: 4px; overflow: hidden; }
.tbl-head { padding: 12px 16px; border-bottom: 1px solid #1a2540; display: flex; align-items: center; }
.tbl-head-title { font-size: 10px; color: #00f5ff; display: flex; align-items: center; gap: 8px; }
table { width: 100%; border-collapse: collapse; }
th { padding: 12px 14px; text-align: left; font-size: 10px; color: #4a6080; border-bottom: 1px solid #1a2540; background: #0a101d; }
td { padding: 12px 14px; font-size: 13px; border-bottom: 1px solid #1a2540; }
.code-td { font-family: 'Press Start 2P'; font-size: 10px; color: #00f5ff; }
.dim-txt { color: #4a6080; font-size: 11px; }
.acc3-txt { color: #aaff00; font-family: 'Press Start 2P'; font-size: 10px; }
.acc2-txt { color: #ff0080; font-family: 'Press Start 2P'; font-size: 10px; }

.badge { font-size: 9px; padding: 2px 8px; border-radius: 2px; border: 1px solid; }
.badge-wait { color: #ffaa00; border-color: #ffaa00; background: rgba(255,170,0,.1); }
.badge-live { color: #00ff88; border-color: #00ff88; background: rgba(0,255,136,.1); }
.badge-end { color: #4a6080; border-color: #4a6080; }

.abtn { background: transparent; border: 1px solid #243050; color: #4a6080; padding: 3px 8px; font-size: 10px; cursor: pointer; margin-right: 5px; }
.abtn:hover { border-color: #00f5ff; color: #00f5ff; }
.abtn-stop:hover { border-color: #ff3355; color: #ff3355; }
.abtn-del:hover { border-color: #ff3355; color: #ff3355; }

.live-dot { width: 6px; height: 6px; background: #ff3355; border-radius: 50%; animation: blink 1s infinite; }
@keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: .3 } }

.spec-arena { display: flex; gap: 20px; justify-content: center; align-items: center; }
.spec-cv { border: 1px solid #1a2540; background: #000; }
.spec-cv.p1 { border-color: #00f5ff; }
.spec-cv.p2 { border-color: #ff0080; }
.spec-badge { margin-bottom: 10px; font-size: 12px; font-weight: bold; }
.spec-badge.p1 { color: #00f5ff; }
.spec-badge.p2 { color: #ff0080; }
.vs-txt { font-family: 'Press Start 2P'; font-size: 24px; color: #ffaa00; }

.log-box { background: #0a101d; border: 1px solid #1a2540; padding: 10px; max-height: 500px; overflow-y: auto; font-family: monospace; font-size: 12px; }
.log-entry { margin-bottom: 5px; border-bottom: 1px solid #1a2540; padding-bottom: 5px; }
.log-ts { color: #4a6080; margin-right: 10px; }
.log-msg.success { color: #00ff88; }
.log-msg.warn { color: #ffaa00; }
.log-msg.error { color: #ff3355; }
.log-msg.admin { color: #ff0080; }

.fb-card { background: #0d1525; border: 1px solid #1a2540; padding: 15px; margin-bottom: 10px; border-left: 3px solid #4a6080; }
.fb-card.status-new { border-left-color: #ff0080; }
.fb-card.status-resolved { opacity: .5; border-left-color: #aaff00; }
.fb-header { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 10px; }
.fb-type { font-weight: bold; color: #00f5ff; }
.fb-msg { font-size: 13px; line-height: 1.5; margin-bottom: 10px; }
.fb-actions button { background: transparent; border: 1px solid #243050; color: #4a6080; margin-right: 10px; padding: 2px 8px; cursor: pointer; }

.settings-grid { display: grid; gap: 15px; }
.setting-item { background: #0d1525; border: 1px solid #1a2540; padding: 20px; }
.si-name { font-weight: bold; margin-bottom: 5px; color: #e0f0ff; }
.si-desc { font-size: 12px; color: #4a6080; margin-bottom: 15px; }

.sbtn { background: transparent; border: 1px solid #243050; color: #4a6080; padding: 5px 15px; border-radius: 2px; cursor: pointer; font-size: 11px; }
.sbtn:hover { border-color: #00f5ff; color: #00f5ff; }
.sbtn-red:hover { border-color: #ff3355; color: #ff3355; }

.modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.8); display: flex; align-items: center; justify-content: center; z-index: 300; }
.modal { background: #080d18; border: 1px solid #1a2540; padding: 30px; width: 400px; border-top: 2px solid #ff3355; }
.modal-title { font-weight: bold; margin-bottom: 20px; color: #ff3355; }
.modal-input { width: 100%; background: #010306; border: 1px solid #243050; color: #fff; padding: 10px; margin-bottom: 20px; outline: none; }
.modal-btns { display: flex; justify-content: flex-end; gap: 10px; }
.modal-cancel { background: transparent; border: 1px solid #243050; color: #4a6080; padding: 8px 20px; cursor: pointer; }
.modal-send { background: #ff3355; color: #fff; border: none; padding: 8px 20px; cursor: pointer; }

.empty-td { text-align: center; color: #4a6080; padding: 40px; }
</style>
