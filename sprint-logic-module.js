import { mountNav, notifyOk, notifyErr, notifySpecial } from './nav.js';
import { onAuthReady, getCachedProfile, mountAuthWidget, getCurrentUser } from './auth.js';
import { saveSprintResult, upsertUserProfile } from './db.js';

mountNav();

// auth widget をロビーに表示
mountAuthWidget('sprintAuthWidget');

function _lockNameInput(name) {
  const inp = document.getElementById('playerName');
  if (!inp) return;
  inp.value = name;
  inp.readOnly = true;
  inp.style.opacity = '0.6';
  inp.style.cursor = 'not-allowed';
  inp.title = 'ログイン中はアカウント名が使用されます';
}
function _unlockNameInput() {
  const inp = document.getElementById('playerName');
  if (!inp) return;
  inp.readOnly = false;
  inp.style.opacity = '';
  inp.style.cursor = '';
  inp.title = '';
}

// ログイン状態に応じて名前入力欄を制御 & window グローバルを定義
onAuthReady(async user => {
  if (user) {
    await upsertUserProfile(user).catch(() => { });
    const profile = getCachedProfile();
    const name = (profile?.displayName || user.displayName || user.email || 'PLAYER')
      .trim().replace(/\//g, '_').slice(0, 12).toUpperCase() || 'PLAYER';
    _lockNameInput(name);

    // 正規スクリプトがプレイヤー名を取得するための関数
    window._getAuthName = () => name;

    // スプリント完了時に Firestore へ保存
    window._onSprintComplete = async (_playerName, ms, score, rank) => {
      const u = getCurrentUser();
      if (!u) return;
      try {
        await saveSprintResult(u.uid, { ms, score, lines: 40, globalRank: rank || null });
      } catch (e) { console.warn('sprint save failed', e); }
    };
  } else {
    _unlockNameInput();
    window._getAuthName = null;
    window._onSprintComplete = null;
  }
});
