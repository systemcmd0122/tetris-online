/**
 * nav.js — 共通ナビゲーション v1.0
 * TETRIS BATTLE
 * すべてのページでimportして mountNav() を呼ぶだけで使える。
 */

const _NAV_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Orbitron:wght@400;700&display=swap');

#tb-nav {
  position: sticky; top: 0; z-index: 200;
  background: rgba(4,6,15,.96);
  border-bottom: 1px solid rgba(0,245,255,.18);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  font-family: 'Orbitron', monospace;
}
.tb-nav-inner {
  max-width: 1000px; margin: 0 auto;
  display: flex; align-items: center;
  padding: 0 16px; height: 52px; gap: 4px;
}
.tb-nav-logo {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px; color: #00f5ff;
  text-decoration: none; letter-spacing: 2px;
  text-shadow: 0 0 12px rgba(0,245,255,.6);
  flex-shrink: 0; margin-right: 8px;
  display: flex; align-items: center; gap: 8px;
}
.tb-nav-logo .logo-blocks {
  display: flex; gap: 2px; align-items: flex-end;
}
.tb-nav-logo .lb {
  width: 7px; border-radius: 1px;
  animation: navBlockFloat 2s ease-in-out infinite;
}
.tb-nav-logo .lb:nth-child(1){height:14px;background:#00f5ff;animation-delay:0s}
.tb-nav-logo .lb:nth-child(2){height:10px;background:#ff0080;animation-delay:.2s}
.tb-nav-logo .lb:nth-child(3){height:14px;background:#aaff00;animation-delay:.4s}
.tb-nav-logo .lb:nth-child(4){height:7px;background:#ffff00;animation-delay:.6s}
@keyframes navBlockFloat {
  0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)}
}
.tb-nav-links {
  display: flex; align-items: center; gap: 2px; flex: 1;
  overflow-x: auto; scrollbar-width: none;
}
.tb-nav-links::-webkit-scrollbar { display: none; }
.tb-nav-link {
  display: flex; align-items: center; gap: 5px;
  padding: 7px 10px; border-radius: 3px;
  text-decoration: none; font-size: 8px;
  letter-spacing: 1px; color: #4a6080;
  transition: color .2s, background .2s;
  white-space: nowrap; flex-shrink: 0; font-weight: 700;
  position: relative;
}
.tb-nav-link:hover { color: #e0f0ff; background: rgba(0,245,255,.06); }
.tb-nav-link.active { color: #00f5ff; background: rgba(0,245,255,.09); }
.tb-nav-link.active::after {
  content: ''; position: absolute; bottom: -1px; left: 6px; right: 6px;
  height: 2px; background: #00f5ff; border-radius: 2px;
  box-shadow: 0 0 6px rgba(0,245,255,.7);
}
.tb-nav-dot {
  width: 6px; height: 6px; border-radius: 1px; flex-shrink: 0;
}
.tb-nav-link-home .tb-nav-dot   { background: #00f5ff; box-shadow: 0 0 4px #00f5ff; }
.tb-nav-link-battle .tb-nav-dot { background: #ff0080; box-shadow: 0 0 4px #ff0080; }
.tb-nav-link-bot .tb-nav-dot    { background: #cc00ff; box-shadow: 0 0 4px #cc00ff; }
.tb-nav-link-sprint .tb-nav-dot { background: #aaff00; box-shadow: 0 0 4px #aaff00; }
.tb-nav-link-exam .tb-nav-dot   { background: #ffd700; box-shadow: 0 0 4px #ffd700; }
.tb-nav-link-profile .tb-nav-dot{ background: #ff8800; box-shadow: 0 0 4px #ff8800; }

/* NEW badge */
.tb-nav-new {
  font-family: 'Press Start 2P', monospace;
  font-size: 5px; background: #ff0080; color: #fff;
  padding: 1px 4px; border-radius: 2px; margin-left: 2px;
  letter-spacing: 0; animation: navNewPulse 1.5s ease-in-out infinite;
}
@keyframes navNewPulse {
  0%,100%{opacity:1} 50%{opacity:.5}
}

/* NOTIFICATION TOAST */
#tb-notify-container {
  position: fixed; bottom: 20px; right: 20px; z-index: 500;
  display: flex; flex-direction: column; gap: 12px;
  max-width: 400px; pointer-events: none;
}
.tb-notify-toast {
  pointer-events: auto;
  display: flex; align-items: center; gap: 12px;
  background: rgba(8,13,24,.95); border: 1px solid rgba(0,245,255,.3);
  border-radius: 6px; padding: 14px 18px;
  font-size: 11px; letter-spacing: 1px;
  color: var(--tx); backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0,0,0,.6), 0 0 24px rgba(0,245,255,.1);
  animation: tbNotifySlideIn .4s cubic-bezier(.34,1.56,.64,1);
  animation-fill-mode: both;
}
.tb-notify-toast.removing {
  animation: tbNotifySlideOut .3s cubic-bezier(.2,.01,.2,.99) forwards;
}
@keyframes tbNotifySlideIn {
  from { transform: translateX(420px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes tbNotifySlideOut {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(420px); opacity: 0; }
}
.tb-notify-icon {
  font-size: 18px; flex-shrink: 0; filter: drop-shadow(0 0 4px currentColor);
}
.tb-notify-content {
  flex: 1; line-height: 1.5;
}
.tb-notify-title {
  font-weight: 700; letter-spacing: 1px; margin-bottom: 2px;
}
.tb-notify-desc {
  font-size: 9px; color: rgba(224,240,255,.7); letter-spacing: .5px;
}
.tb-notify-close {
  background: none; border: none; color: rgba(74,96,128,.7);
  cursor: pointer; font-size: 14px; line-height: 1; padding: 0;
  flex-shrink: 0; transition: color .2s;
}
.tb-notify-close:hover { color: var(--tx); }
/* Toast type colors */
.tb-notify-toast.ok { border-color: rgba(170,255,0,.4); }
.tb-notify-toast.ok .tb-notify-icon { color: #aaff00; }
.tb-notify-toast.ok .tb-notify-title { color: #aaff00; }
.tb-notify-toast.warn { border-color: rgba(255,170,0,.4); background: rgba(8,13,24,.95); }
.tb-notify-toast.warn .tb-notify-icon { color: #ffaa00; }
.tb-notify-toast.warn .tb-notify-title { color: #ffaa00; }
.tb-notify-toast.err { border-color: rgba(255,51,85,.4); }
.tb-notify-toast.err .tb-notify-icon { color: #ff3355; }
.tb-notify-toast.err .tb-notify-title { color: #ff3355; }
.tb-notify-toast.info { border-color: rgba(0,245,255,.3); }
.tb-notify-toast.info .tb-notify-icon { color: #00f5ff; }
.tb-notify-toast.info .tb-notify-title { color: #00f5ff; }
.tb-notify-toast.special { border-color: rgba(204,0,255,.5); background: rgba(51,0,100,.4); }
.tb-notify-toast.special .tb-notify-icon { color: #ff00ff; filter: drop-shadow(0 0 8px #ff00ff); }
.tb-notify-toast.special .tb-notify-title { color: #ff00ff; }

/* Mobile: stack to left */
@media (max-width: 480px) {
  #tb-notify-container { right: auto; left: 12px; max-width: calc(100vw - 24px); }
  .tb-notify-toast { width: 100%; }
  @keyframes tbNotifySlideIn {
    from { transform: translateX(-420px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes tbNotifySlideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(-420px); opacity: 0; }
  }
}

/* ── REMATCH REQUEST DIALOG ── */
#tb-rematch-dialog-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(2,4,8,.82);
  backdrop-filter: blur(6px);
  align-items: center;
  justify-content: center;
}
#tb-rematch-dialog-overlay.show {
  display: flex;
}
.tb-rematch-dialog {
  background: #080d18;
  border: 1px solid rgba(0,245,255,.35);
  border-radius: 6px;
  padding: 32px 36px;
  max-width: 420px;
  width: 90vw;
  text-align: center;
  position: relative;
  box-shadow: 0 0 60px rgba(0,245,255,.18), 0 20px 60px rgba(0,0,0,.7);
  animation: tbRematchDialogIn .35s cubic-bezier(.34,1.56,.64,1);
}
@keyframes tbRematchDialogIn {
  from { transform: scale(.82) translateY(20px); opacity: 0; }
  to   { transform: scale(1)   translateY(0);    opacity: 1; }
}
.tb-rematch-dialog::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, #00f5ff, #ff0080);
  border-radius: 6px 6px 0 0;
}
.tb-rematch-dialog-icon {
  font-size: 38px;
  margin-bottom: 14px;
  display: block;
  filter: drop-shadow(0 0 10px rgba(0,245,255,.6));
}
.tb-rematch-dialog-title {
  font-family: 'Press Start 2P', monospace;
  font-size: 13px;
  color: #00f5ff;
  letter-spacing: 2px;
  margin-bottom: 10px;
}
.tb-rematch-dialog-desc {
  font-family: 'Orbitron', monospace;
  font-size: 11px;
  color: #e0f0ff;
  letter-spacing: 1px;
  margin-bottom: 8px;
  line-height: 1.7;
}
.tb-rematch-dialog-room {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  color: #aaff00;
  letter-spacing: 3px;
  margin-bottom: 24px;
  padding: 6px 14px;
  background: rgba(170,255,0,.06);
  border: 1px solid rgba(170,255,0,.25);
  border-radius: 3px;
  display: inline-block;
}
.tb-rematch-dialog-countdown {
  font-family: 'Orbitron', monospace;
  font-size: 10px;
  color: #4a6080;
  letter-spacing: 1px;
  margin-bottom: 20px;
}
.tb-rematch-dialog-countdown span {
  color: #ffaa00;
  font-weight: 700;
}
.tb-rematch-dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.tb-rematch-accept-btn {
  padding: 12px 28px;
  background: linear-gradient(135deg, #00f5ff, #0088aa);
  color: #000;
  border: none;
  border-radius: 3px;
  font-family: 'Press Start 2P', monospace;
  font-size: 9px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: transform .15s, box-shadow .15s;
  box-shadow: 0 0 18px rgba(0,245,255,.35);
}
.tb-rematch-accept-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 24px rgba(0,245,255,.55);
}
.tb-rematch-decline-btn {
  padding: 12px 24px;
  background: transparent;
  color: #4a6080;
  border: 1px solid rgba(74,96,128,.5);
  border-radius: 3px;
  font-family: 'Press Start 2P', monospace;
  font-size: 9px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: color .2s, border-color .2s;
}
.tb-rematch-decline-btn:hover {
  color: #ff3355;
  border-color: #ff3355;
}
.tb-rematch-pending-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  color: #ff0080;
  letter-spacing: 1px;
  padding: 4px 10px;
  border: 1px solid rgba(255,0,128,.35);
  border-radius: 20px;
  background: rgba(255,0,128,.07);
  animation: tbRematchPendingPulse 1.4s ease-in-out infinite;
  margin-left: 6px;
  vertical-align: middle;
}
@keyframes tbRematchPendingPulse {
  0%,100% { opacity: 1; }
  50% { opacity: .4; }
}
#tb-nav-rematch-badge {
  display: none;
}
#tb-nav-rematch-badge.show {
  display: inline-flex;
}

/* Mobile: hide text, show dots */
@media (max-width: 480px) {
  .tb-nav-logo span { display: none; }
  .tb-nav-link { padding: 7px 8px; font-size: 7px; letter-spacing: 0; }
}
@media (max-width: 360px) {
  .tb-nav-link span { display: none; }
  .tb-nav-dot { width: 8px; height: 8px; }
}

/* ── MOBILE NOT SUPPORTED OVERLAY ── */
#tb-mobile-wall {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: #04060f;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: 'Orbitron', monospace;
  text-align: center;
  padding: 32px 24px;
}
#tb-mobile-wall.show { display: flex; }
.tb-mw-blocks {
  display: flex; gap: 5px; align-items: flex-end; margin-bottom: 28px;
}
.tb-mw-block { border-radius: 3px; animation: mwFloat 2s ease-in-out infinite; }
.tb-mw-block:nth-child(1){width:16px;height:32px;background:#00f5ff;box-shadow:0 0 10px #00f5ff;animation-delay:0s}
.tb-mw-block:nth-child(2){width:16px;height:20px;background:#ff0080;box-shadow:0 0 10px #ff0080;animation-delay:.18s}
.tb-mw-block:nth-child(3){width:16px;height:32px;background:#aaff00;box-shadow:0 0 10px #aaff00;animation-delay:.36s}
.tb-mw-block:nth-child(4){width:16px;height:14px;background:#ffff00;box-shadow:0 0 10px #ffff00;animation-delay:.54s}
.tb-mw-block:nth-child(5){width:16px;height:26px;background:#cc00ff;box-shadow:0 0 10px #cc00ff;animation-delay:.72s}
@keyframes mwFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
.tb-mw-logo {
  font-family:'Press Start 2P',monospace; font-size:15px; color:#00f5ff;
  letter-spacing:3px; text-shadow:0 0 18px rgba(0,245,255,.7); margin-bottom:6px;
}
.tb-mw-sub { font-size:7px; color:#4a6080; letter-spacing:3px; margin-bottom:32px; }
.tb-mw-badge {
  font-size:44px; margin-bottom:16px;
  filter:drop-shadow(0 0 8px rgba(255,0,128,.5));
}
.tb-mw-title {
  font-family:'Press Start 2P',monospace; font-size:9px; color:#ff0080;
  letter-spacing:2px; margin-bottom:14px; line-height:1.9;
}
.tb-mw-desc {
  font-size:10px; color:#4a6080; letter-spacing:.5px;
  line-height:2; max-width:300px; margin-bottom:0;
}
.tb-mw-desc b { color:#00f5ff; font-weight:normal; }
.tb-mw-scanlines {
  position:fixed; inset:0; pointer-events:none; z-index:100000;
  background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.14) 2px,rgba(0,0,0,.14) 4px);
}
`;

let _cssInjected = false;
function _injectCSS() {
  if (_cssInjected) return; _cssInjected = true;
  const s = document.createElement('style');
  s.textContent = _NAV_CSS;
  document.head.insertBefore(s, document.head.firstChild);
}

const _PAGES = [
  { id: 'home', href: 'index.html', label: 'HOME', cls: 'home' },
  { id: 'battle', href: 'tetris-multi.html', label: 'ONLINE', cls: 'battle' },
  { id: 'bot', href: 'tetris-battle.html', label: 'VS BOT', cls: 'bot' },
  { id: 'sprint', href: 'sprint.html', label: 'SPRINT', cls: 'sprint' },
  { id: 'exam', href: 'exam.html', label: '検定', cls: 'exam', isNew: true },
  { id: 'profile', href: 'profile.html', label: 'PROFILE', cls: 'profile', authOnly: true },
];

function _getActiveId() {
  const path = location.pathname.split('/').pop() || 'index.html';
  if (path === '' || path === 'index.html') return 'home';
  for (const p of _PAGES) {
    if (path === p.href) return p.id;
  }
  return null;
}

/**
 * ナビゲーションをページ上部に挿入する。
 * @param {object} [opts]
 * @param {boolean} [opts.showProfile=true]  PROFILEリンクを常に表示するか（未ログイン時も）
 */
export function mountNav(opts = {}) {
  _injectCSS();

  const nav = document.createElement('nav');
  nav.id = 'tb-nav';
  nav.setAttribute('aria-label', 'メインナビゲーション');

  const activeId = _getActiveId();

  const linksHtml = _PAGES.map(p => {
    const isActive = p.id === activeId;
    const newBadge = p.isNew ? '<span class="tb-nav-new">NEW</span>' : '';
    return `<a href="${p.href}" class="tb-nav-link tb-nav-link-${p.cls}${isActive ? ' active' : ''}" aria-current="${isActive ? 'page' : 'false'}" data-navid="${p.id}"><span class="tb-nav-dot"></span><span>${p.label}</span>${newBadge}</a>`;
  }).join('');

  nav.innerHTML = `
    <div class="tb-nav-inner">
      <a href="index.html" class="tb-nav-logo" aria-label="TETRIS BATTLE トップへ">
        <span class="logo-blocks" aria-hidden="true">
          <span class="lb"></span><span class="lb"></span>
          <span class="lb"></span><span class="lb"></span>
        </span>
        <span>TB</span>
      </a>
      <div class="tb-nav-links" role="list">
        ${linksHtml}
      </div>
    </div>`;

  // ページ先頭に挿入
  document.body.insertBefore(nav, document.body.firstChild);

  // 認証状態でPROFILEリンクを強調
  _watchAuthForNav();

  // スマホ非対応オーバーレイを表示
  _mountMobileWall();
}

async function _watchAuthForNav() {
  try {
    const { onAuthReady, getCachedProfile } = await import('./auth.js');
    onAuthReady(user => {
      const profLink = document.querySelector('.tb-nav-link-profile');
      if (!profLink) return;
      if (user) {
        const name = (getCachedProfile()?.displayName || user.displayName || 'PLAYER').slice(0, 8);
        profLink.style.color = '';
        const dot = profLink.querySelector('.tb-nav-dot');
        if (dot) dot.style.boxShadow = '0 0 8px #ff8800';
      }
    });
  } catch (e) { /* auth not available */ }
}


// ═══ MOBILE NOT SUPPORTED WALL ═══

function _isMobile() {
  // タッチデバイスかつ画面幅 768px 未満をモバイルと判定
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isNarrow = window.innerWidth < 768;
  return hasTouch && isNarrow;
}

function _mountMobileWall() {
  if (!_isMobile()) return;

  const wall = document.createElement('div');
  wall.id = 'tb-mobile-wall';
  wall.setAttribute('aria-live', 'polite');
  wall.innerHTML = `
    <div class="tb-mw-scanlines" aria-hidden="true"></div>
    <div class="tb-mw-blocks" aria-hidden="true">
      <div class="tb-mw-block"></div>
      <div class="tb-mw-block"></div>
      <div class="tb-mw-block"></div>
      <div class="tb-mw-block"></div>
      <div class="tb-mw-block"></div>
    </div>
    <div class="tb-mw-logo">TETRIS BATTLE</div>
    <div class="tb-mw-sub">ONLINE MULTIPLAYER</div>
    <div class="tb-mw-badge" aria-hidden="true">&#x1F5A5;</div>
    <div class="tb-mw-title">PC 専用</div>
    <div class="tb-mw-desc">
      このゲームは<b>PC・デスクトップブラウザ</b>専用です。<br>
      スマートフォン・タブレットには<br>
      現在対応していません。<br><br>
      <b>PCからアクセス</b>してお楽しみください。
    </div>
  `;
  document.body.appendChild(wall);
  requestAnimationFrame(() => wall.classList.add('show'));

  window.addEventListener('resize', () => {
    if (_isMobile()) {
      wall.classList.add('show');
    } else {
      wall.classList.remove('show');
    }
  });
}

// ═══ NOTIFICATION SYSTEM ═══

let _notifyContainer = null;

function _getNotifyContainer() {
  if (!_notifyContainer) {
    _notifyContainer = document.createElement('div');
    _notifyContainer.id = 'tb-notify-container';
    document.body.appendChild(_notifyContainer);
  }
  return _notifyContainer;
}

/**
 * 通知トーストを表示する。
 * @param {object} opts
 * @param {string} [opts.title] タイトル (必須)
 * @param {string} [opts.desc] 説明文 (オプション)
 * @param {string} [opts.icon='ℹ'] 絵文字またはアイコン (デフォルト: ℹ)
 * @param {string} [opts.type='info'] タイプ: 'ok', 'warn', 'err', 'info', 'special'
 * @param {number} [opts.duration=4000] 表示時間 (ミリ秒)
 */
export function showNotify(opts) {
  const {
    title = 'お知らせ',
    desc = '',
    icon = 'ℹ️',
    type = 'info',
    duration = 4000
  } = opts || {};

  const container = _getNotifyContainer();
  const toast = document.createElement('div');
  toast.className = `tb-notify-toast ${type || 'info'}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span class="tb-notify-icon">${icon}</span>
    <div class="tb-notify-content">
      <div class="tb-notify-title">${title}</div>
      ${desc ? `<div class="tb-notify-desc">${desc}</div>` : ''}
    </div>
    <button class="tb-notify-close" aria-label="閉じる">✕</button>
  `;

  container.appendChild(toast);

  const closeBtn = toast.querySelector('.tb-notify-close');
  closeBtn.addEventListener('click', () => removeToast(toast));

  // 自動非表示
  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }

  return toast;
}

function removeToast(el) {
  if (!el || !el.parentElement) return;
  el.classList.add('removing');
  setTimeout(() => {
    if (el.parentElement) el.parentElement.removeChild(el);
  }, 300);
}

/**
 * 成功通知を表示
 * @param {string} title
 * @param {string} [desc]
 */
export function notifyOk(title, desc = '') {
  return showNotify({ title, desc, icon: '✓', type: 'ok', duration: 3500 });
}

/**
 * エラー通知を表示
 * @param {string} title
 * @param {string} [desc]
 */
export function notifyErr(title, desc = '') {
  return showNotify({ title, desc, icon: '✕', type: 'err', duration: 5000 });
}

/**
 * 警告通知を表示
 * @param {string} title
 * @param {string} [desc]
 */
export function notifyWarn(title, desc = '') {
  return showNotify({ title, desc, icon: '⚠', type: 'warn', duration: 4500 });
}

/**
 * 情報通知を表示
 * @param {string} title
 * @param {string} [desc]
 */
export function notifyInfo(title, desc = '') {
  return showNotify({ title, desc, icon: 'ℹ️', type: 'info', duration: 4000 });
}

/**
 * スペシャル通知を表示（称号など）
 * @param {string} title
 * @param {string} [desc]
 * @param {string} [icon]
 */
export function notifySpecial(title, desc = '', icon = '🏆') {
  return showNotify({ title, desc, icon, type: 'special', duration: 5000 });
}

// ═══ GLOBAL REMATCH REQUEST SYSTEM ═══
// ホストがどのページにいても、非ホストからのリマッチリクエストをダイアログで受け取れるシステム

let _rematchListenerUnsub = null;
let _rematchDialogTimer = null;
let _rematchDb = null;
let _rematchCode = null;
let _rematchHostName = null;
let _rematchOnAccept = null;
let _rematchOnDecline = null;

/**
 * リマッチリクエストのグローバルリスナーをマウントする（ホスト側で呼ぶ）
 * @param {object} db  Firebase Realtime Database インスタンス
 * @param {string} roomCode  ルームコード
 * @param {string} hostName  ホストのプレイヤー名
 * @param {Function} onAccept  承認時のコールバック (requestData) => void
 * @param {Function} [onDecline]  拒否時のコールバック () => void
 */
export function mountRematchListener(db, roomCode, hostName, onAccept, onDecline) {
  unmountRematchListener(); // 既存があれば解除
  _rematchDb = db;
  _rematchCode = roomCode;
  _rematchHostName = hostName;
  _rematchOnAccept = onAccept;
  _rematchOnDecline = onDecline || (() => {});

  // Firebase動的インポートなしで使えるように引数でdbを受け取る
  const { ref, onValue } = _rematchFbFns || {};
  if (!ref || !onValue) {
    console.warn('[RematchListener] Firebase functions not registered. Call registerRematchFbFns() first.');
    return;
  }

  const reqRef = ref(db, 'multi/' + roomCode + '/rematch_request');
  _rematchListenerUnsub = onValue(reqRef, snap => {
    const d = snap.val();
    if (!d || d.status !== 'pending') return;
    // すでにダイアログが表示中なら無視
    if (document.getElementById('tb-rematch-dialog-overlay')?.classList.contains('show')) return;
    _showRematchDialog(d);
  });
}

/**
 * リマッチリクエストリスナーを解除する
 */
export function unmountRematchListener() {
  if (_rematchListenerUnsub) {
    try { _rematchListenerUnsub(); } catch (e) {}
    _rematchListenerUnsub = null;
  }
  if (_rematchDialogTimer) {
    clearInterval(_rematchDialogTimer);
    _rematchDialogTimer = null;
  }
  _hideRematchDialog();
}

// Firebase関数の参照（動的インポートなしで使えるよう登録式）
let _rematchFbFns = null;

/**
 * Firebase関数を登録する（tetris-multi.html側から一度だけ呼ぶ）
 * @param {{ ref, onValue, update, remove }} fns
 */
export function registerRematchFbFns(fns) {
  _rematchFbFns = fns;
}

function _showRematchDialog(reqData) {
  _ensureRematchDialogDOM();
  const overlay = document.getElementById('tb-rematch-dialog-overlay');
  const nameEl = document.getElementById('tb-rematch-req-name');
  const codeEl = document.getElementById('tb-rematch-req-code');
  const countEl = document.getElementById('tb-rematch-countdown-val');

  if (nameEl) nameEl.textContent = reqData.fromName || '対戦相手';
  if (codeEl) codeEl.textContent = 'ROOM: ' + (_rematchCode || '----');

  overlay.classList.add('show');

  // 60秒カウントダウン
  let remaining = 60;
  if (countEl) countEl.textContent = remaining;
  if (_rematchDialogTimer) clearInterval(_rematchDialogTimer);
  _rematchDialogTimer = setInterval(() => {
    remaining--;
    if (countEl) countEl.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(_rematchDialogTimer);
      _rematchDialogTimer = null;
      _declineRematch(true);
    }
  }, 1000);
}

function _hideRematchDialog() {
  const overlay = document.getElementById('tb-rematch-dialog-overlay');
  if (overlay) overlay.classList.remove('show');
  if (_rematchDialogTimer) {
    clearInterval(_rematchDialogTimer);
    _rematchDialogTimer = null;
  }
}

async function _acceptRematch() {
  _hideRematchDialog();
  const { ref, update } = _rematchFbFns || {};
  if (_rematchDb && _rematchCode && ref && update) {
    try {
      await update(ref(_rematchDb, 'multi/' + _rematchCode + '/rematch_request'), { status: 'accepted', acceptedAt: Date.now() });
    } catch (e) { console.error('[RematchListener] accept error:', e); }
  }
  if (_rematchOnAccept) _rematchOnAccept({ roomCode: _rematchCode });
}

async function _declineRematch(isTimeout = false) {
  _hideRematchDialog();
  const { ref, update } = _rematchFbFns || {};
  if (_rematchDb && _rematchCode && ref && update) {
    try {
      await update(ref(_rematchDb, 'multi/' + _rematchCode + '/rematch_request'), { status: isTimeout ? 'timeout' : 'declined', declinedAt: Date.now() });
    } catch (e) { console.error('[RematchListener] decline error:', e); }
  }
  if (_rematchOnDecline) _rematchOnDecline(isTimeout);
}

function _ensureRematchDialogDOM() {
  if (document.getElementById('tb-rematch-dialog-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'tb-rematch-dialog-overlay';
  overlay.innerHTML = `
    <div class="tb-rematch-dialog" role="dialog" aria-modal="true" aria-labelledby="tb-rematch-dialog-title">
      <span class="tb-rematch-dialog-icon">🎮</span>
      <div class="tb-rematch-dialog-title" id="tb-rematch-dialog-title">REMATCH REQUEST</div>
      <div class="tb-rematch-dialog-desc">
        <strong id="tb-rematch-req-name">対戦相手</strong> からリマッチリクエストが届いています
      </div>
      <div class="tb-rematch-dialog-room" id="tb-rematch-req-code">ROOM: ----</div>
      <div class="tb-rematch-dialog-countdown">
        <span id="tb-rematch-countdown-val">60</span> 秒以内に応答してください
      </div>
      <div class="tb-rematch-dialog-actions">
        <button class="tb-rematch-accept-btn" id="tb-rematch-accept-btn">▶ REMATCH</button>
        <button class="tb-rematch-decline-btn" id="tb-rematch-decline-btn">断る</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('tb-rematch-accept-btn').addEventListener('click', () => _acceptRematch());
  document.getElementById('tb-rematch-decline-btn').addEventListener('click', () => _declineRematch(false));
  // 背景クリックで拒否
  overlay.addEventListener('click', e => { if (e.target === overlay) _declineRematch(false); });
}