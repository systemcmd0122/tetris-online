import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, off, update, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot, deleteDoc, doc, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCjYKsc8eT9gDXEMQsfI0ZJ7UeuLwrDTxw",
  authDomain: "tetris-online-9c827.firebaseapp.com",
  databaseURL: "https://tetris-online-9c827-default-rtdb.firebaseio.com",
  projectId: "tetris-online-9c827",
  storageBucket: "tetris-online-9c827.firebasestorage.app",
  messagingSenderId: "1045054992314",
  appId: "1:1045054992314:web:7fea20b9be543d7cab3783"
};

const fbApp = initializeApp(firebaseConfig);
const db = getDatabase(fbApp);
const fs = getFirestore(fbApp);

async function persistLog(msg, type = 'info', details = {}, source = 'client') {
  try {
    await addDoc(collection(fs, 'site_logs'), {
      message: msg,
      type: type,
      details: details,
      timestamp: serverTimestamp(),
      source: source
    });
  } catch (e) { console.error('Log failed:', e); }
}

export {
  db, fs, persistLog,
  ref, set, get, onValue, off, update, remove, onDisconnect,
  collection, query, orderBy, limit, onSnapshot, deleteDoc, doc, getDocs, serverTimestamp, writeBatch
};
