import { APP_VERSION, UPDATE_LOG } from '../config.js';

const COLORS = {I:'#00f5ff',O:'#ffff00',T:'#cc00ff',S:'#aaff00',Z:'#ff0040',J:'#0066ff',L:'#ff8800'};
const CNAMES = Object.keys(COLORS);

// ═══ PIXEL DECO ═══
(function(){
  const wrap = document.getElementById('pixelDeco');
  if(!wrap) return;
  // I-piece row + T-piece row
  const rows = [
    ['I','I','I','I'],
    [null,'T','T','T',null],
    [null,null,'T',null,null]
  ];
  rows.forEach(row => {
    const div = document.createElement('div');
    div.className = 'px-row';
    row.forEach(c => {
      const px = document.createElement('div');
      if(c) { px.className = `px px-${c}`; } else { px.style.width='13px'; px.style.height='13px'; }
      div.appendChild(px);
    });
    wrap.appendChild(div);
  });
})();

// ═══ TETROMINO LOADER ═══
(function(){
  const bar = document.getElementById('tetroBar');
  const ld = document.getElementById('ldText');
  if(!bar) return;
  const N = 12;
  const bColors = [COLORS.I,COLORS.J,COLORS.T,COLORS.S,COLORS.O,COLORS.Z,COLORS.L,
                   COLORS.I,COLORS.J,COLORS.T,COLORS.S,COLORS.O];
  const blocks = [];
  for(let i=0;i<N;i++){
    const b = document.createElement('div');
    b.className='tb-block';
    bar.appendChild(b);
    blocks.push(b);
  }

  let filled = 0;
  const msgs = ['LOADING...','CONNECTING...','INITIALIZING...','READY!'];
  const fillNext = () => {
    if(filled >= N){
      if(ld) {
        ld.textContent = 'READY!';
        ld.style.color = '#aaff00';
      }
      setTimeout(()=>{
        const ls = document.getElementById('loadingScreen');
        if(ls) {
            ls.classList.add('fade-out');
            setTimeout(()=>ls.remove(),700);
        }
      },350);
      return;
    }
    const b = blocks[filled];
    const col = bColors[filled];
    b.classList.add('lit');
    b.style.background = col;
    b.style.boxShadow = `0 0 14px ${col}, 0 0 5px ${col}`;
    b.style.borderColor = col;
    filled++;
    if(ld) {
        if(filled===4)  ld.textContent=msgs[1];
        if(filled===8)  ld.textContent=msgs[2];
        if(filled===N)  ld.textContent=msgs[3];
    }
    if(filled===N){
      setTimeout(()=>{
        blocks.forEach(b=>{ b.style.background='rgba(255,255,255,0.9)'; b.style.boxShadow='0 0 20px #fff'; });
        setTimeout(()=>{ blocks.forEach(b=>{ b.style.background=''; b.style.boxShadow=''; b.classList.remove('lit'); }); },120);
      },0);
    }
    setTimeout(fillNext, 60 + Math.random()*80);
  };
  setTimeout(fillNext, 500);

  const PIECE_MATS = {
    I:[[1,1,1,1]], O:[[1,1],[1,1]], T:[[0,1,0],[1,1,1]],
    S:[[0,1,1],[1,1,0]], Z:[[1,1,0],[0,1,1]], J:[[1,0,0],[1,1,1]], L:[[0,0,1],[1,1,1]]
  };
  const ls = document.getElementById('loadingScreen');
  if(ls) {
      for(let i=0;i<8;i++){
        const name = CNAMES[i%CNAMES.length];
        const mat = PIECE_MATS[name];
        const div = document.createElement('div');
        div.className='ld-piece';
        div.style.gridTemplateColumns=`repeat(${mat[0].length},12px)`;
        div.style.left = (8+Math.random()*84)+'%';
        div.style.animationDuration = (3+Math.random()*4)+'s';
        div.style.animationDelay = (Math.random()*3)+'s';
        mat.flat().forEach(cell=>{
          const b=document.createElement('div');
          b.className='ld-pb';
          b.style.background = cell ? COLORS[name]+'cc' : 'transparent';
          if(cell) b.style.boxShadow=`0 0 5px ${COLORS[name]}`;
          div.appendChild(b);
        });
        ls.appendChild(div);
      }
  }
})();

// ═══ FALLING BG ═══
(function(){
  const canvas=document.getElementById('bgCanvas');
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  const CELL=30;
  const PIECE_MATS={
    I:[[[1,1,1,1]],[[1],[1],[1],[1]]],
    O:[[[1,1],[1,1]]],
    T:[[[0,1,0],[1,1,1]],[[1,0],[1,1],[1,0]],[[1,1,1],[0,1,0]],[[0,1],[1,1],[0,1]]],
    S:[[[0,1,1],[1,1,0]],[[1,0],[1,1],[0,1]]],
    Z:[[[1,1,0],[0,1,1]],[[0,1],[1,1],[1,0]]],
    J:[[[1,0,0],[1,1,1]],[[1,1],[1,0],[1,0]],[[1,1,1],[0,0,1]],[[0,1],[0,1],[1,1]]],
    L:[[[0,0,1],[1,1,1]],[[1,0],[1,0],[1,1]],[[1,1,1],[1,0,0]],[[1,1],[0,1],[0,1]]]
  };
  let W,H; const pieces=[];
  function resize(){ W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight; }
  resize(); window.addEventListener('resize',resize);

  function spawn(){
    const name=CNAMES[Math.random()*CNAMES.length|0];
    const rots=PIECE_MATS[name];
    const mat=rots[Math.random()*rots.length|0];
    return {
      mat, color:COLORS[name],
      x: Math.random()*W, y:-CELL*4,
      vy: 0.5+Math.random()*1.5,
      rot: Math.random()*360,
      vr: (Math.random()-.5)*0.8,
      sc: 0.55+Math.random()*0.9,
      alpha: 0.12+Math.random()*0.45
    };
  }
  for(let i=0;i<20;i++){ const p=spawn(); p.y=Math.random()*H; pieces.push(p); }

  function drawBlock(bx,by,color){
    ctx.fillStyle=color+'bb'; ctx.fillRect(bx+1,by+1,CELL-2,CELL-2);
    ctx.fillStyle='rgba(255,255,255,.22)'; ctx.fillRect(bx+1,by+1,CELL-2,5);
    ctx.fillRect(bx+1,by+1,5,CELL-2);
    ctx.fillStyle='rgba(0,0,0,.28)'; ctx.fillRect(bx+2,by+CELL-4,CELL-3,3);
    ctx.strokeStyle=color; ctx.lineWidth=.8; ctx.strokeRect(bx+.5,by+.5,CELL-1,CELL-1);
  }

  function frame(){
    ctx.clearRect(0,0,W,H);
    pieces.forEach((p,i)=>{
      p.y+=p.vy; p.rot+=p.vr;
      const mh=p.mat.length*CELL*p.sc;
      if(p.y>H+mh*2) pieces[i]=spawn();
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rot*Math.PI/180);
      ctx.scale(p.sc,p.sc);
      ctx.globalAlpha=p.alpha;
      const mw=p.mat[0].length,mhh=p.mat.length;
      const ox=-mw*CELL/2, oy=-mhh*CELL/2;
      p.mat.forEach((row,r)=>row.forEach((cell,c)=>{ if(cell) drawBlock(ox+c*CELL,oy+r*CELL,p.color); }));
      ctx.restore();
    });
    if(Math.random()<.015 && pieces.length<24) pieces.push(spawn());
    requestAnimationFrame(frame);
  }
  frame();
})();

// ═══ VERSION & UPDATE NOTIFICATION ═══
window.closeUpdateModal = () => {
    localStorage.setItem('lastSeenVersion', APP_VERSION);
    const mo = document.getElementById('updateModalOverlay');
    if(mo) mo.classList.remove('show');
};

(function(){
  const vd = document.getElementById('versionDisp');
  if(vd) vd.textContent = `VER ${APP_VERSION}`;

  const lastSeen = localStorage.getItem('lastSeenVersion');
  if (lastSeen !== APP_VERSION) {
    const latest = UPDATE_LOG[0];
    const uv = document.getElementById('umVersion'); if(uv) uv.textContent = `Ver. ${latest.version}`;
    const ut = document.getElementById('umTitle'); if(ut) ut.textContent = latest.title;
    const list = document.getElementById('umList');
    if(list) {
        list.innerHTML = '';
        latest.changes.forEach(change => {
          const li = document.createElement('li');
          li.textContent = change;
          list.appendChild(li);
        });
    }

    setTimeout(() => {
      const mo = document.getElementById('updateModalOverlay');
      if(mo) mo.classList.add('show');
    }, 2000);
  }
})();
