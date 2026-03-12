import { db, ref, set, get, update, remove, persistLog } from './firebase-init.js';
import { getServerTime } from './utils.js';

export async function createRoom(playerName, mode) {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const roomRef = ref(db, 'rooms/' + code);
  const snap = await get(roomRef);
  if (snap.exists()) return createRoom(playerName, mode);

  const roomData = {
    status: 'waiting',
    mode: mode,
    players: {
      p1: { name: playerName, role: 'p1' }
    },
    ts: Date.now()
  };
  await set(roomRef, roomData);
  persistLog(`Room ${code} created by ${playerName}`, 'info', { code, mode });
  return { roomCode: code, role: 'p1' };
}

export async function joinRoom(code, playerName) {
  const roomRef = ref(db, 'rooms/' + code);
  const snap = await get(roomRef);
  if (!snap.exists()) throw new Error('ルームが見つかりません');
  const d = snap.val();
  if (d.status !== 'waiting') throw new Error('既に対戦が開始されているか、終了しています');

  const players = d.players || {};
  const count = Object.keys(players).length;
  if (count >= 4) throw new Error('ルームが満員です');

  const role = 'p' + (count + 1);
  await update(ref(db, `rooms/${code}/players/${role}`), { name: playerName, role: role });
  persistLog(`Player ${playerName} joined room ${code}`, 'info', { code, role });
  return { role, mode: d.mode };
}

export async function startMultiplayerGame(code) {
  const startAt = getServerTime() + 4000;
  await update(ref(db, 'rooms/' + code), { status: 'ready', gameStartAt: startAt });
}
