/**
 * audio-ui.js - サウンド設定UIコンポーネント
 */

const AUDIO_UI_CSS = `
.audio-settings-modal {
    position: fixed; inset: 0; background: rgba(0,0,0,0.85);
    z-index: 10000; display: none; align-items: center; justify-content: center;
    backdrop-filter: blur(8px); font-family: 'Orbitron', sans-serif;
}
.audio-settings-modal.show { display: flex; animation: audioFadeIn 0.3s ease; }
@keyframes audioFadeIn { from { opacity: 0; } to { opacity: 1; } }

.audio-card {
    background: #080d18; border: 1px solid #00f5ff66; border-radius: 8px;
    padding: 30px; width: min(400px, 90vw); position: relative;
    box-shadow: 0 0 30px #00f5ff22;
}
.audio-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: linear-gradient(90deg, #00f5ff, #ff0080); border-radius: 8px 8px 0 0;
}
.audio-title {
    font-family: 'Press Start 2P', cursive; font-size: 14px; color: #00f5ff;
    margin-bottom: 24px; text-align: center; letter-spacing: 2px;
}
.audio-close {
    position: absolute; top: 15px; right: 20px; background: none; border: none;
    color: #4a6080; font-size: 24px; cursor: pointer; transition: color 0.2s;
}
.audio-close:hover { color: #ff0080; }

.audio-row { margin-bottom: 20px; }
.audio-label {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 10px; color: #4a6080; margin-bottom: 8px; letter-spacing: 1px;
}
.audio-label span:last-child { color: #00f5ff; font-family: monospace; }

.audio-slider {
    width: 100%; height: 6px; background: #1a2540; border-radius: 3px;
    outline: none; -webkit-appearance: none; cursor: pointer;
}
.audio-slider::-webkit-slider-thumb {
    -webkit-appearance: none; width: 16px; height: 16px;
    background: #00f5ff; border: 2px solid #fff; border-radius: 50%;
    box-shadow: 0 0 10px #00f5ff;
}

.audio-btns { display: flex; gap: 10px; margin-top: 30px; }
.audio-btn {
    flex: 1; padding: 12px; border-radius: 4px; border: 1px solid #1a2540;
    background: transparent; color: #e0f0ff; font-family: 'Orbitron';
    font-size: 11px; cursor: pointer; transition: all 0.2s;
}
.audio-btn:hover { background: #ffffff08; border-color: #00f5ff; }
.audio-btn.primary { background: #00f5ff; color: #000; border: none; font-weight: bold; }
.audio-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 5px 15px #00f5ff66; }

.audio-mute-toggle {
    display: flex; align-items: center; gap: 10px; font-size: 12px;
    color: #e0f0ff; cursor: pointer; margin-top: 10px;
}
.audio-mute-toggle input { display: none; }
.audio-toggle-box {
    width: 40px; height: 20px; background: #1a2540; border-radius: 10px;
    position: relative; transition: background 0.3s;
}
.audio-toggle-box::after {
    content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
    background: #4a6080; border-radius: 50%; transition: all 0.3s;
}
input:checked + .audio-toggle-box { background: #00f5ff44; }
input:checked + .audio-toggle-box::after { left: 22px; background: #00f5ff; box-shadow: 0 0 10px #00f5ff; }

.audio-mode-selector {
    display: flex; gap: 8px; margin-bottom: 24px;
}
.audio-mode-btn {
    flex: 1; padding: 10px; border-radius: 4px; border: 1px solid #1a2540;
    background: transparent; color: #4a6080; font-family: 'Orbitron';
    font-size: 10px; cursor: pointer; transition: all 0.2s; letter-spacing: 1px;
}
.audio-mode-btn.active {
    border-color: #00f5ff; color: #00f5ff; background: #00f5ff11;
    box-shadow: 0 0 10px #00f5ff33;
}
`;

class AudioUI {
    constructor() {
        this.modal = null;
        this.injectCSS();
    }

    injectCSS() {
        const s = document.createElement('style');
        s.textContent = AUDIO_UI_CSS;
        document.head.appendChild(s);
    }

    createModal() {
        if (this.modal) return;

        const overlay = document.createElement('div');
        overlay.className = 'audio-settings-modal';
        overlay.id = 'audioSettingsModal';

        const am = audioManager;
        const vol = am.categories;

        overlay.innerHTML = `
            <div class="audio-card">
                <button class="audio-close">&times;</button>
                <div class="audio-title">SOUND SETTINGS</div>

                <div class="audio-label"><span>SOUND MODE</span></div>
                <div class="audio-mode-selector">
                    <button class="audio-mode-btn ${am.soundMode === 'neon' ? 'active' : ''}" data-mode="neon">NEON (CYBER)</button>
                    <button class="audio-mode-btn ${am.soundMode === 'soft' ? 'active' : ''}" data-mode="soft">SOFT (GENTLE)</button>
                </div>

                ${['master', 'sfx', 'ui', 'voice', 'ambient'].map(cat => `
                    <div class="audio-row">
                        <div class="audio-label">
                            <span>${cat.toUpperCase()} VOLUME</span>
                            <span id="val-${cat}">${Math.round(vol[cat] * 100)}%</span>
                        </div>
                        <input type="range" class="audio-slider" data-cat="${cat}"
                            min="0" max="1" step="0.01" value="${vol[cat]}">
                    </div>
                `).join('')}

                <label class="audio-mute-toggle">
                    <input type="checkbox" id="muteToggle" ${am.isMuted ? 'checked' : ''}>
                    <div class="audio-toggle-box"></div>
                    <span>MUTE ALL SOUNDS</span>
                </label>

                <div class="audio-btns">
                    <button class="audio-btn" id="audioTestBtn">TEST SOUND</button>
                    <button class="audio-btn primary" id="audioCloseBtn">CLOSE</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.modal = overlay;

        // Event Listeners
        const sliders = overlay.querySelectorAll('.audio-slider');
        sliders.forEach(s => {
            s.addEventListener('input', (e) => {
                const cat = e.target.dataset.cat;
                const val = parseFloat(e.target.value);
                am.setVolume(cat, val);
                document.getElementById(`val-${cat}`).textContent = `${Math.round(val * 100)}%`;
            });
        });

        overlay.querySelector('#muteToggle').addEventListener('change', () => {
            am.toggleMute();
            am.playClick();
        });

        const modeBtns = overlay.querySelectorAll('.audio-mode-btn');
        modeBtns.forEach(btn => {
            btn.onclick = () => {
                const mode = btn.dataset.mode;
                am.setSoundMode(mode);
                modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                am.playClick();
                if (mode === 'soft') am.playMove(); // Test sound
                else am.playHardDrop();
            };
        });

        overlay.querySelector('#audioTestBtn').addEventListener('click', () => {
            am.playClear(4, 0, true);
        });

        const close = () => {
            overlay.classList.remove('show');
            am.playModalClose();
        };

        overlay.querySelector('.audio-close').onclick = close;
        overlay.querySelector('#audioCloseBtn').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };
    }

    show() {
        this.createModal();
        this.modal.classList.add('show');
        audioManager.playModalOpen();

        // 最新の状態を反映
        const am = audioManager;
        this.modal.querySelector('#muteToggle').checked = am.isMuted;
        this.modal.querySelectorAll('.audio-mode-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === am.soundMode);
        });
        this.modal.querySelectorAll('.audio-slider').forEach(s => {
            s.value = am.categories[s.dataset.cat];
            document.getElementById(`val-${s.dataset.cat}`).textContent = `${Math.round(s.value * 100)}%`;
        });
    }
}

import { audioManager } from './audio-manager.js';

// インスタンスの作成
const instance = new AudioUI();

window.audioUI = instance;
export const audioUI = instance;
