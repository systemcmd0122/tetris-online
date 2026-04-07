/**
 * sound.js — Web Audio API Sound Engine
 */

let _actx = null;
let _seOn = localStorage.getItem('tetris_se') !== 'off';

function _getCtx() {
  if (!_actx) {
    _actx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _actx;
}

const SE = {
  // Menu SE
  select() {
    const c = _getCtx(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = 'square';
    o.frequency.setValueAtTime(440, t); o.frequency.exponentialRampToValueAtTime(880, t + .08);
    g.gain.setValueAtTime(.18, t); g.gain.exponentialRampToValueAtTime(.001, t + .18);
    o.start(t); o.stop(t + .18);
  },
  click() {
    const c = _getCtx(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(660, t); o.frequency.exponentialRampToValueAtTime(330, t + .07);
    g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .1);
    o.start(t); o.stop(t + .1);
  },
  modalOpen() {
    const c = _getCtx(), t = c.currentTime;
    [523, 659, 784].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * .08); g.gain.linearRampToValueAtTime(.12, t + i * .08 + .03);
      g.gain.exponentialRampToValueAtTime(.001, t + i * .08 + .2); o.start(t + i * .08); o.stop(t + i * .08 + .2);
    });
  },
  modalClose() {
    const c = _getCtx(), t = c.currentTime;
    [784, 523].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(.1, t + i * .07); g.gain.exponentialRampToValueAtTime(.001, t + i * .07 + .15);
      o.start(t + i * .07); o.stop(t + i * .07 + .15);
    });
  },
  // Game SE
  move() {
    const c = _getCtx(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.frequency.setValueAtTime(220, t); g.gain.setValueAtTime(.03, t); g.gain.exponentialRampToValueAtTime(.001, t + .05);
    o.start(t); o.stop(t + .05);
  },
  rotate() {
    const c = _getCtx(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.frequency.setValueAtTime(330, t); o.frequency.exponentialRampToValueAtTime(440, t + .06);
    g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.001, t + .06);
    o.start(t); o.stop(t + .06);
  },
  lock() {
    const c = _getCtx(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = 'square';
    o.frequency.setValueAtTime(180, t); g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.001, t + .08);
    o.start(t); o.stop(t + .08);
  },
  clear1() {
    const c = _getCtx(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(440, t); o.frequency.exponentialRampToValueAtTime(880, t + .15);
    g.gain.setValueAtTime(.08, t); g.gain.exponentialRampToValueAtTime(.001, t + .15);
    o.start(t); o.stop(t + .15);
  },
  tetris() {
    const c = _getCtx(), t = c.currentTime;
    [440, 554, 659, 880].forEach((f, i) => {
      const o2 = c.createOscillator(), g2 = c.createGain();
      o2.connect(g2); g2.connect(c.destination);
      o2.frequency.setValueAtTime(f, t + i * .07);
      g2.gain.setValueAtTime(.1, t + i * .07); g2.gain.exponentialRampToValueAtTime(.001, t + i * .07 + .15);
      o2.start(t + i * .07); o2.stop(t + i * .07 + .15);
    });
  },
  harddrop() {
    const c = _getCtx(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = 'square';
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(80, t + .1);
    g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .1);
    o.start(t); o.stop(t + .1);
  },
  attack() {
    const c = _getCtx(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(660, t); o.frequency.exponentialRampToValueAtTime(110, t + .25);
    g.gain.setValueAtTime(.15, t); g.gain.exponentialRampToValueAtTime(.001, t + .25);
    o.start(t); o.stop(t + .25);
  },
  win() {
    const c = _getCtx(), t = c.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => {
      const o2 = c.createOscillator(), g2 = c.createGain();
      o2.connect(g2); g2.connect(c.destination); o2.type = 'triangle';
      o2.frequency.setValueAtTime(f, t + i * .12);
      g2.gain.setValueAtTime(.12, t + i * .12); g2.gain.exponentialRampToValueAtTime(.001, t + i * .12 + .3);
      o2.start(t + i * .12); o2.stop(t + i * .12 + .3);
    });
  },
  countdown() {
    const c = _getCtx(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(880, t); g.gain.setValueAtTime(.15, t); g.gain.exponentialRampToValueAtTime(.001, t + .2);
    o.start(t); o.stop(t + .2);
  },
  go() {
    const c = _getCtx(), t = c.currentTime;
    [880, 1320].forEach((f, i) => {
      const o2 = c.createOscillator(), g2 = c.createGain();
      o2.connect(g2); g2.connect(c.destination); o2.type = 'triangle';
      o2.frequency.setValueAtTime(f, t + i * .08);
      g2.gain.setValueAtTime(.18, t + i * .08); g2.gain.exponentialRampToValueAtTime(.001, t + i * .08 + .25);
      o2.start(t + i * .08); o2.stop(t + i * .08 + .25);
    });
  },
  elim() {
    const c = _getCtx(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(440, t); o.frequency.exponentialRampToValueAtTime(55, t + .4);
    g.gain.setValueAtTime(.2, t); g.gain.exponentialRampToValueAtTime(.001, t + .4);
    o.start(t); o.stop(t + .4);
  },
  complete() {
    const c = _getCtx(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = 'sine';
    o.frequency.setValueAtTime(1047, t); o.frequency.exponentialRampToValueAtTime(2094, t + .7);
    g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + .7);
    o.start(t); o.stop(t + .7);
  },
  fail() {
    const c = _getCtx(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(40, t + .4);
    g.gain.setValueAtTime(.3, t); g.gain.exponentialRampToValueAtTime(.001, t + .4);
    o.start(t); o.stop(t + .4);
  }
};

export const playSE = (name) => {
  if (!_seOn) return;
  try {
    if (SE[name]) SE[name]();
  } catch (e) {}
};

export const toggleSE = () => {
  _seOn = !_seOn;
  localStorage.setItem('tetris_se', _seOn ? 'on' : 'off');
  return _seOn;
};

export const isSEOn = () => _seOn;
