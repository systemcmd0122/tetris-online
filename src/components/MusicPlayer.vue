<template>
  <div class="music-player" :class="{ open: isOpen }">
    <!-- Bar -->
    <div class="music-bar">
      <button class="toggle-btn" @click="isOpen = !isOpen" :class="{ active: isOpen }">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <line x1="4" y1="17" x2="4" y2="7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="14" y1="14.5" x2="14" y2="4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="4" y1="7" x2="14" y2="4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <ellipse cx="3" cy="17.5" rx="3" ry="2.2" fill="currentColor" transform="rotate(-15 3 17.5)"/>
          <ellipse cx="13" cy="15" rx="3" ry="2.2" fill="currentColor" transform="rotate(-15 13 15)"/>
        </svg>
      </button>
      <div class="bar-info">
        <div class="np-label">{{ currentPlaylistName || 'MUSIC' }}</div>
        <div class="np-title" :title="currentTrack?.title">{{ currentTrack?.title || '曲を選んでください' }}</div>
      </div>
      <div class="controls">
        <button class="tr-btn" @click="playPrev" title="前の曲">⏮</button>
        <button class="tr-btn play-pause" @click="togglePlay" :title="isPlaying ? '一時停止' : '再生'">{{ isPlaying ? '⏸' : '▶' }}</button>
        <button class="tr-btn" @click="playNext" title="次の曲">⏭</button>
      </div>
      <div class="vol-row">
        <span class="vol-icon">{{ volume == 0 ? '🔇' : '🔊' }}</span>
        <input type="range" v-model="volume" min="0" max="100" @input="updateVolume">
      </div>
    </div>

    <!-- Drawer -->
    <transition name="drawer">
      <div class="music-drawer" v-if="isOpen">
        <div class="drawer-header">
          <span>♫ MUSIC PLAYER</span>
          <button class="close-drawer" @click="isOpen = false">✕</button>
        </div>
        <div class="tabs">
          <div class="tab" :class="{ active: activeTab === 'search' }" @click="activeTab = 'search'">SEARCH</div>
          <div class="tab" :class="{ active: activeTab === 'queue' }" @click="activeTab = 'queue'">QUEUE ({{ queue.length }})</div>
          <div class="tab" :class="{ active: activeTab === 'playlists' }" @click="activeTab = 'playlists'">LIST ({{ playlists.length }})</div>
        </div>

        <!-- Search Panel -->
        <div v-if="activeTab === 'search'" class="tab-panel">
          <div class="search-box">
            <input v-model="searchQuery" placeholder="曲名・ジャンルで検索..." @keydown.enter="search">
            <button @click="search" :disabled="searching">GO</button>
          </div>
          <div class="genre-quick">
            <button v-for="g in genres" :key="g.l" class="genre-btn" @click="searchGenre(g.q)">{{ g.l }}</button>
          </div>
          <div class="results-list">
            <div v-for="item in searchResults" :key="item.id" class="result-item" @click="addAndPlay(item)">
              <img :src="item.thumb" class="thumb">
              <div class="info">
                <div class="title" v-html="item.title"></div>
                <div class="channel">{{ item.channel }}</div>
              </div>
              <div class="add-icon" @click.stop="showPlaylistSelector(item)">＋</div>
            </div>
          </div>
        </div>

        <!-- Queue Panel -->
        <div v-if="activeTab === 'queue'" class="tab-panel">
          <div class="results-list">
            <div v-for="(item, index) in queue" :key="index" class="result-item" :class="{ playing: currentTrack?.id === item.id }" @click="playIdx(index)">
              <span class="q-index">{{ index + 1 }}</span>
              <div class="info"><div class="title" v-html="item.title"></div></div>
              <button class="del-btn" @click.stop="removeFromQueue(index)">✕</button>
            </div>
          </div>
          <div class="panel-footer" v-if="queue.length > 0">
            <button class="footer-btn" @click="clearQueue">🗑 クリア</button>
          </div>
        </div>

        <!-- Playlists Panel -->
        <div v-if="activeTab === 'playlists'" class="tab-panel">
          <div v-if="!selectedPlId" class="results-list">
            <div class="list-actions">
               <button class="footer-btn" @click="createNewPlaylist">＋ 新規作成</button>
            </div>
            <div v-for="pl in playlists" :key="pl.id" class="result-item" @click="selectedPlId = pl.id">
              <span class="q-index">♫</span>
              <div class="info">
                <div class="title">{{ pl.name }}</div>
                <div class="channel">{{ pl.songs?.length || 0 }} 曲</div>
              </div>
              <span class="arrow">›</span>
            </div>
          </div>
          <div v-else class="tab-panel">
            <div class="pl-header">
              <button class="back-btn" @click="selectedPlId = null">◀ 戻る</button>
              <div class="pl-name">{{ currentSelectedPl?.name }}</div>
              <button class="del-btn" @click="deletePlaylist(selectedPlId)">🗑</button>
            </div>
            <div class="results-list">
              <div v-for="(s, i) in currentSelectedPl?.songs" :key="s.id" class="result-item" @click="playPlaylist(selectedPlId, i)">
                <span class="q-index">{{ i + 1 }}</span>
                <div class="info"><div class="title" v-html="s.title"></div></div>
                <button class="del-btn" @click.stop="removeSongFromPl(selectedPlId, s.id)">✕</button>
              </div>
              <div v-if="!currentSelectedPl?.songs?.length" class="empty-msg">曲がありません</div>
            </div>
            <div class="panel-footer" v-if="currentSelectedPl?.songs?.length">
              <button class="footer-btn" @click="playPlaylist(selectedPlId, 0)">▶ 全曲再生</button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Playlist Selector Popover -->
    <div v-if="showPlSelector" class="pl-selector" :style="selectorStyle">
      <div class="sel-head">追加先を選択</div>
      <div class="sel-items">
        <div v-for="pl in playlists" :key="pl.id" class="sel-item" @click="addToPlaylist(pl.id)">{{ pl.name }}</div>
        <div class="sel-item new" @click="createNewPlFromSelector">＋ 新規作成</div>
      </div>
    </div>

    <div id="yt-hidden-player"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref as dbRef, onValue, set, update, remove as dbRemove } from 'firebase/database';
import { FB_CONFIG } from '../logic/config';

const isOpen = ref(false);
const activeTab = ref('search');
const isPlaying = ref(false);
const currentTrack = ref(null);
const playingPlId = ref(null);
const searchQuery = ref('');
const searchResults = ref([]);
const searching = ref(false);
const queue = ref(JSON.parse(localStorage.getItem('yt_queue') || '[]'));
const volume = ref(localStorage.getItem('yt_vol') || 70);

const playlists = ref(JSON.parse(localStorage.getItem('tb_playlists_v2') || '[]'));
const selectedPlId = ref(null);
const showPlSelector = ref(false);
const selectorItem = ref(null);
const selectorStyle = ref({});

const YT_KEY = 'AIzaSyCZbk49tTvV6sgnbMOMCwDbQWG28NfEroY';
const FB_PATH = 'multi/shared_playlists';

let player = null;
const app = getApps().length ? getApp() : initializeApp(FB_CONFIG);
const db = getDatabase(app);

const genres = [
  {l:'TETRIS', q:'tetris music remix'},
  {l:'TECHNO', q:'techno gaming music'},
  {l:'EDM', q:'gaming house mix'},
  {l:'CHILL', q:'lofi study gaming'}
];

onMounted(() => {
  if (!window.YT) {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  }

  window.onYouTubeIframeAPIReady = () => {
    player = new window.YT.Player('yt-hidden-player', {
      height: '0', width: '0',
      playerVars: { 'autoplay': 0, 'controls': 0, 'disablekb': 1 },
      events: {
        onReady: () => player.setVolume(volume.value),
        onStateChange: (e) => {
          if (e.data === window.YT.PlayerState.PLAYING) isPlaying.value = true;
          if (e.data === window.YT.PlayerState.PAUSED) isPlaying.value = false;
          if (e.data === window.YT.PlayerState.ENDED) playNext();
        },
        onError: () => playNext()
      }
    });
  };

  // Cloud Sync
  onValue(dbRef(db, FB_PATH), snap => {
    const remote = Object.values(snap.val() || {});
    if (!remote.length) return;
    const local = [...playlists.value];
    let changed = false;
    remote.forEach(rp => {
      const idx = local.findIndex(p => p.id === rp.id);
      if (idx === -1) { local.push(rp); changed = true; }
      else if ((rp.updatedAt || 0) > (local[idx].updatedAt || 0)) { local[idx] = rp; changed = true; }
    });
    if (changed) {
      playlists.value = local.sort((a,b) => (a.createdAt||0) - (b.createdAt||0));
      saveLocal();
    }
  });

  window.addEventListener('click', () => showPlSelector.value = false);
});

const saveLocal = () => localStorage.setItem('tb_playlists_v2', JSON.stringify(playlists.value));
const cloudPush = (pl) => set(dbRef(db, `${FB_PATH}/${pl.id}`), pl);
const cloudRemove = (id) => dbRemove(dbRef(db, `${FB_PATH}/${id}`));

const currentPlaylistName = computed(() => {
  if (!playingPlId.value) return null;
  return playlists.value.find(p => p.id === playingPlId.value)?.name;
});

const currentSelectedPl = computed(() => playlists.value.find(p => p.id === selectedPlId.value));

const search = async () => {
  if (!searchQuery.value) return;
  searching.value = true;
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=15&q=${encodeURIComponent(searchQuery.value)}&key=${YT_KEY}`);
    const d = await r.json();
    searchResults.value = d.items.map(i => ({
      id: i.id.videoId, title: i.snippet.title, channel: i.snippet.channelTitle,
      thumb: i.snippet.thumbnails?.default?.url
    }));
  } catch (e) { console.error(e); }
  finally { searching.value = false; }
};

const searchGenre = (q) => { searchQuery.value = q; search(); };

const playIdx = (idx) => {
  if (idx < 0 || idx >= queue.value.length) return;
  currentTrack.value = queue.value[idx];
  player.loadVideoById(currentTrack.value.id);
  player.playVideo();
  isPlaying.value = true;
};

const playNext = () => {
  if (!queue.value.length) return;
  let idx = queue.value.findIndex(q => q.id === currentTrack.value?.id) + 1;
  if (idx >= queue.value.length) idx = 0;
  playIdx(idx);
};

const playPrev = () => {
  if (!queue.value.length) return;
  let idx = queue.value.findIndex(q => q.id === currentTrack.value?.id) - 1;
  if (idx < 0) idx = queue.value.length - 1;
  playIdx(idx);
};

const togglePlay = () => {
  if (!player) return;
  const s = player.getPlayerState();
  if (s === 1) player.pauseVideo();
  else if (s === 2) player.playVideo();
  else if (queue.value.length) playIdx(0);
};

const updateVolume = () => {
  if (player) player.setVolume(volume.value);
  localStorage.setItem('yt_vol', volume.value);
};

const clearQueue = () => { queue.value = []; localStorage.removeItem('yt_queue'); };
const removeFromQueue = (idx) => { queue.value.splice(idx, 1); localStorage.setItem('yt_queue', JSON.stringify(queue.value)); };

const showPlaylistSelector = (item, e) => {
  selectorItem.value = item;
  showPlSelector.value = true;
  // position logic would go here
  selectorStyle.value = { bottom: '70px', right: '20px' };
};

const addToPlaylist = (plId) => {
  const pl = playlists.value.find(p => p.id === plId);
  if (!pl) return;
  if (!pl.songs) pl.songs = [];
  if (!pl.songs.some(s => s.id === selectorItem.value.id)) {
    pl.songs.push(selectorItem.value);
    pl.updatedAt = Date.now();
    saveLocal(); cloudPush(pl);
  }
};

const createNewPlaylist = () => {
  const name = prompt('プレイリスト名を入力してください');
  if (!name) return;
  const pl = { id: Date.now() + '', name, songs: [], createdAt: Date.now(), updatedAt: Date.now() };
  playlists.value.push(pl);
  saveLocal(); cloudPush(pl);
};

const createNewPlFromSelector = () => {
  createNewPlaylist();
  const pl = playlists.value[playlists.value.length - 1];
  if (pl) addToPlaylist(pl.id);
};

const deletePlaylist = (id) => {
  if (confirm('このプレイリストを削除しますか？')) {
    playlists.value = playlists.value.filter(p => p.id !== id);
    saveLocal(); cloudRemove(id);
    selectedPlId.value = null;
  }
};

const removeSongFromPl = (plId, songId) => {
  const pl = playlists.value.find(p => p.id === plId);
  if (pl) {
    pl.songs = pl.songs.filter(s => s.id !== songId);
    pl.updatedAt = Date.now();
    saveLocal(); cloudPush(pl);
  }
};

const playPlaylist = (plId, startIdx = 0) => {
  const pl = playlists.value.find(p => p.id === plId);
  if (!pl || !pl.songs?.length) return;
  queue.value = [...pl.songs];
  playingPlId.value = plId;
  playIdx(startIdx);
};

watch(currentTrack, (v) => {
  if (v) localStorage.setItem('yt_nowplaying', JSON.stringify(v));
  else localStorage.removeItem('yt_nowplaying');
});
</script>

<style scoped>
.music-player { position: fixed; bottom: 0; left: 0; right: 0; z-index: 2000; font-family: 'Orbitron', sans-serif; }
.music-bar { height: 60px; background: rgba(8, 13, 24, 0.95); border-top: 1px solid rgba(0, 245, 255, 0.2); display: flex; align-items: center; padding: 0 15px; gap: 15px; backdrop-filter: blur(10px); }
.toggle-btn { background: rgba(170, 255, 0, 0.08); border: 1px solid rgba(170, 255, 0, 0.2); color: #aaff00; cursor: pointer; padding: 8px; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
.toggle-btn.active { background: rgba(0, 245, 255, 0.15); border-color: #00f5ff; color: #00f5ff; }
.bar-info { flex: 1; min-width: 0; }
.np-label { font-family: 'Press Start 2P'; font-size: 7px; color: #aaff00; margin-bottom: 2px; }
.np-title { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #00f5ff; font-weight: bold; }
.controls { display: flex; gap: 6px; }
.tr-btn { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #e0f0ff; cursor: pointer; padding: 6px 12px; border-radius: 2px; }
.play-pause { color: #aaff00; border-color: rgba(170, 255, 0, 0.3); min-width: 44px; }
.vol-row { display: flex; align-items: center; gap: 10px; width: 100px; }
input[type=range] { flex: 1; height: 3px; accent-color: #00f5ff; }

.music-drawer { position: absolute; bottom: 60px; left: 0; right: 0; height: 450px; background: rgba(8, 13, 24, 0.98); border-top: 2px solid #00f5ff; display: flex; flex-direction: column; box-shadow: 0 -10px 40px rgba(0,0,0,0.8); }
.drawer-header { padding: 12px 15px; border-bottom: 1px solid rgba(0, 245, 255, 0.15); display: flex; justify-content: space-between; font-family: 'Press Start 2P'; font-size: 9px; color: #00f5ff; }
.close-drawer { background: none; border: none; color: #4a6080; cursor: pointer; font-size: 18px; }

.tabs { display: flex; background: rgba(0,0,0,0.2); }
.tab { flex: 1; padding: 12px; text-align: center; font-family: 'Press Start 2P'; font-size: 8px; color: #4a6080; cursor: pointer; }
.tab.active { color: #00f5ff; border-bottom: 2px solid #00f5ff; background: rgba(0,245,255,0.05); }

.tab-panel { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.search-box { padding: 12px; display: flex; gap: 8px; }
.search-box input { flex: 1; background: #000; border: 1px solid #243050; color: #fff; padding: 10px; border-radius: 4px; outline: none; }
.search-box button { background: #00f5ff; color: #000; border: none; padding: 0 15px; border-radius: 4px; font-family: 'Press Start 2P'; font-size: 9px; cursor: pointer; }

.genre-quick { display: flex; gap: 6px; padding: 0 12px 10px; overflow-x: auto; }
.genre-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #4a6080; padding: 5px 10px; border-radius: 3px; font-family: 'Press Start 2P'; font-size: 6px; cursor: pointer; white-space: nowrap; }

.results-list { flex: 1; overflow-y: auto; }
.result-item { display: flex; gap: 12px; padding: 10px 15px; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; align-items: center; }
.result-item.playing { background: rgba(0,245,255,0.05); }
.thumb { width: 48px; height: 36px; object-fit: cover; }
.info { flex: 1; min-width: 0; }
.title { font-size: 11px; color: #e0f0ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.channel { font-size: 9px; color: #4a6080; }
.add-icon { color: #aaff00; font-size: 20px; opacity: 0.5; padding: 0 10px; }
.del-btn { color: #ff0080; background: none; border: none; cursor: pointer; padding: 5px; }

.panel-footer { padding: 10px; border-top: 1px solid #1a2540; display: flex; justify-content: flex-end; }
.footer-btn { background: transparent; border: 1px solid #ff0080; color: #ff0080; padding: 6px 12px; border-radius: 3px; font-family: 'Press Start 2P'; font-size: 7px; cursor: pointer; }

.pl-header { display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #1a2540; gap: 10px; }
.back-btn { background: transparent; border: 1px solid #00f5ff; color: #00f5ff; padding: 5px 10px; font-family: 'Press Start 2P'; font-size: 7px; cursor: pointer; }
.pl-name { flex: 1; font-weight: bold; color: #ff0080; }

.pl-selector { position: fixed; background: #0d1525; border: 1px solid #00f5ff; border-radius: 6px; width: 180px; z-index: 2100; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
.sel-head { font-family: 'Press Start 2P'; font-size: 7px; color: #00f5ff; padding: 10px; border-bottom: 1px solid #1a2540; }
.sel-item { padding: 10px; font-size: 12px; cursor: pointer; }
.sel-item:hover { background: rgba(0,245,255,0.1); }
.sel-item.new { color: #aaff00; border-top: 1px solid #1a2540; }

.empty-msg { text-align: center; padding: 40px; color: #4a6080; font-size: 10px; }
.arrow { color: #4a6080; }

.drawer-enter-active, .drawer-leave-active { transition: transform 0.3s ease; }
.drawer-enter-from, .drawer-leave-to { transform: translateY(100%); }
</style>
