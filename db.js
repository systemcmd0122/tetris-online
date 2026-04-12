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
  const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  _app = getApps().length ? getApps()[0] : initializeApp(FB_CONFIG);
  _fs = getFirestore(_app);
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

  const ref = doc(fs, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // 初回ログイン: Auth の情報で初期化
    await setDoc(ref, {
      displayName: user.displayName || 'PLAYER',
      photoURL: user.photoURL || null,
      customPhotoURL: null,   // ユーザーが独自に設定するアバター URL
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
    rank: data.rank,
    totalPlayers: data.totalPlayers,
    score: data.score,
    lines: data.lines,
    level: data.level,
    attackSent: data.attackSent || 0,
    mode: data.mode || 'room',
    opponentNames: data.opponentNames || [],
    ts: serverTimestamp(),
  });

  await updateDoc(doc(fs, 'users', uid), {
    totalMultiGames: increment(1),
    totalWins: data.rank === 1 ? increment(1) : increment(0),
    totalLinesCleared: increment(data.lines || 0),
    lastSeen: serverTimestamp(),
  }).catch(() => { });
}

export async function saveSprintResult(uid, data) {
  const fs = await _getFS();
  const { doc, addDoc, collection, updateDoc, increment, getDoc, serverTimestamp } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  await addDoc(collection(fs, 'users', uid, 'sprint_history'), {
    ms: data.ms,
    lines: data.lines || 40,
    score: data.score || 0,
    globalRank: data.globalRank || null,
    ts: serverTimestamp(),
  });

  const profileRef = doc(fs, 'users', uid);
  const snap = await getDoc(profileRef);
  const prev = snap.exists() ? snap.data().bestSprintMs : null;
  const isNewBest = prev == null || data.ms < prev;

  await updateDoc(profileRef, {
    totalSprintGames: increment(1),
    totalLinesCleared: increment(data.lines || 40),
    lastSeen: serverTimestamp(),
    ...(isNewBest ? { bestSprintMs: data.ms } : {}),
  }).catch(() => { });
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

// ── テトリス検定 ──────────────────────────────────────────

/**
 * 検定結果を保存する。合格した場合のみ users/{uid}/exam_badges に記録。
 * 同じレベルの最高スコアのみ保存する。
 * @param {string} uid
 * @param {{ levelId: string, score: number, passed: boolean }} data
 */
export async function saveExamResult(uid, data) {
  const fs = await _getFS();
  const { doc, setDoc, getDoc, serverTimestamp } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  // 全結果ログに追記
  const { addDoc, collection } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  await addDoc(collection(fs, 'users', uid, 'exam_history'), {
    levelId: data.levelId,
    score: data.score,
    passed: data.passed,
    ts: serverTimestamp(),
  }).catch(() => { });

  // 合格の場合はバッジドキュメントを upsert
  if (data.passed) {
    const badgeRef = doc(fs, 'users', uid, 'exam_badges', data.levelId);
    const snap = await getDoc(badgeRef);
    const prev = snap.exists() ? snap.data().score : -1;
    if (data.score > prev) {
      await setDoc(badgeRef, {
        levelId: data.levelId,
        score: data.score,
        earnedAt: serverTimestamp(),
      });
    }
  }
}

/**
 * ユーザーの取得済みバッジ一覧を返す。
 * @param {string} uid
 * @returns {Promise<Array<{levelId:string, score:number, earnedAt:*}>>}
 */
export async function getExamBadges(uid) {
  const fs = await _getFS();
  const { collection, getDocs } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const snap = await getDocs(collection(fs, 'users', uid, 'exam_badges'));
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

// ── 管理者用: ユーザー管理 ───────────────────────────────────

/**
 * 全ユーザー一覧を取得する（管理者用）。
 * @returns {Promise<Array<{id:string, displayName:string, email:string, createdAt:*, lastSeen:*, totalMultiGames:number, totalWins:number, ...}>>}
 */
export async function getAllUsers() {
  const fs = await _getFS();
  const { collection, getDocs, query, orderBy, limit } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const snap = await getDocs(query(
    collection(fs, 'users'),
    orderBy('createdAt', 'desc'),
    limit(1000)
  ));

  // For each user, try to get badge count
  const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Fetch badge count for each user (async, but don't block the main list)
  for (const user of users) {
    try {
      const badgeSnap = await getDocs(collection(fs, 'users', user.id, 'exam_badges'));
      user.exam_badges_count = badgeSnap.size;
    } catch (e) {
      user.exam_badges_count = 0;
    }
  }

  return users;
}

/**
 * ユーザーの検定情報を取得する（管理者用）。
 * プロフィール + 取得済みバッジを返す。
 * @param {string} uid
 * @returns {Promise<{profile: object, badges: Array<{levelId:string, score:number, earnedAt:*}>}>}
 */
export async function getUserExamInfo(uid) {
  const profile = await getUserProfile(uid);
  const badges = await getExamBadges(uid);
  return { profile, badges };
}

/**
 * 管理者による検定バッジの更新。スコアと合格状況を変更できる。
 * @param {string} uid
 * @param {string} levelId  (lv1, lv2, etc.)
 * @param {number} newScore  新しいスコア (0-10)
 * @param {boolean} passed  合格/不合格フラグ
 */
export async function adminUpdateExamBadge(uid, levelId, newScore, passed) {
  const fs = await _getFS();
  const { doc, setDoc, deleteDoc } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  const badgeRef = doc(fs, 'users', uid, 'exam_badges', levelId);

  if (passed) {
    // 合格: バッジを作成/更新
    await setDoc(badgeRef, {
      levelId: levelId,
      score: newScore,
      earnedAt: new Date(),
    });
  } else {
    // 不合格: バッジを削除
    try {
      await deleteDoc(badgeRef);
    } catch (e) {
      // すでに削除されていた場合は無視
    }
  }
}

/**
 * 管理者による全検定レベルの管理。
 * @param {string} uid
 * @param {Object} badgesData  { lv1: {score: 8, passed: true}, lv2: {...}, ... }
 */
export async function adminUpdateAllExamBadges(uid, badgesData) {
  const fs = await _getFS();
  const { writeBatch, doc } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const batch = writeBatch(fs);

  for (const [levelId, data] of Object.entries(badgesData)) {
    const badgeRef = doc(fs, 'users', uid, 'exam_badges', levelId);
    if (data.passed) {
      batch.set(badgeRef, {
        levelId: levelId,
        score: data.score,
        earnedAt: new Date(),
      });
    } else {
      batch.delete(badgeRef);
    }
  }

  await batch.commit();
}

/**
 * ユーザーの主要データを管理者が編集。
 * @param {string} uid
 * @param {Object} updates  { displayName, totalMultiGames, totalWins, totalSprintGames, bestSprintMs, ...}
 */
export async function adminUpdateUserProfile(uid, updates) {
  const fs = await _getFS();
  const { doc, updateDoc, serverTimestamp } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  const cleanUpdates = {};
  const allowedFields = ['displayName', 'totalMultiGames', 'totalWins', 'totalSprintGames', 'bestSprintMs', 'totalLinesCleared'];

  for (const field of allowedFields) {
    if (field in updates) {
      cleanUpdates[field] = updates[field];
    }
  }

  cleanUpdates.lastSeen = serverTimestamp();

  await updateDoc(doc(fs, 'users', uid), cleanUpdates);
}

// ── 称号システム ───────────────────────────────────────────

/**
 * プリセット称号一覧。IDは一意でなければならない。
 */
export const AVAILABLE_TITLES = {
  // ボット対戦系
  'bot-easy-win': { name: '初心者', emoji: '🌱', category: 'bot', label: 'ボット EASY 倍' },
  'bot-normal-win': { name: '修行者', emoji: '🔥', category: 'bot', label: 'ボット NORMAL 倍' },
  'bot-hard-win': { name: '達人', emoji: '💎', category: 'bot', label: 'ボット HARD 倍' },
  'bot-demon-win': { name: '鬼殺し', emoji: '👹', category: 'bot', label: 'ボット DEMON 倍' },

  // 連勝系
  'streak-5': { name: '連勝5', emoji: '⚡', category: 'streak', label: '5連勝達成' },
  'streak-10': { name: '連勝10', emoji: '🌟', category: 'streak', label: '10連勝達成' },
  'streak-20': { name: '連勝20', emoji: '🏆', category: 'streak', label: '20連勝達成' },

  // マルチプレイ系
  'multi-10-wins': { name: 'ライジングスター', emoji: '⭐', category: 'multi', label: 'マルチ10勝達成' },
  'multi-50-wins': { name: '伝説の王', emoji: '👑', category: 'multi', label: 'マルチ50勝達成' },
  'multi-100-wins': { name: '不滅の帝', emoji: '♔', category: 'multi', label: 'マルチ100勝達成' },

  // スプリント系
  'sprint-gold': { name: 'スプリントの王', emoji: '🥇', category: 'sprint', label: 'スプリント40秒台達成' },
  'sprint-silver': { name: 'スプリント銀猫', emoji: '🥈', category: 'sprint', label: 'スプリント50秒台達成' },
  'sprint-bronze': { name: 'スプリント銅猫', emoji: '🥉', category: 'sprint', label: 'スプリント60秒台達成' },

  // 検定系
  'exam-all-lv': { name: '検定マスター', emoji: '📜', category: 'exam', label: '全検定レベル合格' },
  'exam-perfect': { name: '完璧主義者', emoji: '💯', category: 'exam', label: '全検定で満点取得' },

  // その他
  'first-login': { name: 'ようこそ', emoji: '👋', category: 'other', label: '初ログイン' },
  'milestone-100games': { name: 'ゲーマー100', emoji: '🎮', category: 'other', label: '100ゲーム達成' },
};

/**
 * ユーザーの称号を追加する。すでに所持していれば何もしない。
 * @param {string} uid
 * @param {string} titleId
 */
export async function awardTitle(uid, titleId) {
  if (!AVAILABLE_TITLES[titleId]) throw new Error('不正な称号ID');

  const fs = await _getFS();
  const { doc, setDoc, getDoc, serverTimestamp } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  const titleRef = doc(fs, 'users', uid, 'titles', titleId);
  const snap = await getDoc(titleRef);

  if (!snap.exists()) {
    // まだ所持していなければ追加
    await setDoc(titleRef, {
      titleId: titleId,
      earnedAt: serverTimestamp(),
    });
  }
}

/**
 * ユーザーの称号一覧を取得。
 * @param {string} uid
 * @returns {Promise<Array<{titleId:string, earnedAt:*, displayName:string, emoji:string, category:string, label:string}>>}
 */
export async function getUserTitles(uid) {
  const fs = await _getFS();
  const { collection, getDocs, orderBy, query } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  const snap = await getDocs(query(
    collection(fs, 'users', uid, 'titles'),
    orderBy('earnedAt', 'asc')
  ));

  return snap.docs.map(d => {
    const data = d.data();
    const titleDef = AVAILABLE_TITLES[data.titleId] || {};
    return {
      titleId: data.titleId,
      earnedAt: data.earnedAt,
      ...titleDef
    };
  });
}

/**
 * 称号を削除する（管理者用）。
 * @param {string} uid
 * @param {string} titleId
 */
export async function removeTitle(uid, titleId) {
  const fs = await _getFS();
  const { doc, deleteDoc } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  try {
    await deleteDoc(doc(fs, 'users', uid, 'titles', titleId));
  } catch (e) {
    // すでに削除されていた場合は無視
  }
}

// ── リアルタイム監視 ────────────────────────────────────────

/**
 * ユーザーの称号を監視し、新規追加時にコールバックを実行する。
 * @param {string} uid
 * @param {function} onNewTitle - コールバック関数: onNewTitle(titleId, titleDef)
 * @returns {function} リスナー削除用関数
 */
export async function watchUserTitles(uid, onNewTitle) {
  const fs = await _getFS();
  const { collection, onSnapshot } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  const titlesRef = collection(fs, 'users', uid, 'titles');
  let isFirstRun = true;

  const unsubscribe = onSnapshot(titlesRef, (snap) => {
    // 初回実行時は無視（初期データ読み込みだから）
    if (isFirstRun) {
      isFirstRun = false;
      return;
    }

    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        const data = change.doc.data();
        const titleDef = AVAILABLE_TITLES[data.titleId];
        if (titleDef) {
          onNewTitle(data.titleId, titleDef);
        }
      }
    });
  });

  return unsubscribe;
}

/**
 * ユーザーのプロフィールを監視し、変更時にコールバックを実行する。
 * @param {string} uid
 * @param {function} onProfileChange - コールバック関数: onProfileChange(profileData, changes)
 * @returns {function} リスナー削除用関数
 */
export async function watchUserProfile(uid, onProfileChange) {
  const fs = await _getFS();
  const { doc, onSnapshot } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  let prevData = null;

  const unsubscribe = onSnapshot(doc(fs, 'users', uid), (snap) => {
    if (!snap.exists()) return;

    const data = snap.data();
    const changes = {};

    if (!prevData) {
      prevData = data;
      return; // 初回は無視
    }

    // 変更があったフィールドを検出
    for (const key of Object.keys(data)) {
      if (JSON.stringify(prevData[key]) !== JSON.stringify(data[key])) {
        changes[key] = { old: prevData[key], new: data[key] };
      }
    }

    if (Object.keys(changes).length > 0) {
      onProfileChange(data, changes);
      prevData = data;
    }
  });

  return unsubscribe;
}