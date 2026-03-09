import { initializeApp }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, off, update, remove, onDisconnect, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const fbApp = initializeApp({
  apiKey:            "AIzaSyCjYKsc8eT9gDXEMQsfI0ZJ7UeuLwrDTxw",
  authDomain:        "tetris-online-9c827.firebaseapp.com",
  databaseURL:       "https://tetris-online-9c827-default-rtdb.firebaseio.com",
  projectId:         "tetris-online-9c827",
  storageBucket:     "tetris-online-9c827.firebasestorage.app",
  messagingSenderId: "1045054992314",
  appId:             "1:1045054992314:web:7fea20b9be543d7cab3783"
});
const db = getDatabase(fbApp);
document.getElementById('statusText').textContent = 'ONLINE';
document.getElementById('statusText').className   = 'status-online';

// ═══════════════════════════════════════════════════════════════
// SOUND ENGINE (Web Audio API)
// ═══════════════════════════════════════════════════════════════
let audioCtx = null;
let soundEnabled = true;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playSound(type) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const g = ctx.createGain();
    g.connect(ctx.destination);
    const o = ctx.createOscillator();
    o.connect(g);
    const now = ctx.currentTime;
    switch(type) {
      case 'move':
        o.frequency.setValueAtTime(220, now);
        g.gain.setValueAtTime(0.03, now);
        g.gain.exponentialRampToValueAtTime(0.001, now+0.05);
        o.start(now); o.stop(now+0.05); break;
      case 'rotate':
        o.frequency.setValueAtTime(330, now);
        o.frequency.exponentialRampToValueAtTime(440, now+0.06);
        g.gain.setValueAtTime(0.05, now);
        g.gain.exponentialRampToValueAtTime(0.001, now+0.06);
        o.start(now); o.stop(now+0.06); break;
      case 'lock':
        o.type = 'square';
        o.frequency.setValueAtTime(180, now);
        g.gain.setValueAtTime(0.06, now);
        g.gain.exponentialRampToValueAtTime(0.001, now+0.08);
        o.start(now); o.stop(now+0.08); break;
      case 'clear1':
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(440, now);
        o.frequency.exponentialRampToValueAtTime(880, now+0.15);
        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.001, now+0.15);
        o.start(now); o.stop(now+0.15); break;
      case 'tetris':
        [440,554,659,880].forEach((f,i)=>{
          const o2=ctx.createOscillator(); const g2=ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          o2.frequency.setValueAtTime(f, now+i*0.07);
          g2.gain.setValueAtTime(0.1, now+i*0.07);
          g2.gain.exponentialRampToValueAtTime(0.001, now+i*0.07+0.15);
          o2.start(now+i*0.07); o2.stop(now+i*0.07+0.15);
        }); break;
      case 'harddrop':
        o.type = 'square';
        o.frequency.setValueAtTime(160, now);
        o.frequency.exponentialRampToValueAtTime(80, now+0.1);
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now+0.1);
        o.start(now); o.stop(now+0.1); break;
      case 'attack':
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(660, now);
        o.frequency.exponentialRampToValueAtTime(110, now+0.25);
        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.001, now+0.25);
        o.start(now); o.stop(now+0.25); break;
      case 'win':
        [523,659,784,1047].forEach((f,i)=>{
          const o2=ctx.createOscillator(); const g2=ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination); o2.type='triangle';
          o2.frequency.setValueAtTime(f, now+i*0.12);
          g2.gain.setValueAtTime(0.12, now+i*0.12);
          g2.gain.exponentialRampToValueAtTime(0.001, now+i*0.12+0.3);
          o2.start(now+i*0.12); o2.stop(now+i*0.12+0.3);
        }); break;
    }
  } catch(e) {}
}

window.toggleSound = () => {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('soundBtn');
  btn.textContent = soundEnabled ? '🔊 ON' : '🔇 OFF';
  btn.className = soundEnabled ? 'sound-btn on' : 'sound-btn';
};

// ═══════════════════════════════════════════════════════════════
// TETRIS ENGINE
// ═══════════════════════════════════════════════════════════════
const COLS = 10, ROWS = 20, CELL = 20;
const COLORS = {
  I:'#00f5ff', O:'#ffff00', T:'#cc00ff',
  S:'#aaff00', Z:'#ff0040', J:'#0066ff', L:'#ff8800',
  GHOST:'rgba(255,255,255,0.10)'
};
const PIECES = {
  I:[[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],[[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],[[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],[[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]]],
  O:[[[1,1],[1,1]],[[1,1],[1,1]],[[1,1],[1,1]],[[1,1],[1,1]]],
  T:[[[0,1,0],[1,1,1],[0,0,0]],[[0,1,0],[0,1,1],[0,1,0]],[[0,0,0],[1,1,1],[0,1,0]],[[0,1,0],[1,1,0],[0,1,0]]],
  S:[[[0,1,1],[1,1,0],[0,0,0]],[[0,1,0],[0,1,1],[0,0,1]],[[0,0,0],[0,1,1],[1,1,0]],[[1,0,0],[1,1,0],[0,1,0]]],
  Z:[[[1,1,0],[0,1,1],[0,0,0]],[[0,0,1],[0,1,1],[0,1,0]],[[0,0,0],[1,1,0],[0,1,1]],[[0,1,0],[1,1,0],[1,0,0]]],
  J:[[[1,0,0],[1,1,1],[0,0,0]],[[0,1,1],[0,1,0],[0,1,0]],[[0,0,0],[1,1,1],[0,0,1]],[[0,1,0],[0,1,0],[1,1,0]]],
  L:[[[0,0,1],[1,1,1],[0,0,0]],[[0,1,0],[0,1,0],[0,1,1]],[[0,0,0],[1,1,1],[1,0,0]],[[1,1,0],[0,1,0],[0,1,0]]]
};
const NAMES = Object.keys(PIECES);
const KICKS_JLSTZ = {
  '0->R':[[ 0,0],[-1,0],[-1, 1],[0,-2],[-1,-2]],'R->0':[[ 0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2]],
  'R->2':[[ 0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2]],'2->R':[[ 0,0],[-1,0],[-1, 1],[0,-2],[-1,-2]],
  '2->L':[[ 0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2]],'L->2':[[ 0,0],[-1,0],[-1,-1],[0, 2],[-1, 2]],
  'L->0':[[ 0,0],[-1,0],[-1,-1],[0, 2],[-1, 2]],'0->L':[[ 0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2]]
};
const KICKS_I = {
  '0->R':[[ 0,0],[-2,0],[ 1,0],[-2,-1],[ 1, 2]],'R->0':[[ 0,0],[ 2,0],[-1,0],[ 2, 1],[-1,-2]],
  'R->2':[[ 0,0],[-1,0],[ 2,0],[-1, 2],[ 2,-1]],'2->R':[[ 0,0],[ 1,0],[-2,0],[ 1,-2],[-2, 1]],
  '2->L':[[ 0,0],[ 2,0],[-1,0],[ 2, 1],[-1,-2]],'L->2':[[ 0,0],[-2,0],[ 1,0],[-2,-1],[ 1, 2]],
  'L->0':[[ 0,0],[ 1,0],[-2,0],[ 1,-2],[-2, 1]],'0->L':[[ 0,0],[-1,0],[ 2,0],[-1, 2],[ 2,-1]]
};
const ROT_NAMES = ['0','R','2','L'];
const LINE_SCORES  = [0, 100, 300, 500, 800];
const TSPIN_SCORES = [400, 800, 1200, 1600];
const B2B_MULT = 1.5;
const LOCK_DELAY = 500;
const MAX_RESETS = 15;

class Bag {
  constructor() { this.q = []; }
  _refill() {
    const b=[...NAMES];
    for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}
    this.q.push(...b);
  }
  next() { if(this.q.length<4)this._refill(); return this.q.shift(); }
  peek(n=1) { while(this.q.length<n+4)this._refill(); return this.q.slice(0,n); }
}

function makePiece(name) { return { name, rot:0, x:3, y:-1 }; }

class TetrisGame {
  constructor(cvsId, holdId, nextId) {
    this.cvs=document.getElementById(cvsId); this.ctx=this.cvs.getContext('2d');
    this.hCvs=holdId?document.getElementById(holdId):null; this.hCtx=this.hCvs?this.hCvs.getContext('2d'):null;
    this.nCvs=nextId?document.getElementById(nextId):null; this.nCtx=this.nCvs?this.nCvs.getContext('2d'):null;
    this.reset();
  }
  reset() {
    this.board=Array.from({length:ROWS+2},()=>Array(COLS).fill(null));
    this.bag=new Bag(); this.current=makePiece(this.bag.next());
    this.hold=null; this.canHold=true;
    this.score=0; this.lines=0; this.level=1; this.combo=0; this.b2b=false;
    this.gameOver=false; this.dropSpeed=800; this.lastDropTs=0;
    this.lockTimer=null; this.lockResets=0; this.isOnGround=false;
    this.lastAction=null; this.pendingGarbage=0;
  }
  _get(x,y){if(x<0||x>=COLS||y<-2||y>=ROWS)return y>=ROWS?'WALL':null;return this.board[y+2][x];}
  _set(x,y,v){if(y<-2||y>=ROWS||x<0||x>=COLS)return;this.board[y+2][x]=v;}
  matrix(p=this.current){return PIECES[p.name][p.rot];}
  cells(p=this.current){const m=this.matrix(p),out=[];for(let r=0;r<m.length;r++)for(let c=0;c<m[r].length;c++)if(m[r][c])out.push([p.x+c,p.y+r]);return out;}
  valid(p,dx=0,dy=0,rot=null){const m=rot!==null?PIECES[p.name][rot]:this.matrix(p);for(let r=0;r<m.length;r++)for(let c=0;c<m[r].length;c++){if(!m[r][c])continue;const nx=p.x+c+dx,ny=p.y+r+dy;if(nx<0||nx>=COLS||ny>=ROWS)return false;if(ny>=0&&this._get(nx,ny))return false;}return true;}
  rotate(dir=1){
    const from=this.current.rot,to=(from+(dir>0?1:3))%4,key=`${ROT_NAMES[from]}->${ROT_NAMES[to]}`;
    const kicks=this.current.name==='I'?KICKS_I[key]:KICKS_JLSTZ[key];
    if(!kicks)return false;
    for(const[kdx,kdy]of kicks){if(this.valid(this.current,kdx,-kdy,to)){this.current.x+=kdx;this.current.y+=-kdy;this.current.rot=to;this.lastAction={type:'rotate',dir,kick:kdx!==0||kdy!==0};this._resetLock();playSound('rotate');return true;}}
    return false;
  }
  move(dx){if(this.valid(this.current,dx)){this.current.x+=dx;this.lastAction={type:'move'};this._resetLock();playSound('move');return true;}return false;}
  softDrop(){if(this.valid(this.current,0,1)){this.current.y++;this.score++;this.lastAction={type:'move'};this.isOnGround=false;this.lockTimer=null;return true;}return false;}
  hardDrop(){let d=0;while(this.valid(this.current,0,1)){this.current.y++;d++;}this.score+=d*2;this.lastAction={type:'hard'};playSound('harddrop');return this._lock();}
  ghostY(){let g=this.current.y;while(this.valid(this.current,0,g-this.current.y+1))g++;return g;}
  _resetLock(){if(this.isOnGround&&this.lockResets<MAX_RESETS){this.lockTimer=null;this.lockResets++;}}
  _isTSpin(){if(this.current.name!=='T'||!this.lastAction||this.lastAction.type!=='rotate')return false;const{x,y}=this.current;const corners=[[x,y],[x+2,y],[x,y+2],[x+2,y+2]];const filled=corners.filter(([cx,cy])=>cy<0||cy>=ROWS||cx<0||cx>=COLS||!!this._get(cx,cy));return filled.length>=3;}
  _lock(){
    for(const[cx,cy]of this.cells()){if(cy>=0)this._set(cx,cy,this.current.name);else{this.gameOver=true;}}
    const tspin=this._isTSpin(),cleared=this._clearLines();
    let pts=0,garbageOut=0,actionLabel='';
    const isSpecial=tspin||cleared===4;
    if(tspin){pts=TSPIN_SCORES[cleared]*this.level;const labels=['T-SPIN!','T-SPIN SINGLE!','T-SPIN DOUBLE!','T-SPIN TRIPLE!'];actionLabel=labels[cleared]||'T-SPIN!';garbageOut=[0,2,4,6][cleared]||0;}
    else if(cleared>0){pts=LINE_SCORES[cleared]*this.level;const labels=['','SINGLE','DOUBLE','TRIPLE','TETRIS!!'];actionLabel=labels[cleared];garbageOut=[0,0,1,2,4][cleared]||0;}
    if(isSpecial&&cleared>0){if(this.b2b){pts=Math.floor(pts*B2B_MULT);actionLabel+='\nBACK-TO-BACK!';}this.b2b=true;}
    else if(cleared>0&&!tspin){this.b2b=false;}
    if(cleared>0){this.combo++;if(this.combo>1){pts+=50*(this.combo-1)*this.level;garbageOut+=Math.floor(this.combo/2);if(!actionLabel)actionLabel=`COMBO x${this.combo}!`;else actionLabel+=`\nCOMBO x${this.combo}!`;}}else{this.combo=0;}
    this.score+=pts;
    if(cleared>0){this.lines+=cleared;this.level=Math.floor(this.lines/10)+1;this.dropSpeed=Math.max(50,800-(this.level-1)*70);
      if(cleared===4)playSound('tetris');else playSound('clear1');
    } else { playSound('lock'); }
    if(this.pendingGarbage>0){const cancel=Math.min(garbageOut,this.pendingGarbage);garbageOut-=cancel;this.pendingGarbage-=cancel;if(this.pendingGarbage>0){this._addGarbage(this.pendingGarbage);this.pendingGarbage=0;}}
    this.current=makePiece(this.bag.next());this.canHold=true;this.lockTimer=null;this.lockResets=0;this.isOnGround=false;this.lastAction=null;
    if(!this.valid(this.current)){this.current.y--;if(!this.valid(this.current))this.gameOver=true;}
    return{cleared,garbageOut,actionLabel};
  }
  _clearLines(){let n=0;for(let r=ROWS-1;r>=0;r--){if(this.board[r+2].every(c=>c!==null)){this.board.splice(r+2,1);this.board.unshift(Array(COLS).fill(null));n++;r++;}}return n;}
  _addGarbage(lines){const hole=Math.floor(Math.random()*COLS);for(let i=0;i<lines;i++){this.board.shift();const row=Array(COLS).fill('G');row[hole]=null;this.board.push(row);}while(!this.valid(this.current)&&this.current.y>-4)this.current.y--;}
  hold(){if(!this.canHold)return false;const name=this.current.name;if(this.hold){this.current=makePiece(this.hold);}else{this.current=makePiece(this.bag.next());}this.hold=name;this.canHold=false;this.lockTimer=null;this.lockResets=0;this.isOnGround=false;return true;}
  update(ts){
    if(this.gameOver)return null;
    const onGround=!this.valid(this.current,0,1);
    if(onGround){if(!this.isOnGround){this.isOnGround=true;this.lockTimer=ts;}if(ts-this.lockTimer>=LOCK_DELAY){this.isOnGround=false;return this._lock();}}
    else{this.isOnGround=false;this.lockTimer=null;if(ts-this.lastDropTs>=this.dropSpeed){this.lastDropTs=ts;this.current.y++;}}
    return null;
  }
  serialize(){const vis=this.board.slice(2).map(row=>row.map(c=>c||''));return{board:vis,score:this.score,lines:this.lines,level:this.level,gameOver:this.gameOver,cur:{name:this.current.name,rot:this.current.rot,x:this.current.x,y:this.current.y}};}
  draw(){
    const ctx=this.ctx;ctx.clearRect(0,0,this.cvs.width,this.cvs.height);
    ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=0.5;
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)ctx.strokeRect(c*CELL,r*CELL,CELL,CELL);
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const cell=this.board[r+2][c];if(cell)this._drawCell(ctx,c,r,cell==='G'?'#3a4060':COLORS[cell]);}
    const gy=this.ghostY();
    this.matrix().forEach((row,r)=>row.forEach((cell,c)=>{if(cell){const py=gy+r;if(py>=0){ctx.fillStyle=COLORS.GHOST;ctx.fillRect(c*CELL+this.current.x*CELL+1,py*CELL+1,CELL-2,CELL-2);}}}));
    if(this.isOnGround&&this.lockTimer!==null){const pct=1-Math.min(1,(performance.now()-this.lockTimer)/LOCK_DELAY);const cells=this.cells();const maxY=Math.max(...cells.map(c=>c[1]));cells.filter(([,cy])=>cy===maxY&&cy>=0).forEach(([cx,cy])=>{ctx.fillStyle=`rgba(255,255,255,${0.4*pct})`;ctx.fillRect(cx*CELL+1,cy*CELL+CELL-3,Math.floor((CELL-2)*pct),2);});}
    this.matrix().forEach((row,r)=>row.forEach((cell,c)=>{if(cell){const py=this.current.y+r;if(py>=0)this._drawCell(ctx,this.current.x+c,py,COLORS[this.current.name]);}}));
    if(this.gameOver){ctx.fillStyle='rgba(0,0,0,0.75)';ctx.fillRect(0,0,this.cvs.width,this.cvs.height);ctx.fillStyle='#ff0080';ctx.font='bold 13px "Press Start 2P"';ctx.textAlign='center';ctx.fillText('GAME',this.cvs.width/2,this.cvs.height/2-14);ctx.fillText('OVER',this.cvs.width/2,this.cvs.height/2+10);}
    if(this.nCtx)this._drawMini(this.nCtx,makePiece(this.bag.peek(1)[0]));
    if(this.hCtx){this.hCtx.clearRect(0,0,80,80);if(this.hold){this._drawMini(this.hCtx,makePiece(this.hold),this.canHold?1.0:0.4);}}
  }
  _drawCell(ctx,x,y,color){ctx.fillStyle=color+'dd';ctx.fillRect(x*CELL+1,y*CELL+1,CELL-2,CELL-2);ctx.fillStyle='rgba(255,255,255,0.22)';ctx.fillRect(x*CELL+1,y*CELL+1,CELL-2,3);ctx.fillRect(x*CELL+1,y*CELL+1,3,CELL-2);ctx.fillStyle='rgba(0,0,0,0.25)';ctx.fillRect(x*CELL+3,y*CELL+CELL-3,CELL-3,2);ctx.fillRect(x*CELL+CELL-3,y*CELL+3,2,CELL-3);}
  _drawMini(ctx,piece,alpha=1){const s=80,cs=16;ctx.clearRect(0,0,s,s);ctx.globalAlpha=alpha;const m=PIECES[piece.name][0];const ox=Math.floor((4-m[0].length)/2),oy=Math.floor((4-m.length)/2);m.forEach((row,r)=>row.forEach((cell,c)=>{if(cell){ctx.fillStyle=COLORS[piece.name]+'dd';ctx.fillRect((ox+c)*cs+1,(oy+r)*cs+1,cs-2,cs-2);ctx.fillStyle='rgba(255,255,255,0.2)';ctx.fillRect((ox+c)*cs+1,(oy+r)*cs+1,cs-2,3);}}));ctx.globalAlpha=1;}
  static drawOpponent(canvas, data) {
    if (!data||!data.board) return;
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=0.5;
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)ctx.strokeRect(c*CELL,r*CELL,CELL,CELL);
    data.board.forEach((row,r)=>row.forEach((cell,c)=>{if(!cell)return;const color=cell==='G'?'#3a4060':(COLORS[cell]||'#888');ctx.fillStyle=color+'cc';ctx.fillRect(c*CELL+1,r*CELL+1,CELL-2,CELL-2);ctx.fillStyle='rgba(255,255,255,0.15)';ctx.fillRect(c*CELL+1,r*CELL+1,CELL-2,3);}));
    if(data.cur&&PIECES[data.cur.name]){const m=PIECES[data.cur.name][data.cur.rot||0];const color=COLORS[data.cur.name]||'#888';m.forEach((row,r)=>row.forEach((cell,c)=>{if(cell){const py=data.cur.y+r;if(py>=0){ctx.fillStyle=color+'99';ctx.fillRect((data.cur.x+c)*CELL+1,py*CELL+1,CELL-2,CELL-2);}}}));}
    if(data.gameOver){ctx.fillStyle='rgba(0,0,0,0.75)';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#ff0080';ctx.font='bold 11px "Press Start 2P"';ctx.textAlign='center';ctx.fillText('GAME OVER',canvas.width/2,canvas.height/2);}
  }
}

// ═══════════════════════════════════════════════════════════════
// MULTIPLAYER STATE
// ═══════════════════════════════════════════════════════════════
let roomCode=null, myRole=null, game=null, gameRunning=false, animId=null;
let oppName='FOE', endedOnce=false;
let forceStopped = false;

// Generate 4-digit numeric room code
const genCode = () => Math.floor(1000+Math.random()*9000).toString();

// Active Firebase listeners (stored as refs for cleanup)
let _oppRef=null, _roomRef=null, _garbRef=null, _waitRef=null;
// onDisconnect handles
let _dcHandle=null;

function offAll() {
  if(_oppRef)  { try{off(_oppRef);}catch(e){}  _oppRef=null; }
  if(_roomRef) { try{off(_roomRef);}catch(e){} _roomRef=null; }
  if(_garbRef) { try{off(_garbRef);}catch(e){} _garbRef=null; }
  if(_waitRef) { try{off(_waitRef);}catch(e){} _waitRef=null; }
}

// ── FORCE STOP ────────────────────────────────────────────────
function showForceStop(msg) {
  if (forceStopped) return;
  forceStopped = true;
  gameRunning = false;
  endedOnce = true;
  if (animId) { cancelAnimationFrame(animId); animId=null; }
  offAll();
  document.getElementById('resultOverlay').classList.remove('show');
  document.getElementById('countdownOverlay').classList.remove('show');
  document.getElementById('forceStopMsg').textContent =
    msg || '管理者によってこのルームは強制終了されました。';
  document.getElementById('forceStopOverlay').classList.add('show');
}

// ── SYS MSG BANNER ────────────────────────────────────────────
let lastSysMsgTs = 0;
function handleSysMsg(data) {
  if (!data || !data.sysMsg || !data.sysMsgTs) return;
  if (data.sysMsgTs <= lastSysMsgTs) return;
  lastSysMsgTs = data.sysMsgTs;
  document.getElementById('sysMsgText').textContent = '📢 ' + data.sysMsg;
  document.getElementById('sysMsgBanner').classList.add('show');
  setTimeout(() => document.getElementById('sysMsgBanner').classList.remove('show'), 8000);
}

// ── COPY ROOM CODE ────────────────────────────────────────────
window.copyRoomCode = () => {
  if (!roomCode) return;
  navigator.clipboard?.writeText(roomCode).then(()=>{
    showToast('コードをコピーしました！', 'ok');
  }).catch(()=>{
    showToast('コード: ' + roomCode);
  });
};

// ── CREATE ROOM ───────────────────────────────────────────────
window.createRoom = async () => {
  const name = document.getElementById('playerName').value.trim()||'PLAYER';
  myRole='p1'; roomCode=genCode(); endedOnce=false; forceStopped=false;
  lastSysMsgTs=0;

  const rRef = ref(db, `rooms/${roomCode}`);
  await set(rRef, { p1:{name}, status:'waiting', ts:Date.now() });

  // Auto-remove room if p1 disconnects while waiting
  onDisconnect(rRef).remove();

  showScreen('waitingScreen');
  document.getElementById('displayRoomCode').textContent = roomCode;
  document.getElementById('statusRoom').textContent = `ROOM: ${roomCode}`;

  // Listen to full room node: catches force_ended AND ready
  _waitRef = ref(db, `rooms/${roomCode}`);
  onValue(_waitRef, snap => {
    const d = snap.val();
    if (!d) {
      // Room was deleted externally
      off(_waitRef); _waitRef=null;
      return;
    }
    handleSysMsg(d);
    if (d.status === 'force_ended') {
      off(_waitRef); _waitRef=null;
      showForceStop(d.forceMsg);
      return;
    }
    if (d.status === 'ready') {
      off(_waitRef); _waitRef=null;
      startGame();
    }
  });
};

// ── JOIN ROOM ─────────────────────────────────────────────────
window.joinRoom = async () => {
  const raw = document.getElementById('roomCodeInput').value.trim();
  const code = raw.replace(/\D/g, ''); // digits only
  if (code.length !== 4) { showToast('4桁の数字コードを入力してください'); return; }
  const name = document.getElementById('playerName').value.trim()||'PLAYER2';
  const rRef = ref(db, `rooms/${code}`);

  let snap;
  try {
    snap = await get(rRef);
  } catch(e) {
    showToast('接続エラーが発生しました');
    return;
  }

  if (!snap.exists()) { showToast('ルームが見つかりません'); return; }
  const d = snap.val();
  if (d.status === 'force_ended') { showToast('このルームは強制終了されています'); return; }
  if (d.status === 'ready')       { showToast('このルームは既にゲーム中です'); return; }
  if (d.status !== 'waiting')     { showToast('このルームには参加できません'); return; }
  if (d.p2)                       { showToast('このルームは満員です'); return; }

  myRole='p2'; roomCode=code; endedOnce=false; forceStopped=false; lastSysMsgTs=0;

  // Set p2 data and mark as ready atomically
  await update(rRef, { p2:{name}, status:'ready' });

  // Auto-cleanup p2 slot on disconnect
  onDisconnect(ref(db, `rooms/${roomCode}/p2`)).remove();

  document.getElementById('statusRoom').textContent = `ROOM: ${roomCode}`;
  startGame();
};

// ── LEAVE ROOM ────────────────────────────────────────────────
window.leaveRoom = () => {
  offAll();
  gameRunning = false;
  forceStopped = false;
  if (animId) { cancelAnimationFrame(animId); animId=null; }
  if (roomCode && db) {
    try {
      if (myRole==='p1') remove(ref(db, `rooms/${roomCode}`));
      else               update(ref(db, `rooms/${roomCode}`), {status:'ended'});
    } catch(e){}
  }
  document.getElementById('resultOverlay').classList.remove('show');
  document.getElementById('forceStopOverlay').classList.remove('show');
  document.getElementById('sysMsgBanner').classList.remove('show');
  document.getElementById('countdownOverlay').classList.remove('show');
  roomCode=null; myRole=null; game=null; endedOnce=false;
  showScreen('lobbyScreen');
};

// ── START GAME ────────────────────────────────────────────────
async function startGame() {
  showScreen('gameScreen');
  const oppRole = myRole==='p1'?'p2':'p1';

  let snap;
  try {
    snap = await get(ref(db, `rooms/${roomCode}`));
  } catch(e) {
    showToast('接続エラー');
    showScreen('lobbyScreen');
    return;
  }
  const data = snap.val();

  if (!data) {
    showToast('ルームが存在しません');
    showScreen('lobbyScreen');
    return;
  }

  // Check if force stopped before game even loads
  if (data.status === 'force_ended') {
    showForceStop(data.forceMsg);
    return;
  }

  const myName = data[myRole]?.name || 'YOU';
  oppName      = data[oppRole]?.name || 'FOE';
  document.getElementById('myNameTag').textContent  = myName;
  document.getElementById('oppNameTag').textContent = oppName;

  await countdown();

  game = new TetrisGame('myCanvas','holdCanvas','nextCanvas');
  gameRunning = true; endedOnce = false;

  // ── Listen: opponent board ──
  _oppRef = ref(db, `rooms/${roomCode}/game/${oppRole}`);
  onValue(_oppRef, snap => {
    const d = snap.val(); if (!d) return;
    TetrisGame.drawOpponent(document.getElementById('opponentCanvas'), d);
    document.getElementById('oppNameTag').textContent = `${oppName} (${d.score||0})`;
    if (d.gameOver && !game?.gameOver && gameRunning) endGame('WIN');
  });

  // ── Listen: full room node (force_ended + sysMsg + disconnection) ──
  _roomRef = ref(db, `rooms/${roomCode}`);
  onValue(_roomRef, snap => {
    const d = snap.val();
    if (!d) {
      if (gameRunning) endGame('DISCONNECT');
      return;
    }
    handleSysMsg(d);
    if (d.status === 'force_ended' && !forceStopped) {
      off(_roomRef); _roomRef=null;
      showForceStop(d.forceMsg);
      return;
    }
    if (d.status === 'ended' && gameRunning) {
      endGame('DISCONNECT');
    }
    // Detect opponent disconnect: their player slot removed
    if (gameRunning && !d[oppRole] && !endedOnce) {
      endGame('DISCONNECT');
    }
  });

  // ── Listen: incoming garbage ──
  _garbRef = ref(db, `rooms/${roomCode}/garb/${myRole}`);
  const oppGRef = ref(db, `rooms/${roomCode}/garb/${oppRole}`);
  onValue(_garbRef, snap => {
    const v = snap.val(); if (!v || !v.n || v.n <= 0) return;
    game.pendingGarbage += v.n;
    set(_garbRef, {n:0});
    flashAttack();
    playSound('attack');
  });

  let lastPushTs = 0;
  const PUSH_RATE = 66; // ~15fps for network updates

  // ── Game loop ──
  const loop = ts => {
    if (!gameRunning) return;
    const result = game.update(ts);
    game.draw();
    document.getElementById('scoreDisplay').textContent = game.score;
    document.getElementById('levelDisplay').textContent = game.level;
    document.getElementById('linesDisplay').textContent = game.lines;
    if (result && result.actionLabel) showActionPopup(result.actionLabel);

    if (ts - lastPushTs > PUSH_RATE) {
      lastPushTs = ts;
      const serial = game.serialize();
      set(ref(db, `rooms/${roomCode}/game/${myRole}`), serial).catch(()=>{});
      if (result && result.garbageOut > 0) {
        const gn = result.garbageOut;
        get(oppGRef).then(s => {
          const ex = s.val()?.n || 0;
          set(oppGRef, {n: ex + gn}).catch(()=>{});
        });
      }
    }

    if (game.gameOver) {
      // Push final state before ending
      set(ref(db, `rooms/${roomCode}/game/${myRole}`), game.serialize()).catch(()=>{});
      endGame('LOSE');
      return;
    }
    animId = requestAnimationFrame(loop);
  };
  animId = requestAnimationFrame(loop);
}

// ── END GAME ──────────────────────────────────────────────────
function endGame(result) {
  if (endedOnce) return;
  endedOnce = true; gameRunning = false;
  if (animId) { cancelAnimationFrame(animId); animId=null; }
  const title = document.getElementById('resultTitle');
  const sub   = document.getElementById('resultSub');
  const icon  = document.getElementById('resultIcon');
  const score = game?.score || 0;
  const lvl   = game?.level || 1;
  const lines = game?.lines || 0;
  if (result==='WIN') {
    title.className='overlay-title win';
    title.textContent='YOU WIN!';
    icon.textContent='🏆';
    playSound('win');
  } else if (result==='LOSE') {
    title.className='overlay-title lose';
    title.textContent='YOU LOSE';
    icon.textContent='💀';
  } else {
    title.className='overlay-title draw';
    title.textContent='OPPONENT LEFT';
    icon.textContent='🚪';
  }
  sub.innerHTML = `SCORE: ${score}&nbsp;&nbsp;|&nbsp;&nbsp;LEVEL: ${lvl}&nbsp;&nbsp;|&nbsp;&nbsp;LINES: ${lines}`;
  document.getElementById('resultOverlay').classList.add('show');
}

// ── COUNTDOWN ─────────────────────────────────────────────────
function countdown() {
  return new Promise(resolve => {
    const ov=document.getElementById('countdownOverlay');
    const num=document.getElementById('countdownNum');
    ov.classList.add('show'); let n=3;
    const tick = () => {
      num.style.animation='none'; num.offsetHeight;
      num.style.animation='countAnim .85s ease-out forwards';
      if(n>0){
        num.textContent=n;
        if(typeof window.launchCountdownBurst==='function') window.launchCountdownBurst(n);
        n--;
        setTimeout(tick,850);
      } else {
        num.textContent='GO!';
        setTimeout(()=>{ov.classList.remove('show');resolve();},850);
      }
    };
    tick();
  });
}

// ═══════════════════════════════════════════════════════════════
// INPUT
// ═══════════════════════════════════════════════════════════════
const DAS = 167, ARR = 33;
const keys = new Set();
let dasTimer=null, dasDir=0, arrTimer=null;

function dasStart(dir) {
  if(dasDir===dir)return; dasStop(); dasDir=dir;
  game?.move(dir);
  dasTimer=setTimeout(()=>{arrTimer=setInterval(()=>{game?.move(dir);},ARR);},DAS);
}
function dasStop(){clearTimeout(dasTimer);clearInterval(arrTimer);dasTimer=null;arrTimer=null;dasDir=0;}

document.addEventListener('keydown',e=>{
  if(keys.has(e.code))return; keys.add(e.code);
  if(!game||!gameRunning)return;
  switch(e.code){
    case'ArrowLeft':  e.preventDefault();dasStart(-1);break;
    case'ArrowRight': e.preventDefault();dasStart(1);break;
    case'ArrowUp':    e.preventDefault();game.rotate(1);break;
    case'KeyX':       e.preventDefault();game.rotate(1);break;
    case'KeyZ':       e.preventDefault();game.rotate(-1);break;
    case'ArrowDown':  e.preventDefault();break; // handled by interval below
    case'Space':      e.preventDefault();game.hardDrop();break;
    case'KeyC':       e.preventDefault();game.hold();break;
    case'ShiftLeft':  e.preventDefault();game.hold();break;
    case'ShiftRight': e.preventDefault();game.hold();break;
  }
});
document.addEventListener('keyup',e=>{
  keys.delete(e.code);
  if(e.code==='ArrowLeft'&&dasDir===-1)dasStop();
  if(e.code==='ArrowRight'&&dasDir===1)dasStop();
});

// Soft drop: separate interval for smooth repeat
let softDropInterval=null;
document.addEventListener('keydown',e=>{
  if(e.code==='ArrowDown'&&!softDropInterval&&game&&gameRunning){
    e.preventDefault();
    game.softDrop();
    softDropInterval=setInterval(()=>{if(game&&gameRunning)game.softDrop();},50);
  }
});
document.addEventListener('keyup',e=>{
  if(e.code==='ArrowDown'){clearInterval(softDropInterval);softDropInterval=null;}
});

function setupMobile(id,fn,repeat=false){
  const btn=document.getElementById(id);if(!btn)return;
  let iv=null;
  const start=e=>{e.preventDefault();if(!game||!gameRunning)return;fn();if(repeat)iv=setInterval(()=>{if(game&&gameRunning)fn();},repeat);};
  const stop=()=>{clearInterval(iv);iv=null;};
  btn.addEventListener('touchstart',start,{passive:false});
  btn.addEventListener('touchend',stop);
  btn.addEventListener('touchcancel',stop);
  btn.addEventListener('mousedown',start);
  btn.addEventListener('mouseup',stop);
  btn.addEventListener('mouseleave',stop);
}
setupMobile('btnLeft',()=>game?.move(-1),ARR);
setupMobile('btnRight',()=>game?.move(1),ARR);
setupMobile('btnDown',()=>game?.softDrop(),50);
setupMobile('btnRotate',()=>game?.rotate(1),false);
setupMobile('btnRotateL',()=>game?.rotate(-1),false);
setupMobile('btnHardDrop',()=>game?.hardDrop(),false);
setupMobile('btnHold',()=>game?.hold(),false);

// Swipe-down hard drop on canvas
(function(){
  let tx0=0,ty0=0;
  const cvs=document.getElementById('myCanvas');
  cvs.addEventListener('touchstart',e=>{tx0=e.touches[0].clientX;ty0=e.touches[0].clientY;},{passive:true});
  cvs.addEventListener('touchend',e=>{
    if(!game||!gameRunning)return;
    const dx=e.changedTouches[0].clientX-tx0,dy=e.changedTouches[0].clientY-ty0;
    if(Math.abs(dy)>50&&dy>0&&Math.abs(dy)>Math.abs(dx)*1.5)game.hardDrop();
  },{passive:true});
})();

// ═══════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function showToast(msg, type=''){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.className='toast'+(type?' '+type:'');
  t.classList.remove('show');
  t.offsetHeight;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
}
function flashAttack(){
  const f=document.getElementById('attackFlash');
  f.classList.add('show');
  setTimeout(()=>f.classList.remove('show'),280);
}
function showActionPopup(label){
  const p=document.getElementById('actionPopup');
  p.textContent=label.replace('\n',' / ');
  p.classList.remove('show');
  p.offsetHeight;
  p.classList.add('show');
}

// ── Input event: digits only, no toUpperCase needed ──
document.getElementById('roomCodeInput').addEventListener('keydown',e=>{
  if(e.key==='Enter') window.joinRoom();
});
document.getElementById('roomCodeInput').addEventListener('input',e=>{
  // Allow only digits
  e.target.value = e.target.value.replace(/\D/g,'').slice(0,4);
});
document.getElementById('playerName').addEventListener('keydown',e=>{
  if(e.key==='Enter') {
    const code = document.getElementById('roomCodeInput').value.trim();
    if(code.length===4) window.joinRoom();
    else window.createRoom();
  }
});
