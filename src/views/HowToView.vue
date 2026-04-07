<template>
  <div class="how-to-view">
    <div class="logo">HOW TO PLAY</div>
    <div class="version">VER {{ APP_VERSION }}</div>

    <section>
      <h2>基本的な操作方法</h2>
      <div class="controls-grid">
        <div class="key">← →</div><div>左右に移動</div>
        <div class="key">↑ / X</div><div>右回転</div>
        <div class="key">Z</div><div>左回転</div>
        <div class="key">↓</div><div>ソフトドロップ</div>
        <div class="key">SPACE</div><div>ハードドロップ</div>
        <div class="key">Shift / C</div><div>ホールド</div>
      </div>
    </section>

    <section>
      <h2>対戦の仕組み</h2>
      <p>ラインを消して相手に<span class="highlight">お邪魔ブロック</span>を送りましょう。</p>
      <ul>
        <li>2ライン: 1ライン送信</li>
        <li>3ライン: 2ライン送信</li>
        <li>4ライン: 4ライン送信</li>
      </ul>
    </section>

    <router-link to="/" class="back-btn">◀ メニューに戻る</router-link>
  </div>
</template>

<script setup>
import { APP_VERSION } from '../logic/config';
</script>

<style scoped>
.how-to-view { padding: 40px 20px; max-width: 800px; margin: 0 auto; line-height: 1.6; z-index: 10; position: relative; }
.logo { font-family: 'Press Start 2P', monospace; font-size: 32px; color: var(--acc); text-align: center; margin-bottom: 20px; }
.version { text-align: center; font-size: 9px; color: var(--dim); margin-bottom: 40px; }
h2 { font-family: 'Press Start 2P', monospace; font-size: 14px; color: var(--acc2); border-bottom: 2px solid var(--acc2); padding-bottom: 5px; margin: 30px 0 15px; }
.controls-grid { display: grid; grid-template-columns: auto 1fr; gap: 10px 20px; background: var(--s0); padding: 20px; border-radius: 4px; border: 1px solid var(--dim); }
.key { background: #1a2540; border: 1px solid var(--acc); color: var(--acc); padding: 4px 10px; border-radius: 3px; font-family: monospace; font-weight: bold; min-width: 60px; text-align: center; }
.highlight { color: var(--acc3); font-weight: bold; }
.back-btn { display: inline-block; padding: 12px 24px; background: var(--acc); color: #000; text-decoration: none; font-family: 'Press Start 2P', monospace; font-size: 10px; margin-top: 40px; border-radius: 2px; }
</style>
