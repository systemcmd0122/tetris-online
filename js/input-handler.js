export const DAS = 167;
export const ARR = 33;
const keys = new Set();
let dasTimer = null;
let dasDir = 0;
let arrTimer = null;
let softDropInterval = null;

function dasStart(dir, game) {
  if (dasDir === dir) return;
  dasStop();
  dasDir = dir;
  game?.move(dir);
  dasTimer = setTimeout(() => {
    arrTimer = setInterval(() => {
      game?.move(dir);
    }, ARR);
  }, DAS);
}

export function dasStop() {
  clearTimeout(dasTimer);
  clearInterval(arrTimer);
  dasTimer = null;
  arrTimer = null;
  dasDir = 0;
}

export function initInput(getGame, getGameRunning) {
  document.addEventListener('keydown', e => {
    if (keys.has(e.code)) return;
    keys.add(e.code);
    const game = getGame();
    const gameRunning = getGameRunning();
    if (!game || !gameRunning) return;
    switch (e.code) {
      case 'ArrowLeft': e.preventDefault(); dasStart(-1, game); break;
      case 'ArrowRight': e.preventDefault(); dasStart(1, game); break;
      case 'ArrowUp': e.preventDefault(); game.rotate(1); break;
      case 'KeyX': e.preventDefault(); game.rotate(1); break;
      case 'KeyZ': e.preventDefault(); game.rotate(-1); break;
      case 'ArrowDown': e.preventDefault(); break; // handled by softdrop interval below
      case 'Space': e.preventDefault(); game.hardDrop(); break;
      case 'KeyC': e.preventDefault(); game.hold(); break;
      case 'ShiftLeft': e.preventDefault(); game.hold(); break;
      case 'ShiftRight': e.preventDefault(); game.hold(); break;
      case 'Shift': e.preventDefault(); game.hold(); break;
    }
  });

  document.addEventListener('keyup', e => {
    keys.delete(e.code);
    if (e.code === 'ArrowLeft' && dasDir === -1) dasStop();
    if (e.code === 'ArrowRight' && dasDir === 1) dasStop();
  });

  // Soft drop with continuous interval
  document.addEventListener('keydown', e => {
    const game = getGame();
    const gameRunning = getGameRunning();
    if (e.code === 'ArrowDown' && !softDropInterval && game && gameRunning) {
      e.preventDefault();
      game?.softDrop();
      softDropInterval = setInterval(() => {
        if (game && gameRunning) game.softDrop();
      }, 50);
    }
  });

  document.addEventListener('keyup', e => {
    if (e.code === 'ArrowDown') {
      clearInterval(softDropInterval);
      softDropInterval = null;
    }
  });

  function setupMobile(id, fn, repeat = false) {
    const btn = document.getElementById(id);
    if (!btn) return;
    let iv = null;
    const start = e => {
      e.preventDefault();
      const game = getGame();
      const gameRunning = getGameRunning();
      if (!game || !gameRunning) return;
      fn();
      if (repeat) iv = setInterval(() => {
        if (game && gameRunning) fn();
      }, repeat);
    };
    const stop = () => {
      clearInterval(iv);
      iv = null;
    };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', stop);
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', stop);
    btn.addEventListener('mouseleave', stop);
  }

  setupMobile('btnLeft', () => getGame()?.move(-1), ARR);
  setupMobile('btnRight', () => getGame()?.move(1), ARR);
  setupMobile('btnDown', () => getGame()?.softDrop(), 50);
  setupMobile('btnRotate', () => getGame()?.rotate(1), false);
  setupMobile('btnRotateL', () => getGame()?.rotate(-1), false);
  setupMobile('btnHardDrop', () => getGame()?.hardDrop(), false);
  setupMobile('btnHold', () => getGame()?.hold(), false);

  // Swipe down = hard drop
  (function () {
    let tx0 = 0, ty0 = 0;
    const cvs = document.getElementById('myCanvas');
    if (!cvs) return;
    cvs.addEventListener('touchstart', e => {
      tx0 = e.touches[0].clientX;
      ty0 = e.touches[0].clientY;
    }, { passive: true });
    cvs.addEventListener('touchend', e => {
      const game = getGame();
      const gameRunning = getGameRunning();
      if (!game || !gameRunning) return;
      const dx = e.changedTouches[0].clientX - tx0, dy = e.changedTouches[0].clientY - ty0;
      if (Math.abs(dy) > 50 && dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.5) game.hardDrop();
    }, { passive: true });
  })();
}
