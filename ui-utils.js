/**
 * ui-utils.js — 共通UIユーティリティ
 * 背景アニメーション、ローディング、画面遷移などを一元管理する。
 */

/**
 * 背景のミノ落下アニメーションを初期化する
 */
export function initBgCanvas() {
  const cv = document.getElementById('bgCanvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const C = { I: '#00f5ff', O: '#ffff00', T: '#cc00ff', S: '#aaff00', Z: '#ff0040', J: '#0066ff', L: '#ff8800' };
  const N = Object.keys(C);
  const SZ = 28;
  const PM = {
    I: [[[1, 1, 1, 1]]],
    O: [[[1, 1], [1, 1]]],
    T: [[[0, 1, 0], [1, 1, 1]]],
    S: [[[0, 1, 1], [1, 1, 0]]],
    Z: [[[1, 1, 0], [0, 1, 1]]],
    J: [[[1, 0, 0], [1, 1, 1]]],
    L: [[[0, 0, 1], [1, 1, 1]]]
  };
  let W, H;
  const ps = [];

  function resize() {
    W = cv.width = window.innerWidth;
    H = cv.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function spawn() {
    const nm = N[Math.random() * N.length | 0];
    return {
      mat: PM[nm][0],
      color: C[nm],
      x: Math.random() * W,
      y: -SZ * 4,
      vy: 0.4 + Math.random() * 1.2,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 0.7,
      sc: 0.5 + Math.random() * 0.9,
      alpha: 0.1 + Math.random() * 0.4
    };
  }

  for (let i = 0; i < 18; i++) {
    const p = spawn();
    p.y = Math.random() * H;
    ps.push(p);
  }

  function drawBlock(bx, by, color) {
    ctx.fillStyle = color + 'aa';
    ctx.fillRect(bx + 1, by + 1, SZ - 2, SZ - 2);
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.fillRect(bx + 1, by + 1, SZ - 2, 5);
    ctx.fillRect(bx + 1, by + 1, 5, SZ - 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.7;
    ctx.strokeRect(bx + 0.5, by + 0.5, SZ - 1, SZ - 1);
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    ps.forEach((p, i) => {
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y > H + SZ * p.sc * 4) ps[i] = spawn();
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.scale(p.sc, p.sc);
      ctx.globalAlpha = p.alpha;
      const mw = p.mat[0].length, mh = p.mat.length, ox = -mw * SZ / 2, oy = -mh * SZ / 2;
      p.mat.forEach((row, r) => row.forEach((cell, c) => {
        if (cell) drawBlock(ox + c * SZ, oy + r * SZ, p.color);
      }));
      ctx.restore();
    });
    if (Math.random() < 0.012 && ps.length < 22) ps.push(spawn());
    requestAnimationFrame(frame);
  }
  frame();
}

/**
 * ページローダーの初期化とアニメーション
 * @param {string} initialText - 初期表示テキスト
 * @param {string} readyText - 完了直前テキスト
 */
export function initPageLoader(initialText = 'CONNECTING...', readyText = 'READY!') {
  const loader = document.getElementById('pageLoader');
  const bar = document.getElementById('plBar');
  const txt = document.getElementById('plText');
  if (!loader || !bar) return;

  const bc = ['#00f5ff', '#ffff00', '#cc00ff', '#aaff00', '#ff0040', '#0066ff', '#ff8800', '#00f5ff', '#ffff00', '#cc00ff'];
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
    b.style.background = bc[f];
    b.style.boxShadow = '0 0 14px ' + bc[f];
    b.style.borderColor = bc[f];
    f++;
    if (f === 4) txt.textContent = initialText;
    if (f === 8) txt.textContent = readyText;
    setTimeout(next, 55 + Math.random() * 75);
  };
  setTimeout(next, 200);
}

/**
 * 画面を切り替える
 * @param {string} id - 表示する画面のID
 */
export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  document.body.classList.toggle('game-active', id === 'gameScreen');
}

/**
 * アクションポップアップ（"TETRIS!" など）を表示する
 * @param {string} label - 表示テキスト
 */
export function showActionPopup(label) {
  const p = document.getElementById('actionPopup');
  if (!p) return;
  p.textContent = label.replace('\n', ' / ');
  p.classList.remove('show');
  void p.offsetWidth; // reflow
  p.classList.add('show');
}
