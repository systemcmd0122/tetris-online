import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp, addDoc, collection, increment, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { FB_CONFIG } from './config.js';

let _fs = null;

export async function _getFS() {
  if (_fs) return _fs;
  const app = getApps().length ? getApp() : initializeApp(FB_CONFIG);
  _fs  = getFirestore(app);
  return _fs;
}

// ── プロフィール ────────────────────────────────────────────

export async function upsertUserProfile(user) {
  const fs = await _getFS();
  const ref  = doc(fs, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      displayName:      user.displayName || 'PLAYER',
      photoURL:         user.photoURL    || null,
      customPhotoURL:   null,
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
    await updateDoc(ref, {
      lastSeen: serverTimestamp(),
      ...(user.email ? { email: user.email } : {}),
    });
  }
}

export async function updateUserName(uid, newName) {
  const name = newName.trim().slice(0, 20);
  if (!name) throw new Error('名前が空です');
  const fs = await _getFS();
  await updateDoc(doc(fs, 'users', uid), {
    displayName: name,
    lastSeen: serverTimestamp(),
  });
  return name;
}

export async function updateUserAvatar(uid, photoURL) {
  const fs = await _getFS();
  await updateDoc(doc(fs, 'users', uid), {
    customPhotoURL: photoURL || null,
    lastSeen: serverTimestamp(),
  });
}

// ── 対戦履歴 ────────────────────────────────────────────────

export async function saveMultiResult(uid, data) {
  const fs = await _getFS();
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
  const snap = await getDoc(doc(fs, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getMultiHistory(uid, n = 50) {
  const fs = await _getFS();
  const snap = await getDocs(query(
    collection(fs, 'users', uid, 'multi_history'), orderBy('ts', 'desc'), limit(n)
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getSprintHistory(uid, n = 50) {
  const fs = await _getFS();
  const snap = await getDocs(query(
    collection(fs, 'users', uid, 'sprint_history'), orderBy('ts', 'desc'), limit(n)
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
