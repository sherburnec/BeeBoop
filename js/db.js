const DB_NAME = "soundboard";
const DB_VERSION = 1;
const STORES = ["sounds", "groups", "settings"];

let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore("sounds", { keyPath: "id" });
        db.createObjectStore("groups", { keyPath: "id" });
        db.createObjectStore("settings", { keyPath: "key" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

export function isQuotaError(err) {
  return !!err && err.name === "QuotaExceededError";
}

// Runs fn(tx) in one transaction and resolves with fn's result (a request's
// result is unwrapped) once the transaction has committed. Quota errors can
// surface on commit, so only tx completion counts as success.
async function run(storeNames, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    let result;
    const tx = db.transaction(storeNames, mode);
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
    try {
      const r = fn(tx);
      if (r && typeof r === "object" && "onsuccess" in r) {
        r.onsuccess = () => { result = r.result; };
      } else {
        result = r;
      }
    } catch (err) {
      reject(err);
      try { tx.abort(); } catch { /* already finished */ }
    }
  });
}

const byOrder = (a, b) => a.order - b.order;

export function addSound(sound) {
  return run("sounds", "readwrite", (tx) => tx.objectStore("sounds").add(sound));
}

export function getSound(id) {
  return run("sounds", "readonly", (tx) => tx.objectStore("sounds").get(id));
}

export async function getAllSounds() {
  const all = await run("sounds", "readonly", (tx) => tx.objectStore("sounds").getAll());
  return all.sort(byOrder);
}

// Merges `changes` into the stored record inside one transaction.
export function updateSound(id, changes) {
  return run("sounds", "readwrite", (tx) => {
    const store = tx.objectStore("sounds");
    const get = store.get(id);
    get.onsuccess = () => {
      if (!get.result) { tx.abort(); return; }
      store.put({ ...get.result, ...changes });
    };
  });
}

export function deleteSound(id) {
  return run("sounds", "readwrite", (tx) => tx.objectStore("sounds").delete(id));
}

export function addGroup(group) {
  return run("groups", "readwrite", (tx) => tx.objectStore("groups").add(group));
}

export async function getAllGroups() {
  const all = await run("groups", "readonly", (tx) => tx.objectStore("groups").getAll());
  return all.sort(byOrder);
}

export function updateGroup(id, changes) {
  return run("groups", "readwrite", (tx) => {
    const store = tx.objectStore("groups");
    const get = store.get(id);
    get.onsuccess = () => {
      if (!get.result) { tx.abort(); return; }
      store.put({ ...get.result, ...changes });
    };
  });
}

// Deleting a group makes its sounds ungrouped, in the same transaction.
export function deleteGroup(id) {
  return run(["groups", "sounds"], "readwrite", (tx) => {
    tx.objectStore("groups").delete(id);
    const sounds = tx.objectStore("sounds");
    const cursorReq = sounds.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      if (cursor.value.groupId === id) cursor.update({ ...cursor.value, groupId: null });
      cursor.continue();
    };
  });
}

export async function getSetting(key, fallback) {
  const row = await run("settings", "readonly", (tx) => tx.objectStore("settings").get(key));
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  return run("settings", "readwrite", (tx) => tx.objectStore("settings").put({ key, value }));
}

export function clearAll() {
  return run(STORES, "readwrite", (tx) => {
    STORES.forEach((name) => tx.objectStore(name).clear());
  });
}

// Writes a whole library in one transaction, so a failure (e.g. quota)
// aborts and leaves existing data untouched. With replace, clears first.
export function writeLibrary({ sounds, groups, settings }, replace) {
  return run(STORES, "readwrite", (tx) => {
    if (replace) STORES.forEach((name) => tx.objectStore(name).clear());
    sounds.forEach((s) => tx.objectStore("sounds").put(s));
    groups.forEach((g) => tx.objectStore("groups").put(g));
    settings.forEach((s) => tx.objectStore("settings").put(s));
  });
}
