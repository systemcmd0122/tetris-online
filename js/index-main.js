import { initBackground } from './animations.js';

const COLORS = {I:'#00f5ff',O:'#ffff00',T:'#cc00ff',S:'#aaff00',Z:'#ff0040',J:'#0066ff',L:'#ff8800'};
const CNAMES = Object.keys(COLORS);

// ═══ PIXEL DECO ═══
(function(){
  const wrap = document.getElementById('pixelDeco');
  if(!wrap) return;
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
  if(!bar || !ld) return;
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
      ld.textContent = 'READY!';
      ld.style.color = '#aaff00';
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
    if(filled===4)  ld.textContent=msgs[1];
    if(filled===8)  ld.textContent=msgs[2];
    if(filled===N)  ld.textContent=msgs[3];
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

initBackground('bgCanvas');
