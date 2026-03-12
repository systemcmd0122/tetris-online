export function initBackground(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const _C = { I: '#00f5ff', O: '#ffff00', T: '#cc00ff', S: '#aaff00', Z: '#ff0040', J: '#0066ff', L: '#ff8800' };
  const _N = Object.keys(_C);
  const CELL = 28;
  const PM = {
    I: [[[1, 1, 1, 1]], [[1], [1], [1], [1]]],
    O: [[[1, 1], [1, 1]]],
    T: [[[0, 1, 0], [1, 1, 1]], [[1, 0], [1, 1], [1, 0]]],
    S: [[[0, 1, 1], [1, 1, 0]]],
    Z: [[[1, 1, 0], [0, 1, 1]]],
    J: [[[1, 0, 0], [1, 1, 1]]],
    L: [[[0, 0, 1], [1, 1, 1]]]
  };
  let W, H;
  const pieces = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function spawn() {
    const name = _N[Math.random() * _N.length | 0];
    const rots = PM[name];
    const mat = rots[Math.random() * rots.length | 0];
    return {
      mat, color: _C[name], x: Math.random() * W, y: -CELL * 4,
      vy: .4 + Math.random() * 1.2, rot: Math.random() * 360,
      vr: (Math.random() - .5) * .7, sc: .5 + Math.random() * .9,
      alpha: .1 + Math.random() * .4
    };
  }

  for (let i = 0; i < 18; i++) {
    const p = spawn();
    p.y = Math.random() * H;
    pieces.push(p);
  }

  function drawBlock(bx, by, color) {
    ctx.fillStyle = color + 'aa';
    ctx.fillRect(bx + 1, by + 1, CELL - 2, CELL - 2);
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.fillRect(bx + 1, by + 1, CELL - 2, 5);
    ctx.fillRect(bx + 1, by + 1, 5, CELL - 2);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(bx + 2, by + CELL - 4, CELL - 3, 3);
    ctx.strokeStyle = color;
    ctx.lineWidth = .7;
    ctx.strokeRect(bx + .5, by + .5, CELL - 1, CELL - 1);
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    pieces.forEach((p, i) => {
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y > H + CELL * p.sc * 4) pieces[i] = spawn();
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.scale(p.sc, p.sc);
      ctx.globalAlpha = p.alpha;
      const mw = p.mat[0].length, mh = p.mat.length, ox = -mw * CELL / 2, oy = -mh * CELL / 2;
      p.mat.forEach((row, r) => row.forEach((cell, c) => {
        if (cell) drawBlock(ox + c * CELL, oy + r * CELL, p.color);
      }));
      ctx.restore();
    });
    if (Math.random() < .012 && pieces.length < 22) pieces.push(spawn());
    requestAnimationFrame(frame);
  }
  frame();
}

export function initPageLoader() {
  const loader = document.getElementById('pageLoader');
  const bar = document.getElementById('plBar');
  const txt = document.getElementById('plText');
  if (!loader || !bar) return;
  const bColors = ['#00f5ff', '#ffff00', '#cc00ff', '#aaff00', '#ff0040', '#0066ff', '#ff8800', '#00f5ff', '#ffff00', '#cc00ff'];
  const N = 10;
  for (let i = 0; i < N; i++) {
    const b = document.createElement('div');
    b.className = 'pl-b';
    bar.appendChild(b);
  }
  let f = 0;
  const next = () => {
    if (f >= N) {
      Array.from(bar.children).forEach(b => {
        b.style.background = 'rgba(255,255,255,.9)';
        b.style.boxShadow = '0 0 20px #fff';
      });
      setTimeout(() => {
        loader.classList.add('hide');
        setTimeout(() => { try { loader.remove(); } catch (e) { } }, 500);
      }, 150);
      return;
    }
    const b = bar.children[f];
    b.classList.add('lit');
    b.style.background = bColors[f];
    b.style.boxShadow = `0 0 14px ${bColors[f]}`;
    b.style.borderColor = bColors[f];
    f++;
    if (f === 4) txt.textContent = 'CONNECTING...';
    if (f === 8) txt.textContent = 'READY!';
    setTimeout(next, 55 + Math.random() * 75);
  };
  setTimeout(next, 200);
}

export function initAdminLoader() {
  const loader = document.getElementById('adminLoader');
  const bar = document.getElementById('alBar');
  const txt = document.getElementById('alTxt');
  if (!loader || !bar) return;
  const bC = ['#ff0080', '#cc00ff', '#0066ff', '#00f5ff', '#aaff00', '#ff8800', '#ff0040', '#ff0080'];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const b = document.createElement('div');
    b.className = 'al-b';
    bar.appendChild(b);
  }
  let f = 0;
  const next = () => {
    if (f >= N) {
      Array.from(bar.children).forEach(b => {
        b.style.background = 'rgba(255,255,255,.85)';
        b.style.boxShadow = '0 0 16px #fff';
      });
      setTimeout(() => {
        loader.classList.add('hide');
        setTimeout(() => { try { loader.remove(); } catch (e) { } }, 450);
      }, 130);
      return;
    }
    const b = bar.children[f];
    b.classList.add('lit');
    b.style.background = bC[f];
    b.style.boxShadow = `0 0 12px ${bC[f]}`;
    b.style.borderColor = bC[f];
    f++;
    if (f === 4) txt.textContent = 'CONNECTING...';
    if (f === 8) txt.textContent = 'READY!';
    setTimeout(next, 50 + Math.random() * 70);
  };
  setTimeout(next, 250);
}
