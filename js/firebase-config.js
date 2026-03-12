import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const fbApp = initializeApp({
  apiKey: "AIzaSyCjYKsc8eT9gDXEMQsfI0ZJ7UeuLwrDTxw",
  authDomain: "tetris-online-9c827.firebaseapp.com",
  databaseURL: "https://tetris-online-9c827-default-rtdb.firebaseio.com",
  projectId: "tetris-online-9c827",
  storageBucket: "tetris-online-9c827.firebasestorage.app",
  messagingSenderId: "1045054992314",
  appId: "1:1045054992314:web:7fea20b9be543d7cab3783"
});

export const db = getDatabase(fbApp);
export const fs = getFirestore(fbApp);

let serverTimeOffset = 0;
onValue(ref(db, ".info/serverTimeOffset"), (snap) => {
  serverTimeOffset = snap.val() || 0;
});

export const getServerTime = () => Date.now() + serverTimeOffset;

export async function persistLog(msg, type = 'info', details = {}, source = 'client') {
  try {
    await addDoc(collection(fs, 'site_logs'), {
      message: msg,
      type: type,
      details: details,
      timestamp: serverTimestamp(),
      source: source
    });
  } catch (e) {
    console.error('Log failed:', e);
  }
}
