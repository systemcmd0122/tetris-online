import { db, fs, persistLog } from './firebase-config.js';
import { ref, set, get, onValue, off, update, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { collection, addDoc, query, orderBy, limit, onSnapshot, deleteDoc, doc, getDocs, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initBackground, initAdminLoader } from './animations.js';
import { COLORS, PIECES, COLS, ROWS, CELL } from './constants.js';

const ADMIN_PW = 'Runa1124';
window.doLogin = () => {
  const pw = document.getElementById('pwIn').value;
  if (pw === ADMIN_PW) {
    document.getElementById('loginWrap').classList.add('hidden');
    document.getElementById('shell').classList.add('active');
    initAdmin();
  } else {
    const err = document.getElementById('pwErr');
    err.textContent = '✗ パスワードが違います';
    document.getElementById('pwIn').value = '';
    document.getElementById('pwIn').focus();
    setTimeout(() => err.textContent = '', 3000);
  }
};
document.getElementById('pwIn').addEventListener('keydown', e => { if (e.key === 'Enter') window.doLogin(); });
window.doLogout = () => {
  stopSpec();
  document.getElementById('shell').classList.remove('active');
  document.getElementById('loginWrap').classList.remove('hidden');
  document.getElementById('pwIn').value = '';
};

function drawBoard(cv, d) {
  if (!d || !d.board) return;
  const cx = cv.getContext('2d'); cx.clearRect(0, 0, cv.width, cv.height);
  cx.strokeStyle = 'rgba(255,255,255,.035)'; cx.lineWidth = .5;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) cx.strokeRect(c * CELL, r * CELL, CELL, CELL);
  const cl = d.clRows || [];
  d.board.forEach((row, r) => {
    const isCl = cl.includes(r);
    row.forEach((cell, c) => {
      if (!cell) return; const col = cell === 'G' ? '#888888' : (COLORS[cell] || '#888');
      cx.globalAlpha = isCl ? .35 : 1; cx.fillStyle = col + 'cc'; cx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      if (isCl) { cx.fillStyle = 'rgba(255,255,255,.5)'; cx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2); }
      cx.fillStyle = 'rgba(255,255,255,.15)'; cx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, 3); cx.globalAlpha = 1;
    });
  });
  if (d.cur && PIECES[d.cur.name]) { const m = PIECES[d.cur.name][d.cur.rot || 0]; m.forEach((row, r) => row.forEach((cell, c) => { if (cell) { const py = d.cur.y + r; if (py >= 0) { cx.fillStyle = (COLORS[d.cur.name] || '#888') + '99'; cx.fillRect((d.cur.x + c) * CELL + 1, py * CELL + 1, CELL - 2, CELL - 2); } } })); }
  if (d.gameOver) { cx.fillStyle = 'rgba(0,0,0,.8)'; cx.fillRect(0, 0, cv.width, cv.height); cx.fillStyle = '#ff2244'; cx.font = 'bold 11px "Press Start 2P"'; cx.textAlign = 'center'; cx.fillText('GAME OVER', cv.width / 2, cv.height / 2); }
}

let roomsData = {}; let specRoom = null, specUnsub = { p1: null, p2: null }, specStartTs = null, specTimerIv = null;
let roomsListener = null; let logsUnsub = null; let defaultForceMsg = '管理者によってこのルームは強制終了されました';
let totalRooms = 0;

function initAdmin() {
  addLog('管理者セッション開始', 'info');
  startRoomsListener();
  startLogsListener();
  startBotConfigListener();
  startClock();
}

function startClock() {
  const tick = () => { const now = new Date(); document.getElementById('clockDisp').textContent = now.toLocaleTimeString('ja-JP'); };
  tick(); setInterval(tick, 1000);
}

function startRoomsListener() {
  if (roomsListener) try { off(ref(db, 'rooms')); } catch (e) { }
  onValue(ref(db, 'rooms'), snap => {
    const prev = Object.keys(roomsData).length;
    roomsData = snap.val() || {};
    const curr = Object.keys(roomsData).length;
    if (curr > prev && prev > 0) { totalRooms++; addLog(`新ルーム作成 (合計${curr}件)`, 'success'); }
    totalRooms = Math.max(totalRooms, curr);
    updateStats(); renderTables();
  });
  roomsListener = true;
  addLog('Firebaseリスナー開始', 'info');
}

window.refreshAll = () => {
  get(ref(db, 'rooms')).then(snap => { roomsData = snap.val() || {}; updateStats(); renderTables(); addLog('手動更新', 'info'); });
};

function updateStats() {
  const r = Object.values(roomsData);
  const active = r.filter(x => x.status === 'ready').length;
  const waiting = r.filter(x => x.status === 'waiting').length;
  const players = r.reduce((n, x) => n + (x.p1 ? 1 : 0) + (x.p2 ? 1 : 0), 0);
  const sa = document.getElementById('st-active'); if(sa) sa.textContent = active;
  const sw = document.getElementById('st-wait'); if(sw) sw.textContent = waiting;
  const sp = document.getElementById('st-players'); if(sp) sp.textContent = players;
  const st = document.getElementById('st-total'); if(st) st.textContent = r.length;
  const nb = document.getElementById('navBadge'); if(nb) nb.textContent = active + waiting;
}

function fmtTime(ts) { if (!ts) return '—'; return new Date(ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
function statusBadge(s) {
  if (s === 'waiting') return '<span class="badge badge-wait">⏳ WAITING</span>';
  if (s === 'ready') return '<span class="badge badge-live"><div class="live-dot"></div>LIVE</span>';
  if (s === 'force_ended') return '<span class="badge badge-end">🛑 FORCED</span>';
  return '<span class="badge badge-end">— ENDED</span>';
}

function renderTables() {
  const entries = Object.entries(roomsData);
  const db_tbody = document.getElementById('dashTbody');
  if (db_tbody) {
    if (!entries.length) { db_tbody.innerHTML = '<tr><td class="empty-td" colspan="6">ルームなし</td></tr>'; }
    else {
      db_tbody.innerHTML = entries.map(([code, r]) => `
    <tr>
      <td style="font-family:'Press Start 2P',monospace;color:var(--acc);letter-spacing:5px;font-size:11px">${code}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${r.p1?.name || '—'}</td>
      <td>${r.p2?.name || '—'}</td>
      <td style="color:var(--dim)">${fmtTime(r.ts)}</td>
      <td>${r.status === 'ready' ? `<button class="abtn abtn-watch" onclick="startSpec('${code}')">👁 観戦</button>` : ''}
          <button class="abtn abtn-stop" onclick="openFsModal('${code}')">🛑 停止</button>
          <button class="abtn abtn-msg" onclick="openMsgModal('${code}')">💬 MSG</button>
          <button class="abtn abtn-del" onclick="deleteRoom('${code}')">🗑</button></td>
    </tr>`).join('');
    }
  }

  const r_tbody = document.getElementById('roomsTbody');
  if (r_tbody) {
    if (!entries.length) { r_tbody.innerHTML = '<tr><td class="empty-td" colspan="9">ルームなし</td></tr>'; }
    else {
      r_tbody.innerHTML = entries.map(([code, r]) => `
    <tr>
      <td style="font-family:'Press Start 2P',monospace;color:var(--acc);letter-spacing:5px;font-size:11px">${code}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${r.p1?.name || '—'}</td>
      <td style="color:var(--acc3);font-family:'Press Start 2P',monospace;font-size:9px">${r.game?.p1?.score ?? '—'}</td>
      <td>${r.p2?.name || '—'}</td>
      <td style="color:var(--acc2);font-family:'Press Start 2P',monospace;font-size:9px">${r.game?.p2?.score ?? '—'}</td>
      <td style="color:var(--dim)">${r.game?.p1?.level ?? '—'}</td>
      <td style="color:var(--dim)">${fmtTime(r.ts)}</td>
      <td>${r.status === 'ready' ? `<button class="abtn abtn-watch" onclick="startSpec('${code}')">👁</button>` : ''}
          <button class="abtn abtn-stop" onclick="openFsModal('${code}')">🛑</button>
          <button class="abtn abtn-msg" onclick="openMsgModal('${code}')">💬</button>
          <button class="abtn abtn-del" onclick="deleteRoom('${code}')">🗑</button></td>
    </tr>`).join('');
    }
  }

  const active = entries.filter(([, r]) => r.status === 'ready');
  const sp_tbody = document.getElementById('specTbody');
  if (sp_tbody) {
    if (!active.length) { sp_tbody.innerHTML = '<tr><td class="empty-td" colspan="6">対戦中のルームなし</td></tr>'; }
    else {
      sp_tbody.innerHTML = active.map(([code, r]) => `
    <tr>
      <td style="font-family:'Press Start 2P',monospace;color:var(--acc);letter-spacing:5px;font-size:11px">${code}</td>
      <td>${r.p1?.name || '—'}</td>
      <td style="color:var(--acc3);font-family:'Press Start 2P',monospace;font-size:9px">${r.game?.p1?.score ?? 0}</td>
      <td>${r.p2?.name || '—'}</td>
      <td style="color:var(--acc2);font-family:'Press Start 2P',monospace;font-size:9px">${r.game?.p2?.score ?? 0}</td>
      <td><button class="abtn abtn-watch" onclick="startSpec('${code}')">👁 観戦開始</button></td>
    </tr>`).join('');
    }
  }
}

let _fsCode = null;
window.openFsModal = code => {
  _fsCode = code;
  document.getElementById('fsModalCode').textContent = code;
  document.getElementById('fsModalMsg').value = defaultForceMsg;
  document.getElementById('fsModal').classList.add('show');
  setTimeout(() => document.getElementById('fsModalMsg').focus(), 50);
};
window.closeFsModal = () => {
  document.getElementById('fsModal').classList.remove('show');
  _fsCode = null;
};
window.execFsModal = async () => {
  if (!_fsCode) return;
  const msg = document.getElementById('fsModalMsg').value.trim() || defaultForceMsg;
  const code = _fsCode;
  closeFsModal();
  await window.forceStop(code, msg);
};
document.getElementById('fsModal').addEventListener('click', e => {
  if (e.target === document.getElementById('fsModal')) closeFsModal();
});
document.getElementById('fsModalMsg').addEventListener('keydown', e => {
  if (e.key === 'Enter') window.execFsModal();
  if (e.key === 'Escape') window.closeFsModal();
});

window.forceStop = async (code, customMsg) => {
  const msg = (customMsg || defaultForceMsg).trim();
  if (!code) return;
  const current = roomsData[code];
  if (current?.status === 'force_ended') {
    showToast(`ROOM ${code} はすでに停止済みです`, 'warn');
    return;
  }
  try {
    await update(ref(db, `rooms/${code}`), {
      status: 'force_ended',
      forceMsg: msg,
      forceTs: Date.now()
    });
    addLog(`ROOM ${code} 強制停止: "${msg}"`, 'admin');
    persistLog(`Forced stop room ${code}`, 'admin', { code, msg });
    showToast(`ROOM ${code} を強制停止しました`, 'warn');
    setTimeout(async () => {
      try {
        await remove(ref(db, `rooms/${code}`));
        addLog(`ROOM ${code} 自動削除 (強制停止から10秒後)`, 'info');
      } catch (e) {
        addLog(`ROOM ${code} 自動削除失敗: ${e.message}`, 'error');
      }
    }, 10000);
  } catch (e) {
    addLog(`強制停止失敗 ROOM ${code}: ${e.message}`, 'error');
    showToast(`停止失敗: ${e.message}`, 'err');
  }
};
window.currentSpecRoom = null;

window.deleteRoom = async (code) => {
  if (!code) return;
  if (!confirm(`ROOM ${code} を削除しますか？\nこの操作は即座に実行され取り消せません。`)) return;
  try {
    await remove(ref(db, `rooms/${code}`));
    addLog(`ROOM ${code} 削除`, 'warn');
    persistLog(`Deleted room ${code}`, 'warn', { code });
    showToast(`ROOM ${code} を削除しました`, 'ok');
  } catch (e) {
    addLog(`削除失敗: ${e.message}`, 'error');
    showToast(`削除失敗: ${e.message}`, 'err');
  }
};

window.startSpec = code => {
  stopSpec();
  specRoom = code; window.currentSpecRoom = code;
  gotoPanel('spectate', document.querySelector('.nav-item:nth-child(3)'));
  document.getElementById('spectateList').style.display = 'none';
  document.getElementById('spectateView').style.display = 'block';
  document.getElementById('specCode').textContent = code;
  specStartTs = Date.now();

  const r = roomsData[code];
  document.getElementById('specP1N').textContent = r?.p1?.name || 'PLAYER 1';
  document.getElementById('specP2N').textContent = r?.p2?.name || 'PLAYER 2';
  addLog(`観戦開始: ROOM ${code}`, 'info');

  const cv1 = document.getElementById('specCv1'), cv2 = document.getElementById('specCv2');
  const rp1 = ref(db, `rooms/${code}/game/p1`);
  const rp2 = ref(db, `rooms/${code}/game/p2`);
  onValue(rp1, s => { const d = s.val(); drawBoard(cv1, d); if (d) { document.getElementById('ssP1Score').textContent = d.score || 0; document.getElementById('ssP1Level').textContent = d.level || 1; document.getElementById('ssP1Lines').textContent = d.lines || 0; } });
  onValue(rp2, s => { const d = s.val(); drawBoard(cv2, d); if (d) { document.getElementById('ssP2Score').textContent = d.score || 0; document.getElementById('ssP2Level').textContent = d.level || 1; document.getElementById('ssP2Lines').textContent = d.lines || 0; } });
  specUnsub.p1 = rp1; specUnsub.p2 = rp2;

  if (specTimerIv) clearInterval(specTimerIv);
  specTimerIv = setInterval(() => {
    if (!specRoom) { clearInterval(specTimerIv); specTimerIv = null; return; }
    const el = Math.floor((Date.now() - specStartTs) / 1000);
    const m = Math.floor(el / 60), s = el % 60;
    document.getElementById('specTimer').textContent = `経過時間: ${m}:${s.toString().padStart(2, '0')}`;
  }, 1000);
};
window.stopSpec = () => {
  if (specUnsub.p1) try { off(specUnsub.p1); } catch (e) { }
  if (specUnsub.p2) try { off(specUnsub.p2); } catch (e) { }
  specUnsub = { p1: null, p2: null };
  if (specTimerIv) { clearInterval(specTimerIv); specTimerIv = null; }
  if (specRoom) addLog(`観戦終了: ROOM ${specRoom}`, 'info');
  specRoom = null; window.currentSpecRoom = null;
  const sl = document.getElementById('spectateList'); if(sl) sl.style.display = '';
  const sv = document.getElementById('spectateView'); if(sv) sv.style.display = 'none';
};
window.sendBroadcast = async () => {
  const msg = document.getElementById('bcMsg').value.trim();
  if (!msg) { showToast('メッセージを入力してください', 'err'); return; }
  const codes = Object.keys(roomsData);
  const ts = Date.now();
  await Promise.all(codes.map(code => update(ref(db, `rooms/${code}`), { sysMsg: msg, sysMsgTs: ts }).catch(() => { })));
  const n = codes.length;
  addLog(`ブロードキャスト (${n}ルーム): "${msg}"`, "warn");
  persistLog(`Broadcast to ${n} rooms: "${msg}"`, 'admin', { n, msg });
  showToast(`${n}件のルームに送信`, 'ok');
  document.getElementById('bcStatus').textContent = `✓ ${n}件に送信 — ${new Date().toLocaleTimeString('ja-JP')}`;
};
window.clearBcMsg = () => { document.getElementById('bcMsg').value = ''; document.getElementById('bcStatus').textContent = ''; };
window.saveDefMsg = () => { defaultForceMsg = document.getElementById('defMsg').value || defaultForceMsg; showToast('デフォルトメッセージ保存', 'ok'); };

let _msgRoom = null;
window.openMsgModal = code => { _msgRoom = code; document.getElementById('msgRoomCode').textContent = code; document.getElementById('msgModal').classList.add('show'); document.getElementById('msgInput').focus(); };
window.closeMsgModal = () => { document.getElementById('msgModal').classList.remove('show'); _msgRoom = null; };
window.sendRoomMsg = async () => {
  const msg = document.getElementById('msgInput').value.trim();
  if (!msg || !_msgRoom) return;
  await update(ref(db, `rooms/${_msgRoom}`), { sysMsg: msg, sysMsgTs: Date.now() }).catch(() => { });
  addLog(`MSG to ROOM ${_msgRoom}: "${msg}"`, "info");
  showToast('メッセージ送信', 'ok');
  closeMsgModal(); document.getElementById('msgInput').value = '';
};
document.getElementById('msgInput').addEventListener('keydown', e => { if (e.key === 'Enter') window.sendRoomMsg(); if (e.key === 'Escape') window.closeMsgModal(); });
document.getElementById('msgModal').addEventListener('click', e => { if (e.target === document.getElementById('msgModal')) window.closeMsgModal(); });

window.toggleSiBody = id => { const el = document.getElementById(id); if(el) el.classList.toggle('open'); };

window.nukeAll = async () => {
  const inp = document.getElementById('nukeConfIn').value;
  if (inp !== 'NUKE') { showToast('「NUKE」と正確に入力してください', 'err'); return; }
  try {
    const codes = Object.keys(roomsData);
    const activeOps = codes
      .filter(c => roomsData[c]?.status !== 'force_ended')
      .map(c => update(ref(db, `rooms/${c}`), {
        status: 'force_ended',
        forceMsg: 'システムメンテナンスのため強制終了されました',
        forceTs: Date.now()
      }).catch(() => { }));
    await Promise.all(activeOps);
    addLog(`全${codes.length}ルームに force_ended 送信`, 'admin');
    await new Promise(r => setTimeout(r, 2000));
    await remove(ref(db, 'rooms'));
    addLog('⚠ 全ルームNUKE完了', 'error');
    persistLog('Nuke all rooms executed', 'error');
    showToast('全ルームを削除しました', 'warn');
    document.getElementById('nukeConfIn').value = '';
    toggleSiBody('nukeBody');
    roomsData = {}; updateStats(); renderTables();
  } catch (e) {
    addLog('NUKE失敗: ' + e.message, 'error');
    showToast('NUKE失敗: ' + e.message, 'err');
  }
};

window.cleanupRooms = async () => {
  let n = 0;
  const ops = [];
  for (const [code, r] of Object.entries(roomsData)) {
    if (r.status === 'ended' || r.status === 'force_ended' ||
      r.status === 'p2_left' || r.status === 'p1_left') {
      ops.push(remove(ref(db, `rooms/${code}`)).catch(() => { }));
      n++;
    }
  }
  await Promise.all(ops);
  addLog(`クリーンアップ: ${n}件削除`, 'success');
  persistLog(`Cleanup ended rooms: ${n} removed`, 'success', { count: n });
  showToast(`${n}件のルームを削除`, n > 0 ? 'ok' : 'warn');
};

function startBotConfigListener() {
  onValue(ref(db, 'config/bot'), snap => {
    const d = snap.val();
    if (d) {
      if (d.delays) {
        document.getElementById('botDelay0').value = d.delays[0];
        document.getElementById('botDelay1').value = d.delays[1];
        document.getElementById('botDelay2').value = d.delays[2];
      }
      if (d.noise) {
        document.getElementById('botNoise0').value = d.noise[0];
        document.getElementById('botNoise1').value = d.noise[1];
        document.getElementById('botNoise2').value = d.noise[2];
      }
    }
  });
}

window.saveBotConfig = async () => {
  const delays = [
    parseInt(document.getElementById('botDelay0').value),
    parseInt(document.getElementById('botDelay1').value),
    parseInt(document.getElementById('botDelay2').value)
  ];
  const noise = [
    parseFloat(document.getElementById('botNoise0').value),
    parseFloat(document.getElementById('botNoise1').value),
    parseFloat(document.getElementById('botNoise2').value)
  ];
  try {
    await set(ref(db, 'config/bot'), { delays, noise });
    showToast('ボット設定を保存しました', 'ok');
    persistLog('Bot configuration updated', 'admin', { delays, noise });
  } catch (e) { showToast('保存失敗', 'err'); }
};

window.stopAllActive = async () => {
  const active = Object.entries(roomsData)
    .filter(([, r]) => r.status === 'ready' || r.status === 'waiting');
  if (!active.length) { showToast('アクティブなルームなし', 'warn'); return; }
  const BATCH_MSG = '管理者によって全ルームが強制終了されました';
  const ops = active.map(([code]) =>
    update(ref(db, `rooms/${code}`), {
      status: 'force_ended',
      forceMsg: BATCH_MSG,
      forceTs: Date.now()
    }).catch(() => { })
  );
  await Promise.all(ops);
  addLog(`全${active.length}ルームを同時強制停止`, 'admin');
  persistLog(`Force stop all ${active.length} active rooms`, 'admin', { count: active.length });
  showToast(`${active.length}ルームを強制停止しました`, 'warn');
  setTimeout(async () => {
    const delOps = active.map(([code]) => remove(ref(db, `rooms/${code}`)).catch(() => { }));
    await Promise.all(delOps);
    addLog(`強制停止ルーム ${active.length}件 自動削除`, 'info');
  }, 10000);
};

function startLogsListener() {
  if (logsUnsub) logsUnsub();
  const q = query(collection(fs, 'site_logs'), orderBy('timestamp', 'desc'), limit(100));
  logsUnsub = onSnapshot(q, snap => {
    const box = document.getElementById('logBox');
    if(!box) return;
    box.innerHTML = '';
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const id = docSnap.id;
      const ts = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString('ja-JP') : '...';
      const el = document.createElement('div');
      el.className = 'log-entry';
      el.innerHTML = `
        <span class="log-ts">${ts}</span>
        <span class="log-src">${data.source || '???'}</span>
        <span class="log-msg ${data.type || 'info'}">${data.message}</span>
        <button class="abtn abtn-log-del" onclick="deleteLog('${id}')">DEL</button>
      `;
      box.appendChild(el);
    });
  });
}

function addLog(msg, type = 'info') {
  console.log(`[${type}] ${msg}`);
}

window.deleteLog = async (id) => {
  try {
    await deleteDoc(doc(fs, 'site_logs', id));
  } catch (e) { showToast('削除失敗', 'err'); }
};

window.clearAllLogs = async () => {
  if (!confirm('全てのログを削除しますか？')) return;
  try {
    const q = query(collection(fs, 'site_logs'), limit(500));
    const snap = await getDocs(q);
    const batch = writeBatch(fs);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    showToast('ログをクリアしました', 'ok');
  } catch (e) { showToast('クリア失敗', 'err'); }
};

window.gotoPanel = (name, el) => {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const p = document.getElementById(`panel-${name}`); if(p) p.classList.add('active');
  if (el) el.classList.add('active');
};

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg; t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

initBackground('bgCanvas');
initAdminLoader();
