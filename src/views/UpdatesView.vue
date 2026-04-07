<template>
  <div class="updates-view">
    <div class="logo">UPDATES</div>
    <div v-for="log in UPDATE_LOG" :key="log.version" class="update-card">
      <div class="update-header">
        <span class="version">Ver. {{ log.version }}</span>
        <span class="title">{{ log.title }}</span>
      </div>
      <ul class="changes">
        <li v-for="(change, i) in log.changes" :key="i">{{ change }}</li>
      </ul>
    </div>
    <router-link to="/" class="back-btn">◀ メニューに戻る</router-link>
  </div>
</template>

<script setup>
import { UPDATE_LOG } from '../logic/config';
</script>

<style scoped>
.updates-view { padding: 40px 20px; max-width: 800px; margin: 0 auto; z-index: 10; position: relative; }
.logo { font-family: 'Press Start 2P', monospace; font-size: 32px; color: var(--acc2); text-align: center; margin-bottom: 40px; }
.update-card { background: var(--s0); border: 1px solid var(--dim); border-radius: 4px; padding: 20px; margin-bottom: 20px; }
.update-header { margin-bottom: 15px; border-bottom: 1px solid var(--dim); padding-bottom: 10px; display: flex; gap: 15px; align-items: baseline; }
.version { font-family: 'Press Start 2P', monospace; font-size: 12px; color: var(--acc); }
.title { font-weight: bold; font-size: 16px; }
.changes { list-style: none; padding-left: 0; }
.changes li { margin-bottom: 10px; position: relative; padding-left: 20px; font-size: 14px; }
.changes li::before { content: '▶'; position: absolute; left: 0; color: var(--acc3); font-size: 10px; top: 3px; }
.back-btn { display: inline-block; padding: 12px 24px; background: var(--acc); color: #000; text-decoration: none; font-family: 'Press Start 2P', monospace; font-size: 10px; margin-top: 20px; border-radius: 2px; }
</style>
