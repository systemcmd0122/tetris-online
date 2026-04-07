<template>
  <div class="profile-view" v-if="user">
    <div class="logo">MY PROFILE</div>

    <div class="profile-card">
      <div class="user-info">
        <img :src="profilePhoto" class="avatar" @error="onAvatarError">
        <div class="details">
          <div class="name-row">
            <input v-if="isEditing" v-model="editName" class="edit-input" maxlength="20">
            <h2 v-else>{{ profile?.displayName || user.displayName }}</h2>
            <button @click="toggleEdit">{{ isEditing ? 'SAVE' : 'EDIT' }}</button>
          </div>
          <p class="email">{{ user.email }}</p>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-item"><span class="label">MULTI GAMES</span><span class="val">{{ profile?.totalMultiGames || 0 }}</span></div>
        <div class="stat-item"><span class="label">MULTI WINS</span><span class="val">{{ profile?.totalWins || 0 }}</span></div>
        <div class="stat-item"><span class="label">SPRINT BEST</span><span class="val">{{ formatTime(profile?.bestSprintMs) }}</span></div>
        <div class="stat-item"><span class="label">TOTAL LINES</span><span class="val">{{ profile?.totalLinesCleared || 0 }}</span></div>
      </div>
    </div>

    <div class="history-section">
      <h3>SPRINT HISTORY</h3>
      <div v-for="h in sprintHistory" :key="h.id" class="history-item">
        <span>{{ formatDate(h.ts) }}</span>
        <span class="highlight">{{ formatTime(h.ms) }}</span>
        <span>Score: {{ h.score }}</span>
      </div>
    </div>

    <router-link to="/" class="back-btn">◀ メニューに戻る</router-link>
  </div>
  <div v-else class="login-required">
    <p>プロフィールを表示するにはログインが必要です。</p>
    <router-link to="/" class="back-btn">トップへ戻る</router-link>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { onAuthReady, getCachedProfile, refreshProfile } from '../logic/auth';
import { getUserProfile, getSprintHistory, updateUserName } from '../logic/db';

const user = ref(null);
const profile = ref(null);
const sprintHistory = ref([]);
const isEditing = ref(false);
const editName = ref('');

onMounted(() => {
  onAuthReady(async (u) => {
    user.value = u;
    if (u) {
      profile.value = await getUserProfile(u.uid);
      sprintHistory.value = await getSprintHistory(u.uid, 10);
      editName.value = profile.value?.displayName || u.displayName || 'PLAYER';
    }
  });
});

const profilePhoto = computed(() => profile.value?.customPhotoURL || profile.value?.photoURL || user.value?.photoURL);
const onAvatarError = (e) => { e.target.src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'; };

const toggleEdit = async () => {
  if (isEditing.value) {
    if (editName.value.trim()) {
      await updateUserName(user.value.uid, editName.value);
      profile.value = await refreshProfile();
    }
  }
  isEditing.value = !isEditing.value;
};

const formatTime = (ms) => {
  if (ms == null) return '--:--.---';
  const min = Math.floor(ms / 60000), sec = Math.floor((ms % 60000) / 1000), msi = ms % 1000;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(msi).padStart(3, '0')}`;
};

const formatDate = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ja-JP');
};
</script>

<style scoped>
.profile-view { padding: 40px 20px; max-width: 600px; margin: 0 auto; z-index: 10; position: relative; }
.logo { font-family: 'Press Start 2P', monospace; font-size: 24px; color: var(--acc); text-align: center; margin-bottom: 30px; }
.profile-card { background: var(--s0); border: 1px solid var(--acc); border-radius: 4px; padding: 20px; margin-bottom: 30px; }
.user-info { display: flex; gap: 20px; align-items: center; margin-bottom: 20px; }
.avatar { width: 80px; height: 80px; border-radius: 50%; border: 3px solid var(--acc); }
.details { flex: 1; }
.name-row { display: flex; gap: 10px; align-items: center; }
.edit-input { background: #000; border: 1px solid var(--acc); color: #fff; padding: 5px; font-family: 'Orbitron'; }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.stat-item { background: rgba(0,245,255,0.05); padding: 10px; border-radius: 4px; display: flex; flex-direction: column; }
.label { font-size: 9px; color: var(--dim); }
.val { font-family: 'Press Start 2P', monospace; font-size: 14px; color: var(--acc3); }
.history-section h3 { font-family: 'Press Start 2P', monospace; font-size: 12px; color: var(--acc2); margin-bottom: 15px; }
.history-item { display: flex; justify-content: space-between; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 4px; margin-bottom: 5px; font-size: 13px; }
.highlight { color: var(--acc3); font-weight: bold; }
.back-btn { display: inline-block; padding: 12px 24px; background: var(--acc); color: #000; text-decoration: none; font-family: 'Press Start 2P', monospace; font-size: 10px; margin-top: 20px; border-radius: 2px; }
.login-required { text-align: center; padding: 100px 20px; }
</style>
