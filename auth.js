/**
 * auth.js — Firebase Google 認証 + プロフィールキャッシュモジュール v2
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  signOut as _fbSignOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { FB_CONFIG } from './config.js';

const _app      = getApps().length ? getApps()[0] : initializeApp(FB_CONFIG);
const _auth     = getAuth(_app);
const _provider = new GoogleAuthProvider();

// プロフィールキャッシュ
let _cachedProfile = null;
let _currentUser   = null;
let _authResolved  = false;
const _subscribers = new Set();

async function _loadProfile(uid) {
  try {
    const { getFirestore, doc, getDoc } = await import(
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
    );
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
  if (!_currentUser) return null;
  await _loadProfile(_currentUser.uid);
  _notify();
  return _cachedProfile;
}

export function getPlayerName() {
  if (!_currentUser) return null;
  const raw = (_cachedProfile?.displayName || _currentUser.displayName || _currentUser.email || 'PLAYER')
    .trim().replace(/\//g, '_').replace(/\.\./g, '__');
  return raw.slice(0, 12) || 'PLAYER';
}

export async function signIn()  { await signInWithPopup(_auth, _provider); }
export async function signOut() { await _fbSignOut(_auth); }

export function onAuthReady(cb) {
  _subscribers.add(cb);
  if (_authResolved) { try { cb(_currentUser); } catch (e) {} }
  return () => _subscribers.delete(cb);
}

// ── CSS ──────────────────────────────────────────────────────
const _CSS = `
.auth-widget{width:100%;margin-bottom:16px;font-family:'Orbitron',monospace}
.auth-widget-inner{display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(0,245,255,.04);border:1px solid rgba(0,245,255,.18);border-radius:3px;transition:border-color .2s}
.auth-widget-inner.auth-logged-in{background:rgba(0,245,255,.06);border-color:rgba(0,245,255,.35)}
.auth-google-btn{display:flex;align-items:center;gap:8px;flex:1;padding:9px 14px;background:#fff;color:#222;border:none;border-radius:3px;cursor:pointer;font-family:'Orbitron',monospace;font-size:10px;font-weight:700;letter-spacing:1px;transition:opacity .15s,transform .12s;justify-content:center}
.auth-google-btn:hover{opacity:.88;transform:translateY(-1px)}
.auth-google-btn svg{flex-shrink:0}
.auth-avatar{width:28px;height:28px;border-radius:50%;border:2px solid #00f5ff;object-fit:cover;flex-shrink:0;box-shadow:0 0 8px rgba(0,245,255,.5)}
.auth-avatar-initials{width:28px;height:28px;border-radius:50%;border:2px solid #00f5ff;background:linear-gradient(135deg,#7700ff,#00f5ff);display:flex;align-items:center;justify-content:center;font-family:'Press Start 2P',monospace;font-size:9px;color:#fff;flex-shrink:0;box-shadow:0 0 8px rgba(0,245,255,.5)}
.auth-name{flex:1;font-size:11px;color:#00f5ff;letter-spacing:1px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.auth-badge{font-size:7px;color:#aaff00;letter-spacing:1px;display:block;margin-top:2px}
.auth-logout-btn{background:transparent;border:1px solid rgba(74,96,128,.6);color:#4a6080;font-family:'Orbitron',monospace;font-size:8px;padding:5px 10px;border-radius:2px;cursor:pointer;letter-spacing:1px;transition:all .2s;white-space:nowrap;flex-shrink:0}
.auth-logout-btn:hover{border-color:#ff0080;color:#ff0080}
.auth-label{font-size:8px;color:#4a6080;letter-spacing:2px;margin-bottom:6px;display:block;font-family:'Orbitron',monospace}
`;
let _cssInjected = false;
function _injectCSS() {
  if (_cssInjected) return; _cssInjected = true;
  const s = document.createElement('style'); s.textContent = _CSS; document.head.appendChild(s);
}

export function mountAuthWidget(containerId, opts = {}) {
  _injectCSS();
  const container = document.getElementById(containerId);
  if (!container) return;

  function _syncNameInput(user) {
    if (!opts.nameInputId) return;
    const inp = document.getElementById(opts.nameInputId);
    if (!inp) return;
    if (user) {
      const name = (_cachedProfile?.displayName || user.displayName || user.email || 'PLAYER')
        .trim().replace(/\//g, '_').slice(0, 12);
      inp.value = name; inp.readOnly = true;
      inp.style.opacity = '0.6'; inp.style.cursor = 'not-allowed';
      inp.title = 'ログイン中はアカウント名が使用されます。プロフィールから変更できます。';
    } else {
      inp.readOnly = false; inp.style.opacity = ''; inp.style.cursor = ''; inp.title = '';
    }
  }

  function _render(user) {
    _syncNameInput(user);
    if (user) {
      const photoURL = _cachedProfile?.customPhotoURL || _cachedProfile?.photoURL || user.photoURL;
      const name     = _cachedProfile?.displayName || user.displayName || user.email || 'PLAYER';
      const initials = name.slice(0, 2).toUpperCase();
      const avatarHtml = photoURL
        ? `<img class="auth-avatar" src="${photoURL}" alt="avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="auth-avatar-initials" style="display:none">${initials}</div>`
        : `<div class="auth-avatar-initials">${initials}</div>`;
      container.innerHTML = `
        <span class="auth-label">ACCOUNT</span>
        <div class="auth-widget-inner auth-logged-in">
          ${avatarHtml}
          <div class="auth-name">${name.slice(0,20)}<span class="auth-badge">▶ LOGGED IN</span></div>
          <button class="auth-logout-btn" id="authLogout_${containerId}">ログアウト</button>
        </div>`;
      document.getElementById(`authLogout_${containerId}`).onclick = async () => { await signOut(); opts.onLogout?.(); };
    } else {
      container.innerHTML = `
        <span class="auth-label">ACCOUNT</span>
        <div class="auth-widget-inner">
          <button class="auth-google-btn" id="authLogin_${containerId}">
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.7 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.7 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.4 26.8 36 24 36c-5.2 0-9.7-3.3-11.3-8H6.1C9.4 35.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.7-.4-3.9z"/>
            </svg>
            Googleでログイン
          </button>
        </div>`;
      document.getElementById(`authLogin_${containerId}`).onclick = async () => {
        try { await signIn(); opts.onLogin?.(); }
        catch (e) { if (e.code !== 'auth/popup-closed-by-user') console.error(e); }
      };
    }
  }

  onAuthReady(user => _render(user));
}