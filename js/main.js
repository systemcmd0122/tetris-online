import { db, onValue, ref } from './firebase-config.js';
import { updateBotConfig } from './bot-controller.js';
import { toggleSound } from './sound-engine.js';
import { initInput } from './input-handler.js';
import {
  createRoom, joinRoom, leaveRoom, cancelWaiting, copyRoomCode, startBotGame,
  returnToLobbyFromForceStop, game, gameRunning
} from './network-manager.js';
import { initBackground, initPageLoader } from './animations.js';

// Attach to window for HTML onclick compatibility
window.toggleSound = toggleSound;
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.leaveRoom = leaveRoom;
window.cancelWaiting = cancelWaiting;
window.copyRoomCode = copyRoomCode;
window.startBotGame = startBotGame;
window.returnToLobbyFromForceStop = returnToLobbyFromForceStop;
window.toggleBotDifficulty = () => {
  const el = document.getElementById('botDifficulty');
  if (el) el.classList.toggle('show');
};

// Listen for bot config from Firebase
onValue(ref(db, 'config/bot'), snap => {
  const d = snap.val();
  if (d) {
    updateBotConfig(d.delays, d.noise);
  }
});

// Initialize systems
document.getElementById('statusText').textContent = 'ONLINE';
document.getElementById('statusText').className = 'status-online';

initInput(() => window.game || game, () => window.gameRunning || gameRunning);
initBackground('bgCanvas');
initPageLoader();

// Some helpers might need the current game state which is now in network-manager.
// We can either export it or keep it on window if absolutely necessary for legacy reasons.
// To keep things simple and functional, we'll try to use the imported versions.
