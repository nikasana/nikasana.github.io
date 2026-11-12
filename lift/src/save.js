// IndexedDB persistence plus text export/import.
const DB = 'lift-game', STORE = 'saves', VERSION = 1;

function open() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
export async function put(key, value) {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => { db.close(); res(); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  });
}
export async function get(key) {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => { db.close(); res(req.result); };
    req.onerror = () => { db.close(); rej(req.error); };
  });
}
export async function del(key) {
  const db = await open();
  return new Promise((res) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(key); tx.oncomplete = () => { db.close(); res(); }; });
}
export function exportText(obj) { return 'LIFT1:' + btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); }
export function importText(text) {
  const s = text.trim();
  if (!s.startsWith('LIFT1:')) throw new Error('bad');
  return JSON.parse(decodeURIComponent(escape(atob(s.slice(6)))));
}
