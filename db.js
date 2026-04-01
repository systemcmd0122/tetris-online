/**
 * db.js — Firestore データ管理モジュール v2
 * TETRIS BATTLE
 *
 * 重要な設計:
 *  - upsertUserProfile: 初回のみ Auth 名で初期化。
 *    以降はログインしても displayName / customPhotoURL を上書きしない。
 *  - updateUserName / updateUserAvatar: 明示的な更新関数のみが変更する。
 */

import { FB_CONFIG } from './config.js';

let _app = null, _fs = null;

async function _getFS() {
  if (_fs) return _fs;
  const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const { getFirestore }           = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  _app = getApps().length ? getApps()[0] : initializeApp(FB_CONFIG);
  _fs  = getFirestore(_app);
  return _fs;
}

// ── プロフィール ────────────────────────────────────────────

/**
 * ログイン時にプロフィールを初期化する。
 * ドキュメントが存在しない場合のみ新規作成。
 * 既存ドキュメントは lastSeen と email のみ更新（displayName は触らない）。
 */
export async function upsertUserProfile(user) {
  const fs = await _getFS();
  const { doc, setDoc, getDoc, updateDoc, serverTimestamp } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  const ref  = doc(fs, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // 初回ログイン: Auth の情報で初期化
    await setDoc(ref, {
      displayName:      user.displayName || 'PLAYER',
      photoURL:         user.photoURL    || null,
      customPhotoURL:   null,   // ユーザーが独自に設定するアバター URL
      email:            user.email || null,
      createdAt:        serverTimestamp(),
      lastSeen:         serverTimestamp(),
      totalMultiGames:  0,
      totalWins:        0,
      totalSprintGames: 0,
      bestSprintMs:     null,
      totalLinesCleared: 0,
    });
  } else {
    // 2回目以降: displayName・photoURL・customPhotoURL は一切触らない
    await updateDoc(ref, {
      lastSeen: serverTimestamp(),
      ...(user.email ? { email: user.email } : {}),
    });
  }
}

/**
 * ユーザー名を更新する（Firestore のみ。Firebase Auth は変更しない）。
 * @param {string} uid
 * @param {string} newName  最大20文字
 */
export async function updateUserName(uid, newName) {
  const name = newName.trim().slice(0, 20);
  if (!name) throw new Error('名前が空です');
  const fs = await _getFS();
  const { doc, updateDoc, serverTimestamp } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  await updateDoc(doc(fs, 'users', uid), {
    displayName: name,
    lastSeen: serverTimestamp(),
  });
  return name;
}

/**
 * カスタムアバター URL を更新する。
 * @param {string} uid
 * @param {string|null} photoURL  null を渡すと削除（Google アカウント画像にフォールバック）
 */
export async function updateUserAvatar(uid, photoURL) {
  const fs = await _getFS();
  const { doc, updateDoc, serverTimestamp } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  await updateDoc(doc(fs, 'users', uid), {
    customPhotoURL: photoURL || null,
    lastSeen: serverTimestamp(),
  });
}

// ── 対戦履歴 ────────────────────────────────────────────────

export async function saveMultiResult(uid, data) {
  const fs = await _getFS();
  const { doc, addDoc, collection, updateDoc, increment, serverTimestamp } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  await addDoc(collection(fs, 'users', uid, 'multi_history'), {
    rank:           data.rank,
    totalPlayers:   data.totalPlayers,
    score:          data.score,
    lines:          data.lines,
    level:          data.level,
    attackSent:     data.attackSent || 0,
    mode:           data.mode || 'room',
    opponentNames:  data.opponentNames || [],
    ts:             serverTimestamp(),
  });

  await updateDoc(doc(fs, 'users', uid), {
    totalMultiGames:  increment(1),
    totalWins:        data.rank === 1 ? increment(1) : increment(0),
    totalLinesCleared: increment(data.lines || 0),
    lastSeen:         serverTimestamp(),
  }).catch(() => {});
}

export async function saveSprintResult(uid, data) {
  const fs = await _getFS();
  const { doc, addDoc, collection, updateDoc, increment, getDoc, serverTimestamp } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  await addDoc(collection(fs, 'users', uid, 'sprint_history'), {
    ms:          data.ms,
    lines:       data.lines || 40,
    score:       data.score || 0,
    globalRank:  data.globalRank || null,
    ts:          serverTimestamp(),
  });

  const profileRef = doc(fs, 'users', uid);
  const snap       = await getDoc(profileRef);
  const prev       = snap.exists() ? snap.data().bestSprintMs : null;
  const isNewBest  = prev == null || data.ms < prev;

  await updateDoc(profileRef, {
    totalSprintGames:  increment(1),
    totalLinesCleared: increment(data.lines || 40),
    lastSeen:          serverTimestamp(),
    ...(isNewBest ? { bestSprintMs: data.ms } : {}),
  }).catch(() => {});
}

// ── データ取得 ───────────────────────────────────────────────

export async function getUserProfile(uid) {
  const fs = await _getFS();
  const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const snap = await getDoc(doc(fs, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getMultiHistory(uid, n = 50) {
  const fs = await _getFS();
  const { collection, getDocs, query, orderBy, limit } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const snap = await getDocs(query(
    collection(fs, 'users', uid, 'multi_history'), orderBy('ts', 'desc'), limit(n)
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getSprintHistory(uid, n = 50) {
  const fs = await _getFS();
  const { collection, getDocs, query, orderBy, limit } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const snap = await getDocs(query(
    collection(fs, 'users', uid, 'sprint_history'), orderBy('ts', 'desc'), limit(n)
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}