<template>
  <canvas ref="bgCanvas" id="bgCanvas"></canvas>
  <div class="scanlines"></div>
  <div class="scan-beam"></div>
  <router-view />
  <MusicPlayer v-if="showMusicPlayer" />
  <FeedbackWidget />
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import FeedbackWidget from './components/FeedbackWidget.vue';
import MusicPlayer from './components/MusicPlayer.vue';

const route = useRoute();
const bgCanvas = ref(null);
let animationId = null;

const showMusicPlayer = computed(() => {
  // Show music player on all routes except maybe specific ones if needed
  return true;
});

const COLORS = ['#00f5ff', '#ffff00', '#cc00ff', '#aaff00', '#ff0040', '#0066ff', '#ff8800'];
const CELL = 30;

const PIECE_MATS = {
  I: [[[1, 1, 1, 1]], [[1], [1], [1], [1]]],
  O: [[[1, 1], [1, 1]]],
  T: [[[0, 1, 0], [1, 1, 1]], [[1, 0], [1, 1], [1, 0]], [[1, 1, 1], [0, 1, 0]], [[0, 1], [1, 1], [0, 1]]],
  S: [[[0, 1, 1], [1, 1, 0]], [[1, 0], [1, 1], [0, 1]]],
  Z: [[[1, 1, 0], [0, 1, 1]], [[0, 1], [1, 1], [1, 0]]],
  J: [[[1, 0, 0], [1, 1, 1]], [[1, 1], [1, 0], [1, 0]], [[1, 1, 1], [0, 0, 1]], [[0, 1], [0, 1], [1, 1]]],
  L: [[[0, 0, 1], [1, 1, 1]], [[1, 0], [1, 0], [1, 1]], [[1, 1, 1], [1, 0, 0]], [[1, 1], [0, 1], [0, 1]]]
};

const CNAMES = Object.keys(PIECE_MATS);

onMounted(() => {
  const canvas = bgCanvas.value;
  const ctx = canvas.getContext('2d');
  let W, H;
  const pieces = [];

  const resize = () => {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  };

  const spawn = () => {
    const name = CNAMES[Math.floor(Math.random() * CNAMES.length)];
    const rots = PIECE_MATS[name];
    const mat = rots[Math.floor(Math.random() * rots.length)];
    return {
      mat,
      color: COLORS[CNAMES.indexOf(name)],
      x: Math.random() * W,
      y: -CELL * 4,
      vy: 0.5 + Math.random() * 1.5,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 0.8,
      sc: 0.55 + Math.random() * 0.9,
      alpha: 0.12 + Math.random() * 0.45
    };
  };

  for (let i = 0; i < 20; i++) {
    const p = spawn();
    p.y = Math.random() * H;
    pieces.push(p);
  }

  const drawBlock = (bx, by, color) => {
    ctx.fillStyle = color + 'bb';
    ctx.fillRect(bx + 1, by + 1, CELL - 2, CELL - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(bx + 1, by + 1, CELL - 2, 5);
    ctx.fillRect(bx + 1, by + 1, 5, CELL - 2);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(bx + 2, by + CELL - 4, CELL - 3, 3);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(bx + 0.5, by + 0.5, CELL - 1, CELL - 1);
  };

  const frame = () => {
    ctx.clearRect(0, 0, W, H);
    pieces.forEach((p, i) => {
      p.y += p.vy;
      p.rot += p.vr;
      const mh = p.mat.length * CELL * p.sc;
      if (p.y > H + mh * 2) pieces[i] = spawn();
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.scale(p.sc, p.sc);
      ctx.globalAlpha = p.alpha;
      const mw = p.mat[0].length,
        mhh = p.mat.length;
      const ox = (-mw * CELL) / 2,
        oy = (-mhh * CELL) / 2;
      p.mat.forEach((row, r) =>
        row.forEach((cell, c) => {
          if (cell) drawBlock(ox + c * CELL, oy + r * CELL, p.color);
        })
      );
      ctx.restore();
    });
    if (Math.random() < 0.015 && pieces.length < 24) pieces.push(spawn());
    animationId = requestAnimationFrame(frame);
  };

  resize();
  window.addEventListener('resize', resize);
  frame();
});

onUnmounted(() => {
  cancelAnimationFrame(animationId);
});
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Orbitron:wght@400;700;900&display=swap');

:root {
  --bg: #04060f;
  --s0: #080d18;
  --acc: #00f5ff;
  --acc2: #ff0080;
  --acc3: #aaff00;
  --tx: #e0f0ff;
  --dim: #4a6080;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: var(--bg);
  color: var(--tx);
  font-family: 'Orbitron', monospace;
  min-height: 100vh;
  overflow-x: hidden;
}

body.game-active {
  overflow: hidden;
  position: fixed;
  width: 100%;
}

#bgCanvas {
  position: fixed;
  inset: 0;
  z-index: 0;
}

.scanlines {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: repeating-linear-gradient(0deg,
      transparent, transparent 2px, rgba(0, 0, 0, 0.18) 2px, rgba(0, 0, 0, 0.18) 4px);
}

.scan-beam {
  position: fixed;
  left: 0;
  right: 0;
  height: 140px;
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(180deg, transparent, rgba(0, 245, 255, 0.04) 40%, rgba(0, 245, 255, 0.07) 50%, rgba(0, 245, 255, 0.04) 60%, transparent);
  animation: scanBeam 7s linear infinite;
}

@keyframes scanBeam {
  0% { top: -140px; }
  100% { top: 100vh; }
}

.container {
  position: relative;
  z-index: 10;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}
</style>
