/**
 * db.js — Firestore ゲームデータ管理モジュール
 * TETRIS BATTLE 共通データベースライブラリ
 *
 * Firestore データ構造:
 *   users/{uid}                          — プロフィール・統計
 *   users/{uid}/multi_history/{docId}    — マルチ対戦履歴
 *   users/{uid}/sprint_history/{docId}   — スプリント履歴
 */

const FB_CONFIG = {
  apiKey: "AIzaSyCjYKsc8eT9gDXEMQsfI0ZJ7UeuLwrDTxw",
  authDomain: "tetris-online-9c827.firebaseapp.com",
  databaseURL: "https://tetris-online-9c827-default-rtdb.firebaseio.com",
  projectId: "tetris-online-9c827",
  storageBucket: "tetris-online-9c827.firebasestorage.app",
  messagingSenderId: "1045054992314",
  appId: "1:1045054992314:web:7fea20b9be543d7cab3783"
};

let _app = null, _fs = null;

async function _getFS() {
  if (_fs) return _fs;
  const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  _app = getApps().length ? getApps()[0] : initializeApp(FB_CONFIG);
  _fs = getFirestore(_app);
  return _fs;
}

/**
 * ユーザープロフィールを作成/更新する
 * @param {{ uid, displayName, photoURL, email }} user
 */
export async function upsertUserProfile(user) {
  const fs = await _getFS();
  const { doc, setDoc, serverTimestamp, getDoc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const ref = doc(fs, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      displayName: user.displayName || 'PLAYER',
      photoURL: user.photoURL || null,
      email: user.email || null,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      totalMultiGames: 0,
      totalWins: 0,
      totalSprintGames: 0,
      bestSprintMs: null,
      totalLinesCleared: 0,
    });
  } else {
    await updateDoc(ref, {
      displayName: user.displayName || snap.data().displayName || 'PLAYER',
      photoURL: user.photoURL || snap.data().photoURL || null,
      lastSeen: serverTimestamp(),
    });
  }
}

/**
 * マルチ対戦結果を保存する
 * @param {string} uid
 * @param {{ rank, totalPlayers, score, lines, level, attackSent, mode, opponentNames }} data
 */
export async function saveMultiResult(uid, data) {
  const fs = await _getFS();
  const {
    doc, addDoc, collection, updateDoc, increment, serverTimestamp, getDoc
  } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  // 履歴サブコレクションに追加
  await addDoc(collection(fs, 'users', uid, 'multi_history'), {
    rank: data.rank,
    totalPlayers: data.totalPlayers,
    score: data.score,
    lines: data.lines,
    level: data.level,
    attackSent: data.attackSent || 0,
    mode: data.mode || 'room',   // 'room' | 'qm' | 'bot'
    opponentNames: data.opponentNames || [],
    ts: serverTimestamp(),
  });

  // プロフィール統計を更新
  const profileRef = doc(fs, 'users', uid);
  await updateDoc(profileRef, {
    totalMultiGames: increment(1),
    totalWins: data.rank === 1 ? increment(1) : increment(0),
    totalLinesCleared: increment(data.lines || 0),
    lastSeen: serverTimestamp(),
  }).catch(() => {});
}

/**
 * スプリント結果を保存する（自己ベストのみFirestoreランキングへ）
 * @param {string} uid
 * @param {{ ms, lines, score, displayName, globalRank }} data
 */
export async function saveSprintResult(uid, data) {
  const fs = await _getFS();
  const {
    doc, addDoc, collection, updateDoc, increment, serverTimestamp, getDoc
  } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  // 履歴サブコレクションに常に追加
  await addDoc(collection(fs, 'users', uid, 'sprint_history'), {
    ms: data.ms,
    lines: data.lines || 40,
    score: data.score || 0,
    globalRank: data.globalRank || null,
    ts: serverTimestamp(),
  });

  // プロフィール: bestSprintMs を更新
  const profileRef = doc(fs, 'users', uid);
  const snap = await getDoc(profileRef);
  const prev = snap.exists() ? snap.data().bestSprintMs : null;
  const isNewBest = prev == null || data.ms < prev;
  await updateDoc(profileRef, {
    totalSprintGames: increment(1),
    totalLinesCleared: increment(data.lines || 40),
    lastSeen: serverTimestamp(),
    ...(isNewBest ? { bestSprintMs: data.ms } : {}),
  }).catch(() => {});
}

/**
 * ユーザープロフィールを取得する
 * @param {string} uid
 * @returns {Object|null}
 */
export async function getUserProfile(uid) {
  const fs = await _getFS();
  const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const snap = await getDoc(doc(fs, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * マルチ対戦履歴を取得する
 * @param {string} uid
 * @param {number} n  最大件数（デフォルト30）
 * @returns {Array}
 */
export async function getMultiHistory(uid, n = 30) {
  const fs = await _getFS();
  const { collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const snap = await getDocs(query(
    collection(fs, 'users', uid, 'multi_history'),
    orderBy('ts', 'desc'),
    limit(n)
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * スプリント履歴を取得する
 * @param {string} uid
 * @param {number} n  最大件数（デフォルト30）
 * @returns {Array}
 */
export async function getSprintHistory(uid, n = 30) {
  const fs = await _getFS();
  const { collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const snap = await getDocs(query(
    collection(fs, 'users', uid, 'sprint_history'),
    orderBy('ts', 'desc'),
    limit(n)
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
