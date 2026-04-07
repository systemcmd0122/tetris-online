<template>
  <div class="auth-widget">
    <span class="auth-label">ACCOUNT</span>
    <div v-if="user" class="auth-widget-inner auth-logged-in">
      <img v-if="photoURL" class="auth-avatar" :src="photoURL" alt="avatar" @error="onAvatarError">
      <div v-else class="auth-avatar-initials">{{ initials }}</div>
      <div class="auth-name">
        {{ displayName.slice(0, 20) }}
        <span class="auth-badge">▶ LOGGED IN</span>
      </div>
      <button class="auth-logout-btn" @click="handleSignOut">ログアウト</button>
    </div>
    <div v-else class="auth-widget-inner">
      <button class="auth-google-btn" @click="handleSignIn">
        <svg width="16" height="16" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.7 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.7 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.4 26.8 36 24 36c-5.2 0-9.7-3.3-11.3-8H6.1C9.4 35.6 16.2 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.7-.4-3.9z"/>
        </svg>
        Googleでログイン
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { onAuthReady, signIn, signOut, getCachedProfile } from '../logic/auth';

const user = ref(null);
const profile = ref(null);
let unsub = null;

onMounted(() => {
  unsub = onAuthReady((u) => {
    user.value = u;
    profile.value = getCachedProfile();
  });
});

onUnmounted(() => {
  if (unsub) unsub();
});

const displayName = computed(() => profile.value?.displayName || user.value?.displayName || user.value?.email || 'PLAYER');
const photoURL = ref(computed(() => profile.value?.customPhotoURL || profile.value?.photoURL || user.value?.photoURL).value);
const initials = computed(() => displayName.value.slice(0, 2).toUpperCase());

const onAvatarError = () => {
  photoURL.value = null;
};

const handleSignIn = async () => {
  try {
    await signIn();
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') console.error(e);
  }
};

const handleSignOut = async () => {
  await signOut();
};
</script>

<style scoped>
.auth-widget { width: 100%; margin-bottom: 16px; font-family: 'Orbitron', monospace; text-align: left; }
.auth-widget-inner { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: rgba(0, 245, 255, .04); border: 1px solid rgba(0, 245, 255, .18); border-radius: 3px; transition: border-color .2s; }
.auth-widget-inner.auth-logged-in { background: rgba(0, 245, 255, .06); border-color: rgba(0, 245, 255, .35); }
.auth-google-btn { display: flex; align-items: center; gap: 8px; flex: 1; padding: 9px 14px; background: #fff; color: #222; border: none; border-radius: 3px; cursor: pointer; font-family: 'Orbitron', monospace; font-size: 10px; font-weight: 700; letter-spacing: 1px; transition: opacity .15s, transform .12s; justify-content: center; }
.auth-google-btn:hover { opacity: .88; transform: translateY(-1px); }
.auth-avatar { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #00f5ff; object-fit: cover; flex-shrink: 0; box-shadow: 0 0 8px rgba(0, 245, 255, .5); }
.auth-avatar-initials { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #00f5ff; background: linear-gradient(135deg, #7700ff, #00f5ff); display: flex; align-items: center; justify-content: center; font-family: 'Press Start 2P', monospace; font-size: 9px; color: #fff; flex-shrink: 0; box-shadow: 0 0 8px rgba(0, 245, 255, .5); }
.auth-name { flex: 1; font-size: 11px; color: #00f5ff; letter-spacing: 1px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.auth-badge { font-size: 7px; color: #aaff00; letter-spacing: 1px; display: block; margin-top: 2px; }
.auth-logout-btn { background: transparent; border: 1px solid rgba(74, 96, 128, .6); color: #4a6080; font-family: 'Orbitron', monospace; font-size: 8px; padding: 5px 10px; border-radius: 2px; cursor: pointer; letter-spacing: 1px; transition: all .2s; white-space: nowrap; flex-shrink: 0; }
.auth-logout-btn:hover { border-color: #ff0080; color: #ff0080; }
.auth-label { font-size: 8px; color: #4a6080; letter-spacing: 2px; margin-bottom: 6px; display: block; font-family: 'Orbitron', monospace; }
</style>
