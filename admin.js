import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import{getDatabase,ref,set,get,onValue,off,update,remove}
  from"https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const fbApp=initializeApp({
  apiKey:"AIzaSyCjYKsc8eT9gDXEMQsfI0ZJ7UeuLwrDTxw",
  authDomain:"tetris-online-9c827.firebaseapp.com",
  databaseURL:"https://tetris-online-9c827-default-rtdb.firebaseio.com",
  projectId:"tetris-online-9c827",
  storageBucket:"tetris-online-9c827.firebasestorage.app",
  messagingSenderId:"1045054992314",
  appId:"1:1045054992314:web:7fea20b9be543d7cab3783"
});
const db=getDatabase(fbApp);

// ══ AUTH ══
const ADMIN_PW='Runa1124';
window.doLogin=()=>{
  const pw=document.getElementById('pwIn').value;
  if(pw===ADMIN_PW){
    document.getElementById('loginWrap').classList.add('hidden');
    document.getElementById('shell').classList.add('active');
    initAdmin();
  }else{
    const err=document.getElementById('pwErr');
    err.textContent='✗ パスワードが違います';
    document.getElementById('pwIn').value='';
    document.getElementById('pwIn').focus();
    setTimeout(()=>err.textContent='',3000);
  }
};
document.getElementById('pwIn').addEventListener('keydown',e=>{if(e.key==='Enter')window.doLogin();});
window.doLogout=()=>{
  stopSpec();
  document.getElementById('shell').classList.remove('active');
  document.getElementById('loginWrap').classList.remove('hidden');
  document.getElementById('pwIn').value='';
};

// ══ TETRIS BOARD RENDERER ══
const COLS=10,ROWS=20,CELL=20;
const COLORS={I:'#00f5ff',O:'#f5d800',T:'#cc00ff',S:'#aaff00',Z:'#ff2244',J:'#1166ff',L:'#ff8800',G:'#2a3a55'};
const PIECES={
  I:[[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],[[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],[[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],[[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]]],
  O:[[[1,1],[1,1]],[[1,1],[1,1]],[[1,1],[1,1]],[[1,1],[1,1]]],
  T:[[[0,1,0],[1,1,1],[0,0,0]],[[0,1,0],[0,1,1],[0,1,0]],[[0,0,0],[1,1,1],[0,1,0]],[[0,1,0],[1,1,0],[0,1,0]]],
  S:[[[0,1,1],[1,1,0],[0,0,0]],[[0,1,0],[0,1,1],[0,0,1]],[[0,0,0],[0,1,1],[1,1,0]],[[1,0,0],[1,1,0],[0,1,0]]],
  Z:[[[1,1,0],[0,1,1],[0,0,0]],[[0,0,1],[0,1,1],[0,1,0]],[[0,0,0],[1,1,0],[0,1,1]],[[0,1,0],[1,1,0],[1,0,0]]],
  J:[[[1,0,0],[1,1,1],[0,0,0]],[[0,1,1],[0,1,0],[0,1,0]],[[0,0,0],[1,1,1],[0,0,1]],[[0,1,0],[0,1,0],[1,1,0]]],
  L:[[[0,0,1],[1,1,1],[0,0,0]],[[0,1,0],[0,1,0],[0,1,1]],[[0,0,0],[1,1,1],[1,0,0]],[[1,1,0],[0,1,0],[0,1,0]]]
};
function drawBoard(cv,d){
  if(!d||!d.board)return;
  const cx=cv.getContext('2d');cx.clearRect(0,0,cv.width,cv.height);
  cx.strokeStyle='rgba(255,255,255,.035)';cx.lineWidth=.5;
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)cx.strokeRect(c*CELL,r*CELL,CELL,CELL);
  const cl=d.clRows||[];
  d.board.forEach((row,r)=>{
    const isCl=cl.includes(r);
    row.forEach((cell,c)=>{
      if(!cell)return;const col=COLORS[cell]||'#888';
      cx.globalAlpha=isCl?.35:1;cx.fillStyle=col+'cc';cx.fillRect(c*CELL+1,r*CELL+1,CELL-2,CELL-2);
      if(isCl){cx.fillStyle='rgba(255,255,255,.5)';cx.fillRect(c*CELL+1,r*CELL+1,CELL-2,CELL-2);}
      cx.fillStyle='rgba(255,255,255,.15)';cx.fillRect(c*CELL+1,r*CELL+1,CELL-2,3);cx.globalAlpha=1;
    });
  });
  if(d.cur&&PIECES[d.cur.name]){const m=PIECES[d.cur.name][d.cur.rot||0];m.forEach((row,r)=>row.forEach((cell,c)=>{if(cell){const py=d.cur.y+r;if(py>=0){cx.fillStyle=(COLORS[d.cur.name]||'#888')+'99';cx.fillRect((d.cur.x+c)*CELL+1,py*CELL+1,CELL-2,CELL-2);}}}));}
  if(d.over){cx.fillStyle='rgba(0,0,0,.8)';cx.fillRect(0,0,cv.width,cv.height);cx.fillStyle='#ff2244';cx.font='bold 11px "Press Start 2P"';cx.textAlign='center';cx.fillText('GAME OVER',cv.width/2,cv.height/2);}
}

// ══ ADMIN STATE ══
let roomsData={};let specRoom=null,specUnsub={p1:null,p2:null},specStartTs=null;
let roomsListener=null;let defaultForceMsg='管理者によってこのルームは強制終了されました';
let totalRooms=0;

function initAdmin(){
  addLog('管理者セッション開始','info');
  startRoomsListener();
  startClock();
}

function startClock(){
  const tick=()=>{const now=new Date();document.getElementById('clockDisp').textContent=now.toLocaleTimeString('ja-JP');};
  tick();setInterval(tick,1000);
}

function startRoomsListener(){
  if(roomsListener)try{off(ref(db,'rooms'));}catch(e){}
  onValue(ref(db,'rooms'),snap=>{
    const prev=Object.keys(roomsData).length;
    roomsData=snap.val()||{};
    const curr=Object.keys(roomsData).length;
    if(curr>prev&&prev>0){totalRooms++;addLog(`新ルーム作成 (合計${curr}件)`,'success');}
    totalRooms=Math.max(totalRooms,curr);
    updateStats();renderTables();
  });
  roomsListener=true;
  addLog('Firebaseリスナー開始','info');
}

window.refreshAll=()=>{
  get(ref(db,'rooms')).then(snap=>{roomsData=snap.val()||{};updateStats();renderTables();addLog('手動更新','info');});
};

function updateStats(){
  const r=Object.values(roomsData);
  const active=r.filter(x=>x.status==='ready').length;
  const waiting=r.filter(x=>x.status==='waiting').length;
  const players=r.reduce((n,x)=>n+(x.p1?1:0)+(x.p2?1:0),0);
  document.getElementById('st-active').textContent=active;
  document.getElementById('st-wait').textContent=waiting;
  document.getElementById('st-players').textContent=players;
  document.getElementById('st-total').textContent=r.length;
  document.getElementById('navBadge').textContent=active+waiting;
}

function fmtTime(ts){if(!ts)return'—';return new Date(ts).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
function statusBadge(s){
  if(s==='waiting')return'<span class="badge badge-wait">⏳ WAITING</span>';
  if(s==='ready')return'<span class="badge badge-live"><div class="live-dot"></div>LIVE</span>';
  if(s==='force_ended')return'<span class="badge badge-end">🛑 FORCED</span>';
  return'<span class="badge badge-end">— ENDED</span>';
}

function renderTables(){
  const entries=Object.entries(roomsData);

  // Dashboard
  const db_tbody=document.getElementById('dashTbody');
  if(!entries.length){db_tbody.innerHTML='<tr><td class="empty-td" colspan="6">ルームなし</td></tr>';}
  else{db_tbody.innerHTML=entries.map(([code,r])=>`
    <tr>
      <td style="font-family:'Press Start 2P',monospace;color:var(--acc);letter-spacing:5px;font-size:11px">${code}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${r.p1?.name||'—'}</td>
      <td>${r.p2?.name||'—'}</td>
      <td style="color:var(--dim)">${fmtTime(r.ts)}</td>
      <td>${r.status==='ready'?`<button class="abtn abtn-watch" onclick="startSpec('${code}')">👁 観戦</button>`:''}
          <button class="abtn abtn-stop" onclick="openFsModal('${code}')">🛑 停止</button>
          <button class="abtn abtn-msg" onclick="openMsgModal('${code}')">💬 MSG</button>
          <button class="abtn abtn-del" onclick="deleteRoom('${code}')">🗑</button></td>
    </tr>`).join('');}

  // Rooms detail
  const r_tbody=document.getElementById('roomsTbody');
  if(!entries.length){r_tbody.innerHTML='<tr><td class="empty-td" colspan="9">ルームなし</td></tr>';}
  else{r_tbody.innerHTML=entries.map(([code,r])=>`
    <tr>
      <td style="font-family:'Press Start 2P',monospace;color:var(--acc);letter-spacing:5px;font-size:11px">${code}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${r.p1?.name||'—'}</td>
      <td style="color:var(--acc3);font-family:'Press Start 2P',monospace;font-size:9px">${r.game?.p1?.score??'—'}</td>
      <td>${r.p2?.name||'—'}</td>
      <td style="color:var(--acc2);font-family:'Press Start 2P',monospace;font-size:9px">${r.game?.p2?.score??'—'}</td>
      <td style="color:var(--dim)">${r.game?.p1?.level??'—'}</td>
      <td style="color:var(--dim)">${fmtTime(r.ts)}</td>
      <td>${r.status==='ready'?`<button class="abtn abtn-watch" onclick="startSpec('${code}')">👁</button>`:''}
          <button class="abtn abtn-stop" onclick="openFsModal('${code}')">🛑</button>
          <button class="abtn abtn-msg" onclick="openMsgModal('${code}')">💬</button>
          <button class="abtn abtn-del" onclick="deleteRoom('${code}')">🗑</button></td>
    </tr>`).join('');}

  // Spectate list
  const active=entries.filter(([,r])=>r.status==='ready');
  const sp_tbody=document.getElementById('specTbody');
  if(!active.length){sp_tbody.innerHTML='<tr><td class="empty-td" colspan="6">対戦中のルームなし</td></tr>';}
  else{sp_tbody.innerHTML=active.map(([code,r])=>`
    <tr>
      <td style="font-family:'Press Start 2P',monospace;color:var(--acc);letter-spacing:5px;font-size:11px">${code}</td>
      <td>${r.p1?.name||'—'}</td>
      <td style="color:var(--acc3);font-family:'Press Start 2P',monospace;font-size:9px">${r.game?.p1?.score??0}</td>
      <td>${r.p2?.name||'—'}</td>
      <td style="color:var(--acc2);font-family:'Press Start 2P',monospace;font-size:9px">${r.game?.p2?.score??0}</td>
      <td><button class="abtn abtn-watch" onclick="startSpec('${code}')">👁 観戦開始</button></td>
    </tr>`).join('');}
}

// ══ FORCE STOP MODAL ══
let _fsCode = null;
window.openFsModal = code => {
  _fsCode = code;
  document.getElementById('fsModalCode').textContent = code;
  document.getElementById('fsModalMsg').value = defaultForceMsg;
  document.getElementById('fsModal').classList.add('show');
  document.getElementById('fsModalMsg').focus();
};
window.closeFsModal = () => { document.getElementById('fsModal').classList.remove('show'); _fsCode = null; };
window.execFsModal = async () => {
  if (!_fsCode) return;
  const msg = document.getElementById('fsModalMsg').value.trim() || defaultForceMsg;
  closeFsModal();
  await window.forceStop(_fsCode, msg);
};
document.getElementById('fsModal').addEventListener('click', e => { if (e.target === document.getElementById('fsModal')) closeFsModal(); });
document.getElementById('fsModalMsg').addEventListener('keydown', e => { if (e.key === 'Enter') window.execFsModal(); if (e.key === 'Escape') window.closeFsModal(); });

// ══ FORCE STOP ══
window.forceStop=async(code,customMsg)=>{
  const msg=customMsg||defaultForceMsg;
  try{
    // ★ Works for ALL statuses: waiting, ready, etc.
    await update(ref(db,`rooms/${code}`),{status:'force_ended',forceMsg:msg,forceTs:Date.now()});
    addLog(`ROOM ${code} を強制停止: "${msg}"`,"admin");
    showToast(`ROOM ${code} を強制停止しました`,'warn');
    // Auto delete after delay so players can see the screen
    setTimeout(()=>{remove(ref(db,`rooms/${code}`)).catch(()=>{});addLog(`ROOM ${code} 自動削除`,'info');},8000);
  }catch(e){addLog(`強制停止失敗 ${code}: ${e.message}`,'error');}
};
window.currentSpecRoom=null;

window.deleteRoom=async(code)=>{
  try{
    await remove(ref(db,`rooms/${code}`));
    addLog(`ROOM ${code} 削除`,'warn');showToast(`ROOM ${code} を削除`,'ok');
  }catch(e){addLog('削除失敗: '+e.message,'error');}
};

// ══ SPECTATE ══
window.startSpec=code=>{
  stopSpec();
  specRoom=code;window.currentSpecRoom=code;
  gotoPanel('spectate',document.querySelector('.nav-item:nth-child(3)'));
  document.getElementById('spectateList').style.display='none';
  document.getElementById('spectateView').style.display='block';
  document.getElementById('specCode').textContent=code;
  specStartTs=Date.now();

  const r=roomsData[code];
  document.getElementById('specP1N').textContent=r?.p1?.name||'PLAYER 1';
  document.getElementById('specP2N').textContent=r?.p2?.name||'PLAYER 2';
  addLog(`観戦開始: ROOM ${code}`,'info');

  const cv1=document.getElementById('specCv1'),cv2=document.getElementById('specCv2');
  const rp1=ref(db,`rooms/${code}/game/p1`);
  const rp2=ref(db,`rooms/${code}/game/p2`);
  onValue(rp1,s=>{const d=s.val();drawBoard(cv1,d);if(d){document.getElementById('ssP1Score').textContent=d.score||0;document.getElementById('ssP1Level').textContent=d.level||1;document.getElementById('ssP1Lines').textContent=d.lines||0;}});
  onValue(rp2,s=>{const d=s.val();drawBoard(cv2,d);if(d){document.getElementById('ssP2Score').textContent=d.score||0;document.getElementById('ssP2Level').textContent=d.level||1;document.getElementById('ssP2Lines').textContent=d.lines||0;}});
  specUnsub.p1=rp1;specUnsub.p2=rp2;

  // Update timer
  const tmrIv=setInterval(()=>{
    if(!specRoom){clearInterval(tmrIv);return;}
    const el=Math.floor((Date.now()-specStartTs)/1000);
    const m=Math.floor(el/60),s=el%60;
    document.getElementById('specTimer').textContent=`経過時間: ${m}:${s.toString().padStart(2,'0')}`;
  },1000);
};
window.stopSpec=()=>{
  if(specUnsub.p1)try{off(specUnsub.p1);}catch(e){}
  if(specUnsub.p2)try{off(specUnsub.p2);}catch(e){}
  specUnsub={p1:null,p2:null};
  if(specRoom)addLog(`観戦終了: ROOM ${specRoom}`,'info');
  specRoom=null;window.currentSpecRoom=null;
  document.getElementById('spectateList').style.display='';
  document.getElementById('spectateView').style.display='none';
};

// ══ BROADCAST ══
window.sendBroadcast=async()=>{
  const msg=document.getElementById('bcMsg').value.trim();
  if(!msg){showToast('メッセージを入力してください','err');return;}
  let n=0;
  for(const code of Object.keys(roomsData)){
    await update(ref(db,`rooms/${code}`),{sysMsg:msg,sysMsgTs:Date.now()}).catch(()=>{});n++;
  }
  addLog(`ブロードキャスト (${n}ルーム): "${msg}"`,"warn");
  showToast(`${n}件のルームに送信`,'ok');
  document.getElementById('bcStatus').textContent=`✓ ${n}件に送信 — ${new Date().toLocaleTimeString('ja-JP')}`;
};
window.clearBcMsg=()=>{document.getElementById('bcMsg').value='';document.getElementById('bcStatus').textContent='';};
window.saveDefMsg=()=>{defaultForceMsg=document.getElementById('defMsg').value||defaultForceMsg;showToast('デフォルトメッセージ保存','ok');};

// ══ ROOM MESSAGE MODAL ══
let _msgRoom=null;
window.openMsgModal=code=>{_msgRoom=code;document.getElementById('msgRoomCode').textContent=code;document.getElementById('msgModal').classList.add('show');document.getElementById('msgInput').focus();};
window.closeMsgModal=()=>{document.getElementById('msgModal').classList.remove('show');_msgRoom=null;};
window.sendRoomMsg=async()=>{
  const msg=document.getElementById('msgInput').value.trim();
  if(!msg||!_msgRoom)return;
  await update(ref(db,`rooms/${_msgRoom}`),{sysMsg:msg,sysMsgTs:Date.now()}).catch(()=>{});
  addLog(`MSG to ROOM ${_msgRoom}: "${msg}"`,"info");
  showToast('メッセージ送信','ok');
  closeMsgModal();document.getElementById('msgInput').value='';
};
document.getElementById('msgInput').addEventListener('keydown',e=>{if(e.key==='Enter')window.sendRoomMsg();if(e.key==='Escape')window.closeMsgModal();});
document.getElementById('msgModal').addEventListener('click',e=>{if(e.target===document.getElementById('msgModal'))window.closeMsgModal();});

// ══ SETTINGS ACTIONS ══
window.toggleSiBody=id=>{const el=document.getElementById(id);el.classList.toggle('open');};

window.nukeAll=async()=>{
  const inp=document.getElementById('nukeConfIn').value;
  if(inp!=='NUKE'){showToast('「NUKE」と正確に入力してください','err');return;}
  try{
    // Force stop all first so players see the screen
    for(const code of Object.keys(roomsData)){
      await update(ref(db,`rooms/${code}`),{status:'force_ended',forceMsg:'システムメンテナンスのため強制終了しました'}).catch(()=>{});
    }
    await new Promise(r=>setTimeout(r,1500));
    await remove(ref(db,'rooms'));
    addLog('⚠ 全ルームNUKE実行','error');
    showToast('全ルームを削除しました','warn');
    document.getElementById('nukeConfIn').value='';
    toggleSiBody('nukeBody');
    roomsData={};updateStats();renderTables();
  }catch(e){addLog('NUKE失敗: '+e.message,'error');}
};

window.cleanupRooms=async()=>{
  let n=0;
  for(const[code,r]of Object.entries(roomsData)){
    if(r.status==='ended'||r.status==='force_ended'){
      await remove(ref(db,`rooms/${code}`)).catch(()=>{});n++;
    }
  }
  addLog(`クリーンアップ: ${n}件削除`,'success');showToast(`${n}件のルームを削除`,n>0?'ok':'warn');
};

window.stopAllActive=async()=>{
  const active=Object.entries(roomsData).filter(([,r])=>r.status==='ready'||r.status==='waiting');
  if(!active.length){showToast('アクティブなルームなし','warn');return;}
  for(const[code]of active)await window.forceStop(code);
  addLog(`全${active.length}ルームを強制停止（対戦中+待機中）`,'admin');
  showToast(`${active.length}ルームを強制停止`,'warn');
};

// ══ LOG ══
function addLog(msg,type='info'){
  const box=document.getElementById('logBox');
  const now=new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const el=document.createElement('div');el.className='log-entry';
  el.innerHTML=`<span class="log-ts">${now}</span><span class="log-msg ${type}">${msg}</span>`;
  box.prepend(el);
  while(box.children.length>300)box.lastChild.remove();
}
window.clearLog=()=>{document.getElementById('logBox').innerHTML='';};

// ══ PANEL NAV ══
window.gotoPanel=(name,el)=>{
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById(`panel-${name}`)?.classList.add('active');
  if(el)el.classList.add('active');
};

// ══ TOAST ══
function showToast(msg,type=''){
  const t=document.getElementById('toast');t.textContent=msg;t.className=`toast ${type} show`;
  setTimeout(()=>t.classList.remove('show'),3000);
}

// Expose for inline use
window.forceStop=window.forceStop;
