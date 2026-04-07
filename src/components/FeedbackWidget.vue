<template>
  <div>
    <button id="fb-btn" @click="openFb" title="バグ報告・フィードバック">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M17 13a1 1 0 01-1 1H6l-4 4V4a1 1 0 011-1h13a1 1 0 011 1v9z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <circle cx="7" cy="8.5" r="1" fill="currentColor"/>
        <circle cx="10" cy="8.5" r="1" fill="currentColor"/>
        <circle cx="13" cy="8.5" r="1" fill="currentColor"/>
      </svg>
    </button>
    <div v-if="showOverlay" id="fb-overlay" class="show" @click.self="closeFb">
      <div id="fb-modal">
        <button class="fb-x" @click="closeFb">×</button>
        <h2>📝 FEEDBACK</h2>
        <div v-if="!submitted" id="fb-body">
          <span class="fb-lbl">CATEGORY</span>
          <div class="fb-types">
            <button v-for="t in ['bug', 'feedback', 'idea', 'other']" :key="t"
                    :class="['fb-t', { ['sel-' + t]: category === t }]"
                    @click="category = t">
              {{ typeLabels[t] }}
            </button>
          </div>
          <span class="fb-lbl">MESSAGE</span>
          <textarea v-model="message" class="fb-ta" placeholder="例: ○○のページで△△が起きました..." maxlength="1000"></textarea>
          <div class="fb-err">{{ error }}</div>
          <button class="fb-sub" :disabled="sending" @click="sendFeedback">
            {{ sending ? '送信中...' : '送信する ▶' }}
          </button>
        </div>
        <div v-else id="fb-done">
          <div class="fb-ok">✓ 送信完了！<br>ありがとうございます</div>
          <button class="fb-sub" @click="closeFb">閉じる</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { FB_CONFIG, APP_VERSION } from '../logic/config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const route = useRoute();
const showOverlay = ref(false);
const submitted = ref(false);
const category = ref(null);
const message = ref('');
const error = ref('');
const sending = ref(false);

const typeLabels = {
  bug: '🐛 バグ',
  feedback: '💬 感想',
  idea: '💡 アイデア',
  other: '📌 その他'
};

const openFb = () => {
  showOverlay.value = true;
  submitted.value = false;
  category.value = null;
  message.value = '';
  error.value = '';
};

const closeFb = () => {
  showOverlay.value = false;
};

const sendFeedback = async () => {
  if (!category.value) { error.value = '⚠ カテゴリを選択してください'; return; }
  if (message.value.trim().length < 5) { error.value = '⚠ もう少し詳しく教えてください'; return; }

  sending.value = true;
  error.value = '';

  try {
    const app = getApps().length ? getApp() : initializeApp(FB_CONFIG);
    const fs = getFirestore(app);
    await addDoc(collection(fs, 'reports'), {
      type: category.value,
      message: message.value.trim(),
      page: route.name || '不明',
      version: APP_VERSION,
      ua: navigator.userAgent.slice(0, 200),
      ts: serverTimestamp(),
      status: 'new',
    });
    submitted.value = true;
  } catch (e) {
    error.value = '⚠ 送信失敗: ' + (e.message || 'エラー');
  } finally {
    sending.value = false;
  }
};
</script>

<style scoped>
#fb-btn{position:fixed;bottom:12px;right:14px;z-index:9000;width:40px;height:40px;border-radius:50%;
  background:linear-gradient(135deg,#7700ff,#cc00ff);border:2px solid rgba(204,0,255,.4);
  box-shadow:0 4px 14px rgba(204,0,255,.4);cursor:pointer;display:flex;align-items:center;
  justify-content:center;transition:transform .2s,box-shadow .2s;color:#fff;user-select:none;padding:0;}
#fb-btn:hover{transform:scale(1.12);box-shadow:0 6px 22px rgba(204,0,255,.7);}
#fb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9001;display:flex;
  align-items:center;justify-content:center;backdrop-filter:blur(4px);}
#fb-modal{background:#080d18;border:1px solid rgba(204,0,255,.4);border-radius:6px;
  padding:28px 26px;width:min(420px,92vw);position:relative;
  box-shadow:0 0 40px rgba(204,0,255,.2);font-family:'Orbitron',monospace;}
#fb-modal::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;
  background:linear-gradient(90deg,#7700ff,#cc00ff,#00f5ff);border-radius:6px 6px 0 0;}
#fb-modal h2{font-family:'Press Start 2P',monospace;font-size:11px;color:#cc00ff;letter-spacing:2px;margin-bottom:20px;}
.fb-x{position:absolute;top:12px;right:16px;background:none;border:none;color:#4a6080;font-size:22px;cursor:pointer;line-height:1;padding:0;transition:color .2s;}
.fb-x:hover{color:#cc00ff;}
.fb-lbl{font-size:10px;color:#4a6080;letter-spacing:2px;margin-bottom:8px;display:block;}
.fb-types{display:flex;gap:7px;margin-bottom:18px;}
.fb-t{flex:1;padding:9px 2px;border-radius:4px;cursor:pointer;font-family:'Orbitron',monospace;font-size:8px;font-weight:700;letter-spacing:1px;text-align:center;transition:all .15s;border:1px solid #1a2540;color:#4a6080;background:transparent;}
.fb-t:hover{border-color:#cc00ff;color:#cc00ff;}
.fb-t.sel-bug{border-color:#ff3355;color:#ff3355;background:rgba(255,51,85,.08);}
.fb-t.sel-feedback{border-color:#00f5ff;color:#00f5ff;background:rgba(0,245,255,.08);}
.fb-t.sel-idea{border-color:#aaff00;color:#aaff00;background:rgba(170,255,0,.08);}
.fb-t.sel-other{border-color:#ff8800;color:#ff8800;background:rgba(255,136,0,.08);}
.fb-ta{width:100%;min-height:100px;background:rgba(0,0,0,.4);border:1px solid #1a2540;border-radius:4px;color:#e0f0ff;font-family:'Orbitron',monospace;font-size:12px;padding:11px;resize:vertical;outline:none;transition:border-color .2s;margin-bottom:14px;box-sizing:border-box;}
.fb-ta:focus{border-color:#cc00ff;}
.fb-sub{width:100%;padding:12px;border:none;border-radius:4px;background:linear-gradient(135deg,#7700ff,#cc00ff);color:#fff;font-family:'Orbitron',monospace;font-size:11px;font-weight:700;letter-spacing:2px;cursor:pointer;transition:all .2s;box-sizing:border-box;}
.fb-sub:hover{transform:translateY(-1px);box-shadow:0 0 20px rgba(204,0,255,.5);}
.fb-sub:disabled{opacity:.4;cursor:not-allowed;transform:none;}
.fb-err{font-size:10px;color:#ff3355;letter-spacing:1px;margin-bottom:10px;min-height:14px;}
.fb-ok{text-align:center;padding:24px 0;font-family:'Press Start 2P',monospace;font-size:10px;color:#aaff00;letter-spacing:2px;line-height:2.4;}
</style>
