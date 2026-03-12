let audioCtx = null;
export let soundEnabled = true;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

export function playSound(type) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const g = ctx.createGain();
    g.connect(ctx.destination);
    const o = ctx.createOscillator();
    o.connect(g);
    const now = ctx.currentTime;
    switch (type) {
      case 'move':
        o.frequency.setValueAtTime(220, now);
        g.gain.setValueAtTime(.03, now);
        g.gain.exponentialRampToValueAtTime(.001, now + .05);
        o.start(now);
        o.stop(now + .05);
        break;
      case 'rotate':
        o.frequency.setValueAtTime(330, now);
        o.frequency.exponentialRampToValueAtTime(440, now + .06);
        g.gain.setValueAtTime(.05, now);
        g.gain.exponentialRampToValueAtTime(.001, now + .06);
        o.start(now);
        o.stop(now + .06);
        break;
      case 'lock':
        o.type = 'square';
        o.frequency.setValueAtTime(180, now);
        g.gain.setValueAtTime(.06, now);
        g.gain.exponentialRampToValueAtTime(.001, now + .08);
        o.start(now);
        o.stop(now + .08);
        break;
      case 'clear1':
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(440, now);
        o.frequency.exponentialRampToValueAtTime(880, now + .15);
        g.gain.setValueAtTime(.08, now);
        g.gain.exponentialRampToValueAtTime(.001, now + .15);
        o.start(now);
        o.stop(now + .15);
        break;
      case 'tetris':
        [440, 554, 659, 880].forEach((f, i) => {
          const o2 = ctx.createOscillator(), g2 = ctx.createGain();
          o2.connect(g2);
          g2.connect(ctx.destination);
          o2.frequency.setValueAtTime(f, now + i * .07);
          g2.gain.setValueAtTime(.1, now + i * .07);
          g2.gain.exponentialRampToValueAtTime(.001, now + i * .07 + .15);
          o2.start(now + i * .07);
          o2.stop(now + i * .07 + .15);
        });
        break;
      case 'harddrop':
        o.type = 'square';
        o.frequency.setValueAtTime(160, now);
        o.frequency.exponentialRampToValueAtTime(80, now + .1);
        g.gain.setValueAtTime(.12, now);
        g.gain.exponentialRampToValueAtTime(.001, now + .1);
        o.start(now);
        o.stop(now + .1);
        break;
      case 'attack':
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(660, now);
        o.frequency.exponentialRampToValueAtTime(110, now + .25);
        g.gain.setValueAtTime(.15, now);
        g.gain.exponentialRampToValueAtTime(.001, now + .25);
        o.start(now);
        o.stop(now + .25);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => {
          const o2 = ctx.createOscillator(), g2 = ctx.createGain();
          o2.connect(g2);
          g2.connect(ctx.destination);
          o2.type = 'triangle';
          o2.frequency.setValueAtTime(f, now + i * .12);
          g2.gain.setValueAtTime(.12, now + i * .12);
          g2.gain.exponentialRampToValueAtTime(.001, now + i * .12 + .3);
          o2.start(now + i * .12);
          o2.stop(now + i * .12 + .3);
        });
        break;
      case 'countdown':
        o.type = 'triangle';
        o.frequency.setValueAtTime(880, now);
        g.gain.setValueAtTime(.15, now);
        g.gain.exponentialRampToValueAtTime(.001, now + .2);
        o.start(now);
        o.stop(now + .2);
        break;
      case 'go':
        [880, 1320].forEach((f, i) => {
          const o2 = ctx.createOscillator(), g2 = ctx.createGain();
          o2.connect(g2);
          g2.connect(ctx.destination);
          o2.type = 'triangle';
          o2.frequency.setValueAtTime(f, now + i * .08);
          g2.gain.setValueAtTime(.18, now + i * .08);
          g2.gain.exponentialRampToValueAtTime(.001, now + i * .08 + .25);
          o2.start(now + i * .08);
          o2.stop(now + i * .08 + .25);
        });
        break;
    }
  } catch (e) { }
}

export function toggleSound() {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('soundBtn');
  if (btn) {
    btn.textContent = soundEnabled ? '🔊 ON' : '🔇 OFF';
    btn.className = soundEnabled ? 'sound-btn on' : 'sound-btn';
  }
}
