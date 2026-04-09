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
  { id: 'home',    href: 'index.html',        label: 'HOME',    cls: 'home'    },
  { id: 'battle',  href: 'tetris-multi.html',  label: 'ONLINE',  cls: 'battle'  },
  { id: 'bot',     href: 'tetris-battle.html', label: 'VS BOT',  cls: 'bot'     },
  { id: 'sprint',  href: 'sprint.html',        label: 'SPRINT',  cls: 'sprint'  },
  { id: 'exam',    href: 'exam.html',          label: '検定',    cls: 'exam', isNew: true },
  { id: 'profile', href: 'profile.html',       label: 'PROFILE', cls: 'profile', authOnly: true },
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