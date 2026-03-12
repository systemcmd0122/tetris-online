export function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.classList.remove('show'), 3000);
}

let timeOffset = 0;
export function initServerTime(db, onValue, ref) {
  onValue(ref(db, '.info/serverTimeOffset'), snap => {
    timeOffset = snap.val() || 0;
  });
}
export function getServerTime() { return Date.now() + timeOffset; }

export function playSound(type, ctx, enabled) {
  if (!enabled || !ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (type === 'move') { osc.type = 'square'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.05); gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.05); osc.start(); osc.stop(now + 0.05); }
  else if (type === 'rotate') { osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(200, now + 0.05); gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.05); osc.start(); osc.stop(now + 0.05); }
  else if (type === 'drop') { osc.type = 'triangle'; osc.frequency.setValueAtTime(100, now); osc.frequency.exponentialRampToValueAtTime(10, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.1); osc.start(); osc.stop(now + 0.1); }
  else if (type === 'clear') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15); gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.15); osc.start(); osc.stop(now + 0.15); }
  else if (type === 'attack') { osc.type = 'square'; osc.frequency.setValueAtTime(100, now); osc.frequency.setValueAtTime(200, now + 0.05); osc.frequency.setValueAtTime(100, now + 0.1); gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.2); osc.start(); osc.stop(now + 0.2); }
  else if (type === 'countdown') { osc.type = 'sine'; osc.frequency.setValueAtTime(440, now); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.1); osc.start(); osc.stop(now + 0.1); }
  else if (type === 'go') { osc.type = 'sine'; osc.frequency.setValueAtTime(880, now); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.3); osc.start(); osc.stop(now + 0.3); }
  else if (type === 'win') { [0, 0.1, 0.2].forEach(d => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.setValueAtTime(523.25 * (1 + d), now + d); g.gain.setValueAtTime(0.05, now + d); g.gain.linearRampToValueAtTime(0, now + d + 0.3); o.start(now + d); o.stop(now + d + 0.3); }); }
}
