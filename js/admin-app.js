import { db, fs, ref, set, get, onValue, off, update, remove, persistLog, collection, query, orderBy, limit, onSnapshot, deleteDoc, doc, getDocs, writeBatch, serverTimestamp } from './firebase-init.js';
import { APP_VERSION } from '../config.js';
import { COLORS, PIECES, COLS, ROWS, CELL } from './constants.js';

window.db = db;
window.fs = fs;
window.ref = ref;
window.set = set;
window.get = get;
window.onValue = onValue;
window.off = off;
window.update = update;
window.remove = remove;
window.persistLog = persistLog;
window.collection = collection;
window.query = query;
window.orderBy = orderBy;
window.limit = limit;
window.onSnapshot = onSnapshot;
window.deleteDoc = deleteDoc;
window.doc = doc;
window.getDocs = getDocs;
window.writeBatch = writeBatch;
window.serverTimestamp = serverTimestamp;

// ══ LOADER ══
(function() {
    const loader = document.getElementById('adminLoader');
    if (loader) {
        setTimeout(() => {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }, 1000);
    }
})();

// ══ BOARD RENDERER ══
function drawBoard(cv, d) {
  if (!cv || !d || !d.board) return;
  const cx = cv.getContext('2d'); cx.clearRect(0, 0, cv.width, cv.height);
  cx.strokeStyle = 'rgba(255,255,255,.035)'; cx.lineWidth = .5;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) cx.strokeRect(c * CELL, r * CELL, CELL, CELL);

  d.board.forEach((row, r) => {
    if (!row) return;
    row.forEach((cell, c) => {
      if (!cell) return;
      const col = (cell === 'G' ? '#2a3a55' : (COLORS[cell] || '#888'));
      cx.fillStyle = col + 'cc'; cx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      cx.fillStyle = 'rgba(255, 255, 255, .15)'; cx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, 3);
    });
  });

  if (d.cur && PIECES[d.cur.name] && !d.gameOver) {
    const rots = PIECES[d.cur.name];
    const rotIdx = (d.cur.rot || 0) % rots.length;
    const m = rots[rotIdx];
    m.forEach((row, r) => row.forEach((cell, c) => { if (cell) { const py = d.cur.y + r; if (py >= 0) { cx.fillStyle = (COLORS[d.cur.name] || '#888') + '99'; cx.fillRect((d.cur.x + c) * CELL + 1, py * CELL + 1, CELL - 2, CELL - 2); } } }));
  }
  if (d.gameOver) { cx.fillStyle = 'rgba(0,0,0,.8)'; cx.fillRect(0, 0, cv.width, cv.height); cx.fillStyle = '#ff2244'; cx.font = 'bold 11px "Press Start 2P"'; cx.textAlign = 'center'; cx.fillText('GAME OVER', cv.width / 2, cv.height / 2); }
}

// ══ ADMIN LOGIC ══
let roomsData = {}; let specRoom = null;
const _specListeners = {};

const initAdmin = () => {
  const vd = document.getElementById('versionDisp'); if (vd) vd.textContent = `VER ${APP_VERSION}`;
  onValue(ref(db, 'rooms'), snap => {
    roomsData = snap.val() || {};
    updateStats(); renderTables();
  });
  startLogsListener();
  startClock();
};

const startClock = () => {
  setInterval(() => {
     const el = document.getElementById('clockDisp');
     if (el) el.textContent = new Date().toLocaleTimeString('ja-JP');
  }, 1000);
};

const updateStats = () => {
  const r = Object.values(roomsData);
  const activeCount = r.filter(x => x.status === 'ready').length;
  const waitingCount = r.filter(x => x.status === 'waiting').length;
  const playerCount = r.reduce((n, x) => n + Object.keys(x.players || {}).length, 0);
  const stActive = document.getElementById('st-active'); if (stActive) stActive.textContent = activeCount;
  const stWait = document.getElementById('st-wait'); if (stWait) stWait.textContent = waitingCount;
  const stPlayers = document.getElementById('st-players'); if (stPlayers) stPlayers.textContent = playerCount;
  const stTotal = document.getElementById('st-total'); if (stTotal) stTotal.textContent = r.length;
};

function fmtTime(ts){if(!ts)return'—';return new Date(ts).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}

const renderTables = () => {
  const entries = Object.entries(roomsData);
  const db_tbody = document.getElementById('dashTbody');
  if (db_tbody) {
      db_tbody.innerHTML = entries.map(([code, r]) => {
        const players = Object.values(r.players || {}).map(p => p.name).join(', ');
        return `
        <tr>
          <td style="font-family:'Press Start 2P',monospace;color:var(--acc);letter-spacing:5px;">${code}</td>
          <td>${r.status}</td>
          <td>${players || '—'}</td>
          <td style="color:var(--dim)">${fmtTime(r.ts)}</td>
          <td><button class="abtn abtn-watch" onclick="window.startSpec('${code}')">👁 観戦</button>
              <button class="abtn abtn-stop" onclick="window.deleteRoom('${code}')">🗑 削除</button></td>
        </tr>`;
      }).join('');
  }

  const r_tbody = document.getElementById('roomsTbody');
  if (r_tbody) {
      r_tbody.innerHTML = entries.map(([code, r]) => {
          const players = Object.values(r.players || {}).map(p => p.name).join(', ');
          return `
          <tr>
            <td style="font-family:'Press Start 2P',monospace;color:var(--acc);letter-spacing:5px;">${code}</td>
            <td>${r.status} (${r.mode || '???'})</td>
            <td>${players || '—'}</td>
            <td style="color:var(--dim)">${fmtTime(r.ts)}</td>
            <td><button class="abtn abtn-watch" onclick="window.startSpec('${code}')">👁</button>
                <button class="abtn abtn-stop" onclick="window.deleteRoom('${code}')">🗑</button></td>
          </tr>`;
      }).join('');
  }

  const spec_tbody = document.getElementById('specTbody');
  if (spec_tbody) {
      spec_tbody.innerHTML = entries.filter(([,r]) => r.status === 'ready').map(([code, r]) => `
        <tr>
            <td style="font-family:'Press Start 2P',monospace;color:var(--acc);letter-spacing:5px;">${code}</td>
            <td>${r.mode || '???' }</td>
            <td>${Object.values(r.players || {}).map(p => p.name).join(', ')}</td>
            <td><button class="abtn abtn-watch" onclick="window.startSpec('${code}')">👁 観戦</button></td>
        </tr>`).join('');
  }
};

const startLogsListener = () => {
  const q = query(collection(fs, 'site_logs'), orderBy('timestamp', 'desc'), limit(100));
  onSnapshot(q, snap => {
    const box = document.getElementById('logBox'); if (!box) return;
    box.innerHTML = '';
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const id = docSnap.id;
      const ts = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString('ja-JP') : '...';
      const el = document.createElement('div');
      el.className = 'log-entry';
      el.innerHTML = `
        <span class="log-ts">${ts}</span>
        <span class="log-src">[${data.source || '???'}]</span>
        <span class="log-msg ${data.type || 'info'}">${data.message}</span>
        <button class="abtn" onclick="window.deleteLog('${id}')" style="margin-left:auto; font-size:8px;">DEL</button>
      `;
      box.appendChild(el);
    });
  });
};

// ══ AUTH ══
const ADMIN_PW = 'Runa1124';
window.doLogin = () => {
  const pwIn = document.getElementById('pwIn');
  const pw = pwIn ? pwIn.value : '';
  if (pw === ADMIN_PW) {
    const lw = document.getElementById('loginWrap'); if (lw) lw.classList.add('hidden');
    const shell = document.getElementById('shell'); if (shell) shell.classList.add('active');
    initAdmin();
  } else {
    const err = document.getElementById('pwErr');
    if (err) err.textContent = '✗ パスワードが違います';
    if (pwIn) {
        pwIn.value = '';
        pwIn.focus();
    }
    setTimeout(() => { if (err) err.textContent = ''; }, 3000);
  }
};

window.doLogout = () => {
  window.stopSpec();
  const lw = document.getElementById('loginWrap'); if (lw) lw.classList.remove('hidden');
  const shell = document.getElementById('shell'); if (shell) shell.classList.remove('active');
  const pwIn = document.getElementById('pwIn'); if (pwIn) pwIn.value = '';
};

window.deleteLog = async (id) => {
    try {
        await deleteDoc(doc(fs, 'site_logs', id));
    } catch(e) { console.error('Delete log failed:', e); }
};

window.clearAllLogs = async () => {
    if (!confirm('Clear all logs?')) return;
    const snap = await getDocs(collection(fs, 'site_logs'));
    const batch = writeBatch(fs);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
};

window.startSpec = (code) => {
    window.stopSpec();
    specRoom = code;
    const room = roomsData[code];
    if (!room) return;
    const sl = document.getElementById('spectateList'); if (sl) sl.style.display = 'none';
    const sv = document.getElementById('spectateView'); if (sv) sv.style.display = 'block';
    const sc = document.getElementById('specCode'); if (sc) sc.textContent = code;

    const arena = document.getElementById('specArena');
    if (arena) {
        arena.innerHTML = '';
        const players = room.players || {};
        for (const role in players) {
            const p = players[role];
            const div = document.createElement('div');
            div.className = 'spec-col';
            div.innerHTML = `
                <div class="spec-badge">${role.toUpperCase()}</div>
                <div class="spec-name" id="specName-${role}">${p.name}</div>
                <canvas id="specCanvas-${role}" width="200" height="400" class="spec-cv"></canvas>
            `;
            arena.appendChild(div);

            const cv = div.querySelector('canvas');
            _specListeners[role] = onValue(ref(db, `rooms/${code}/game/${role}`), s => {
                const d = s.val();
                drawBoard(cv, d);
                const sn = document.getElementById(`specName-${role}`);
                if (d && sn) sn.textContent = `${p.name} (${d.score || 0})`;
            });
        }
    }
    window.gotoPanel('spectate');
};
window.stopSpec = () => {
    if (specRoom) {
        for (const role in _specListeners) {
            off(ref(db, `rooms/${specRoom}/game/${role}`));
        }
    }
    for (const key in _specListeners) delete _specListeners[key];
    specRoom = null;
    const sl = document.getElementById('spectateList'); if (sl) sl.style.display = 'block';
    const sv = document.getElementById('spectateView'); if (sv) sv.style.display = 'none';
    window.gotoPanel('dashboard');
};

window.gotoPanel = (name) => {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const targetPanel = document.getElementById(`panel-${name}`);
  if (targetPanel) targetPanel.classList.add('active');
  const targetNav = document.getElementById(`nav-${name}`);
  if (targetNav) targetNav.classList.add('active');
};

window.deleteRoom = async (code) => {
    if (confirm(`Delete room ${code}?`)) {
        await remove(ref(db, `rooms/${code}`));
        persistLog(`Room ${code} deleted by admin`, 'warn', { code }, 'admin');
    }
};

window.sendBroadcast = async () => {
    const msg = prompt("Enter broadcast message:");
    if (!msg) return;
    const codes = Object.keys(roomsData);
    const ts = Date.now();
    await Promise.all(codes.map(code => update(ref(db, `rooms/${code}`), { sysMsg: msg, sysMsgTs: ts })));
    persistLog(`Broadcast: ${msg}`, 'admin', { count: codes.length }, 'admin');
};

window.cleanupRooms = async () => {
    let n = 0;
    for (const [code, r] of Object.entries(roomsData)) {
        if (r.status === 'ended' || r.status === 'force_ended') {
            await remove(ref(db, `rooms/${code}`));
            n++;
        }
    }
    persistLog(`Cleanup: ${n} rooms removed`, 'success', { count: n }, 'admin');
};

window.nukeAll = async () => {
    if (confirm("NUKE ALL ROOMS?")) {
        await remove(ref(db, 'rooms'));
        persistLog("Nuke all rooms", "error", {}, "admin");
    }
};

window.promptBotConfig = async () => {
    const delays = prompt("Enter delays (comma separated Easy,Normal,Hard ms):", "250,120,40");
    const noise = prompt("Enter noise (comma separated 0.0-1.0):", "0.12,0.04,0.0");
    if (delays && noise) {
        const d = delays.split(',').map(Number);
        const n = noise.split(',').map(Number);
        await set(ref(db, 'config/bot'), { delays: d, noise: n });
        persistLog("Bot config updated", "admin", { delays: d, noise: n }, "admin");
    }
};
