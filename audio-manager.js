/**
 * audio-manager.js - 高品質サイバーパンクSFXシステム
 * Web Audio APIを使用したリアルタイム・シンセシス・エンジン
 */

class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.pool = {
            oscillators: [],
            gains: []
        };
        this.categories = {
            master: 1.0,
            sfx: 0.8,
            ui: 0.6,
            voice: 0.7,
            ambient: 0.5
        };
        this.gains = {};
        this.isMuted = false;
        this.soundMode = 'neon'; // 'neon' or 'soft'
        this.initialized = false;
        this.compressor = null;

        // 音量設定の読み込み
        this.loadSettings();

        // visibilitychangeイベントの登録
        document.addEventListener('visibilitychange', () => {
            if (this.ctx) {
                if (document.hidden) {
                    this.ctx.suspend();
                } else {
                    this.ctx.resume();
                }
            }
        });
    }

    async init() {
        if (this.initialized) return;

        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-10, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(40, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);
        this.compressor.connect(this.ctx.destination);

        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.compressor);
        this.updateMasterVolume();

        // カテゴリ別ゲインノードの作成
        for (const cat in this.categories) {
            if (cat === 'master') continue;
            const g = this.ctx.createGain();
            g.connect(this.masterGain);
            this.gains[cat] = g;
            this.updateCategoryVolume(cat);
        }

        this.initialized = true;
        console.log("[AudioManager] Initialized");
    }

    loadSettings() {
        const saved = localStorage.getItem('tb_audio_settings');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.categories = { ...this.categories, ...data.volumes };
                this.isMuted = data.isMuted || false;
                this.soundMode = data.soundMode || 'neon';
            } catch (e) { console.warn("Failed to load audio settings", e); }
        }
    }

    saveSettings() {
        localStorage.setItem('tb_audio_settings', JSON.stringify({
            volumes: this.categories,
            isMuted: this.isMuted,
            soundMode: this.soundMode
        }));
    }

    updateMasterVolume() {
        if (!this.masterGain) return;
        const vol = this.isMuted ? 0 : this.categories.master;
        this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
    }

    updateCategoryVolume(cat) {
        if (!this.gains[cat]) return;
        this.gains[cat].gain.setTargetAtTime(this.categories[cat], this.ctx.currentTime, 0.05);
    }

    setVolume(cat, val) {
        if (this.categories[cat] !== undefined) {
            this.categories[cat] = Math.max(0, Math.min(1, val));
            if (cat === 'master') this.updateMasterVolume();
            else this.updateCategoryVolume(cat);
            this.saveSettings();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.updateMasterVolume();
        this.saveSettings();
        return this.isMuted;
    }

    setSoundMode(mode) {
        this.soundMode = mode;
        this.saveSettings();
    }

    // --- SFX Generation ---

    // ノードプーリング (GainNodeの再利用)
    _getGain() {
        if (this.pool.gains.length > 0) {
            return this.pool.gains.pop();
        }
        return this.ctx.createGain();
    }

    _recycleGain(g) {
        if (this.pool.gains.length < 20) {
            g.disconnect();
            this.pool.gains.push(g);
        } else {
            g.disconnect();
        }
    }

    _getOscillator() {
        // OscillatorNodeは一度停止すると再開できないため、常に新規作成が必要だが
        // メモリ管理のためにメソッド化しておく
        return this.ctx.createOscillator();
    }

    _playNote(params) {
        if (!this.initialized || this.isMuted) return;
        const { freq, type = 'sine', duration = 0.1, gain = 0.5, category = 'sfx', attack = 0.01, pitchSlide = 0 } = params;

        const osc = this._getOscillator();
        const g = this._getGain();
        const now = this.ctx.currentTime;

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (pitchSlide !== 0) {
            try {
                osc.frequency.exponentialRampToValueAtTime(Math.max(0.001, freq + pitchSlide), now + duration);
            } catch(e) {}
        }

        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(gain, now + attack);
        g.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(g);
        g.connect(this.gains[category] || this.masterGain);

        osc.start(now);
        osc.stop(now + duration);

        // 自動切断と回収
        osc.onended = () => {
            osc.disconnect();
            this._recycleGain(g);
        };
    }

    _playNoise(params) {
        if (!this.initialized || this.isMuted) return;
        const { duration = 0.1, gain = 0.5, category = 'sfx', attack = 0.01, filterFreq = 1000, filterQ = 1 } = params;

        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterFreq, this.ctx.currentTime);
        filter.Q.setValueAtTime(filterQ, this.ctx.currentTime);

        const g = this._getGain(); // GainNode プーリングを使用
        const now = this.ctx.currentTime;

        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(gain, now + attack);
        g.gain.exponentialRampToValueAtTime(0.001, now + duration);

        noise.connect(filter);
        filter.connect(g);
        g.connect(this.gains[category] || this.masterGain);

        noise.start(now);
        noise.stop(now + duration);

        noise.onended = () => {
            noise.disconnect();
            filter.disconnect();
            this._recycleGain(g);
        };
    }

    // --- Specific Game Sounds ---

    playMove() {
        const type = this.soundMode === 'soft' ? 'sine' : 'square';
        const gain = this.soundMode === 'soft' ? 0.07 : 0.1;
        this._playNote({ freq: 440, type, duration: 0.04, gain, category: 'sfx' });
    }

    playRotate() {
        const type = this.soundMode === 'soft' ? 'sine' : 'triangle';
        const gain = this.soundMode === 'soft' ? 0.1 : 0.15;
        this._playNote({ freq: 660, type, duration: 0.06, gain, category: 'sfx', pitchSlide: 220 });
    }

    playSoftDrop() {
        this._playNote({ freq: 220, type: 'sine', duration: 0.05, gain: 0.05, category: 'sfx' });
    }

    playHardDrop() {
        const type = this.soundMode === 'soft' ? 'sine' : 'square';
        const gain = this.soundMode === 'soft' ? 0.2 : 0.3;
        const noiseGain = this.soundMode === 'soft' ? 0.05 : 0.1;
        this._playNote({ freq: 110, type, duration: 0.15, gain, category: 'sfx', pitchSlide: -50 });
        this._playNoise({ duration: 0.1, gain: noiseGain, filterFreq: 500 });
    }

    playLock() {
        const type = this.soundMode === 'soft' ? 'sine' : 'triangle';
        this._playNote({ freq: 150, type, duration: 0.1, gain: 0.2, category: 'sfx' });
    }

    playHold() {
        this._playNote({ freq: 880, type: 'sine', duration: 0.1, gain: 0.2, category: 'sfx', pitchSlide: 440 });
    }

    playSpawn() {
        this._playNote({ freq: 1200, type: 'sine', duration: 0.08, gain: 0.1, category: 'sfx', attack: 0.04 });
    }

    // Line Clears
    playClear(lines, combo = 0, isB2B = false) {
        const baseFreq = 440 * Math.pow(1.059, combo); // コンボでピッチ上昇
        const duration = 0.2 + (lines * 0.1);
        const gain = (this.soundMode === 'soft' ? 0.2 : 0.3) + (lines * 0.05);
        const type = this.soundMode === 'soft' ? 'sine' : 'square';

        // 基本音
        this._playNote({ freq: baseFreq, type, duration, gain, category: 'sfx', pitchSlide: baseFreq });

        // 高音の装飾
        this._playNote({ freq: baseFreq * 2, type: 'sine', duration: duration * 0.8, gain: gain * 0.5 });

        if (lines >= 4) { // Tetris
            const lowType = this.soundMode === 'soft' ? 'triangle' : 'sawtooth';
            this._playNote({ freq: 55, type: lowType, duration: 0.4, gain: 0.5, category: 'sfx' }); // 重低音
            this._playNoise({ duration: 0.5, gain: 0.2, filterFreq: 1500 });
        }

        if (isB2B) {
            setTimeout(() => {
                this._playNote({ freq: baseFreq * 1.5, type, duration: 0.2, gain: 0.2, pitchSlide: 200 });
            }, 50);
        }
    }

    playTSpin(lines = 0) {
        const type = this.soundMode === 'soft' ? 'triangle' : 'sawtooth';
        this._playNote({ freq: 80, type, duration: 0.4, gain: 0.6, category: 'sfx', pitchSlide: 40 });
        this._playNote({ freq: 40, type: 'sine', duration: 0.5, gain: 0.8 }); // サブベース
        this._playNoise({ duration: 0.3, gain: 0.1, filterFreq: 100 }); // 低域の衝撃

        if (lines > 0) {
            setTimeout(() => this.playClear(lines, 0, false), 100);
        }
    }

    playPerfectClear() {
        const notes = [440, 554.37, 659.25, 880]; // A Major chord
        notes.forEach((f, i) => {
            setTimeout(() => {
                this._playNote({ freq: f, type: 'square', duration: 1.0, gain: 0.3, category: 'sfx', pitchSlide: f });
            }, i * 100);
        });
    }

    playGarbage() {
        this._playNoise({ duration: 0.3, gain: 0.4, filterFreq: 400, attack: 0.05 });
        this._playNote({ freq: 60, type: 'sawtooth', duration: 0.3, gain: 0.3 });
    }

    playKO() {
        this._playNote({ freq: 40, type: 'sine', duration: 1.0, gain: 1.0, category: 'sfx' });
        this._playNote({ freq: 100, type: 'sawtooth', duration: 0.8, gain: 0.6, pitchSlide: -60 });
        this._playNoise({ duration: 1.2, gain: 0.5, filterFreq: 800 });
    }

    playWin() {
        const melody = [523.25, 659.25, 783.99, 1046.50]; // C Major
        melody.forEach((f, i) => {
            setTimeout(() => this._playNote({ freq: f, type: 'square', duration: 0.5, gain: 0.3 }), i * 150);
        });
    }

    playLose() {
        const melody = [440, 415.30, 392, 349.23]; // Descending
        melody.forEach((f, i) => {
            setTimeout(() => this._playNote({ freq: f, type: 'sawtooth', duration: 0.6, gain: 0.3 }), i * 200);
        });
    }

    // UI Sounds
    playHover() {
        this._playNote({ freq: 880, type: 'sine', duration: 0.03, gain: 0.1, category: 'ui' });
    }

    playClick() {
        this._playNote({ freq: 1200, type: 'sine', duration: 0.05, gain: 0.2, category: 'ui' });
    }

    playModalOpen() {
        this._playNote({ freq: 440, type: 'sine', duration: 0.15, gain: 0.2, category: 'ui', pitchSlide: 440 });
    }

    playModalClose() {
        this._playNote({ freq: 880, type: 'sine', duration: 0.1, gain: 0.2, category: 'ui', pitchSlide: -440 });
    }

    playCountdown(n) {
        const freq = n === 0 ? 880 : 440;
        this._playNote({ freq, type: 'square', duration: 0.15, gain: 0.25, category: 'ui' });
    }
}

// インスタンスの作成
const instance = new AudioManager();

// 初回インタラクションでの初期化
const initOnFirstClick = async () => {
    await instance.init();
    document.removeEventListener('click', initOnFirstClick);
    document.removeEventListener('keydown', initOnFirstClick);
};
document.addEventListener('click', initOnFirstClick, { once: true });
document.addEventListener('keydown', initOnFirstClick, { once: true });

export const audioManager = instance;
