import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  signOut as _fbSignOut, onAuthStateChanged,
} from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { FB_CONFIG } from './config.js';

const _app      = getApps().length ? getApp() : initializeApp(FB_CONFIG);
const _auth     = getAuth(_app);
const _provider = new GoogleAuthProvider();

// プロフィールキャッシュ
let _cachedProfile = null;
let _currentUser   = null;
let _authResolved  = false;
const _subscribers = new Set();

async function _loadProfile(uid) {
  try {
    const snap = await getDoc(doc(getFirestore(_app), 'users', uid));
    _cachedProfile = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) { _cachedProfile = null; }
  return _cachedProfile;
}

function _notify() {
  _subscribers.forEach(cb => { try { cb(_currentUser); } catch (e) {} });
}

onAuthStateChanged(_auth, async (user) => {
  _currentUser = user;
  if (user) { await _loadProfile(user.uid); }
  else { _cachedProfile = null; }
  _authResolved = true;
  _notify();
});

export function getCurrentUser()    { return _auth.currentUser; }
export function getCachedProfile()  { return _cachedProfile; }

export async function refreshProfile() {
  const user = _auth.currentUser;
  if (!user) return null;
  await _loadProfile(user.uid);
  _notify();
  return _cachedProfile;
}

export function getPlayerName() {
  const user = _auth.currentUser;
  if (!user) return null;
  const raw = (_cachedProfile?.displayName || user.displayName || user.email || 'PLAYER')
    .trim().replace(/\//g, '_').replace(/\.\./g, '__');
  return raw.slice(0, 12) || 'PLAYER';
}

export async function signIn()  { return await signInWithPopup(_auth, _provider); }
export async function signOut() { await _fbSignOut(_auth); }

export function onAuthReady(cb) {
  _subscribers.add(cb);
  if (_authResolved) { try { cb(_currentUser); } catch (e) {} }
  return () => _subscribers.delete(cb);
}
