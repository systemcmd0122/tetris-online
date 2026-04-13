/**
 * input-handler.js
 * Robust Input Handling for TETRIS BATTLE (DAS/ARR)
 */

export class InputHandler {
  constructor(game, options = {}) {
    this.game = game;
    this.DAS = options.DAS || 167;
    this.ARR = options.ARR || 33;
    this.SDR = options.SDR || 50; // Soft Drop Rate

    this.keys = new Set();
    this.dasTimer = null;
    this.dasDir = 0;
    this.arrTimer = null;
    this.sdTimer = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
  }

  attach() {
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
  }

  detach() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    this.stopAll();
  }

  stopAll() {
    this.stopDAS();
    this.stopSD();
    this.keys.clear();
  }

  _onKeyDown(e) {
    // Block scrolling keys when game is active
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
      if (document.body.classList.contains('game-active')) {
        e.preventDefault();
      }
    }

    if (this.keys.has(e.code)) return;
    this.keys.add(e.code);

    if (!this.game || this.game.over) return;

    switch (e.code) {
      case 'ArrowLeft':
        this.startDAS(-1);
        break;
      case 'ArrowRight':
        this.startDAS(1);
        break;
      case 'ArrowUp':
      case 'KeyX':
        this.game.rotate(1);
        break;
      case 'KeyZ':
        this.game.rotate(-1);
        break;
      case 'ArrowDown':
        this.startSD();
        break;
      case 'Space':
        this.game.hardDrop();
        break;
      case 'KeyC':
      case 'ShiftLeft':
      case 'ShiftRight':
        this.game.hold();
        break;
    }
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
    if (e.code === 'ArrowLeft' && this.dasDir === -1) this.stopDAS();
    if (e.code === 'ArrowRight' && this.dasDir === 1) this.stopDAS();
    if (e.code === 'ArrowDown') this.stopSD();
  }

  startDAS(dir) {
    if (this.dasDir === dir) return;
    this.stopDAS();
    this.dasDir = dir;
    this.game.move(dir);
    this.dasTimer = setTimeout(() => {
      this.arrTimer = setInterval(() => {
        if (this.game && !this.game.over) this.game.move(dir);
      }, this.ARR);
    }, this.DAS);
  }

  stopDAS() {
    clearTimeout(this.dasTimer);
    clearInterval(this.arrTimer);
    this.dasTimer = null;
    this.arrTimer = null;
    this.dasDir = 0;
  }

  startSD() {
    if (this.sdTimer) return;
    this.game.softDrop();
    this.sdTimer = setInterval(() => {
      if (this.game && !this.game.over) this.game.softDrop();
    }, this.SDR);
  }

  stopSD() {
    clearInterval(this.sdTimer);
    this.sdTimer = null;
  }

  // Mobile support helpers
  handleTouchStart(action, ...args) {
    if (!this.game || this.game.over) return;
    switch(action) {
      case 'left': this.startDAS(-1); break;
      case 'right': this.startDAS(1); break;
      case 'down': this.startSD(); break;
      case 'rotateR': this.game.rotate(1); break;
      case 'rotateL': this.game.rotate(-1); break;
      case 'hard': this.game.hardDrop(); break;
      case 'hold': this.game.hold(); break;
    }
  }

  handleTouchEnd(action) {
    if (action === 'left' || action === 'right') this.stopDAS();
    if (action === 'down') this.stopSD();
  }
}
