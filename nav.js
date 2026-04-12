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

/* Mobile: hide text, show dots */
@media (max-width: 480px) {
  .tb-nav-logo span { display: none; }
  .tb-nav-link { padding: 7px 8px; font-size: 7px; letter-spacing: 0; }
}
@media (max-width: 360px) {
  .tb-nav-link span { display: none; }
  .tb-nav-dot { width: 8px; height: 8px; }
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