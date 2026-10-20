const PREFIX = "fintracker";

export const KEYS = {
  transactions: `${PREFIX}.transactions`,
  categories: `${PREFIX}.categories`,
  accounts: `${PREFIX}.accounts`,
  savings: `${PREFIX}.savings`,
  prefs: `${PREFIX}.prefs`,
};

// The store boots synchronously at import time, so loadJSON/saveJSON stay
// synchronous on top of an in-memory cache that initStorage() fills from
// IndexedDB before the app graph is imported. Writes go through asynchronously.
const DB_NAME = PREFIX;
const DB_VERSION = 1;
const STORE = "kv";

// index.html needs the theme before first paint, which IndexedDB (async)
// cannot serve — storage.js mirrors just that one fact into localStorage.
const THEME_MIRROR = `${PREFIX}.theme`;

const cache = new Map();
const dirty = new Map();
let db = null;
let idbBroken = false;
let flushing = false;
let initPromise = null;

function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("transaction aborted"));
  });
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
}

function writeThemeMirror(prefs) {
  try {
    if (prefs && prefs.theme) localStorage.setItem(THEME_MIRROR, JSON.stringify({ theme: prefs.theme }));
  } catch {
    // best-effort: preferences.js re-applies the class after boot anyway
  }
}

// One-time move of the pre-IndexedDB localStorage keys. IndexedDB wins when
// both hold a key, and the legacy copy is dropped only after the new one has
// committed, so a failed migration retries on the next load.
async function migrateLegacyKeys() {
  const legacy = Object.values(KEYS).filter(
    key => !cache.has(key) && localStorage.getItem(key) !== null
  );
  for (const key of legacy) {
    try {
      cache.set(key, JSON.parse(localStorage.getItem(key)));
    } catch {
      localStorage.removeItem(key); // unparsable data can never be migrated
    }
  }
  const movable = legacy.filter(key => cache.has(key));
  if (!movable.length) return;
  const tx = db.transaction(STORE, "readwrite");
  for (const key of movable) tx.objectStore(STORE).put(cache.get(key), key);
  await txDone(tx);
  for (const key of movable) localStorage.removeItem(key);
}

export function initStorage() {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        db = await openDB();
        const tx = db.transaction(STORE, "readonly");
        // All requests are queued up front: a transaction can commit between
        // awaited requests on the same store in some engines.
        const loads = Object.values(KEYS).map(key => req(tx.objectStore(STORE).get(key)));
        const values = await Promise.all(loads);
        Object.values(KEYS).forEach((key, i) => {
          if (values[i] !== undefined) cache.set(key, values[i]);
        });
      } catch (err) {
        // A locked-down or missing IndexedDB (some private modes) must not
        // cost the app its persistence — fall back to localStorage.
        db = null;
        idbBroken = true;
        console.warn("FinTrack: IndexedDB unavailable, using localStorage", err);
        return;
      }
      try {
        await migrateLegacyKeys();
        writeThemeMirror(cache.get(KEYS.prefs));
      } catch (err) {
        console.warn("FinTrack: legacy localStorage not migrated", err);
      }
    })();
  }
  return initPromise;
}

export function loadJSON(key, fallback) {
  try {
    if (idbBroken) {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    }
    return cache.has(key) ? cache.get(key) : fallback;
  } catch {
    return fallback;
  }
}

// Writes coalesce per key and flush in one transaction, so a burst of actions
// (an import touches four keys) costs a single IndexedDB commit.
function queueWrite(key, value) {
  dirty.set(key, value);
  if (!flushing) {
    flushing = true;
    queueMicrotask(flush);
  }
}

async function flush() {
  if (!dirty.size || !db || idbBroken) {
    flushing = false;
    return;
  }
  const batch = [...dirty];
  dirty.clear();
  flushing = false;
  try {
    const tx = db.transaction(STORE, "readwrite");
    for (const [key, value] of batch) tx.objectStore(STORE).put(value, key);
    await txDone(tx);
  } catch (err) {
    console.error("FinTrack: could not persist to IndexedDB", err);
  } finally {
    if (dirty.size) queueMicrotask(flush); // writes queued while flushing
  }
}

export function saveJSON(key, value) {
  try {
    if (idbBroken) {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      cache.set(key, value);
      if (key === KEYS.prefs) writeThemeMirror(value);
      queueWrite(key, value);
    }
  } catch (err) {
    console.error(`FinTrack: could not persist "${key}"`, err);
  }
}

export function clearAll() {
  for (const key of Object.values(KEYS)) {
    cache.delete(key);
    dirty.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      // a blocked localStorage must not stop the IndexedDB clear below
    }
  }
  try {
    localStorage.removeItem(THEME_MIRROR);
  } catch {
    // same best-effort treatment
  }
  if (db && !idbBroken) {
    try {
      txDone(db.transaction(STORE, "readwrite").objectStore(STORE).clear()).catch(err => {
        console.error("FinTrack: could not clear IndexedDB", err);
      });
    } catch (err) {
      console.error("FinTrack: could not clear IndexedDB", err);
    }
  }
}

// rows: array of arrays. Excel needs the UTF-8 BOM to read non-ASCII, and the
// separator must differ from the locale's decimal mark or amounts split columns.
export function toCSV(rows, separator = ",") {
  const esc = v => {
    const s = String(v ?? "");
    return s.includes(separator) || s.includes('"') || /[\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `\uFEFF${rows.map(r => r.map(esc).join(separator)).join("\r\n")}\r\n`;
}

export function downloadFile(name, content, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

// v2 added accounts; v1 snapshots import with `accounts: null` so the store
// can seed defaults and back-fill accountId on the old records.
export function exportSnapshot(transactions, categories, prefs, accounts) {
  return JSON.stringify(
    {
      app: "fintracker",
      version: 2,
      exportedAt: new Date().toISOString(),
      transactions,
      categories,
      accounts: accounts || [],
      preferences: prefs,
    },
    null,
    2
  );
}

export function importSnapshot(text) {
  let snap;
  try {
    snap = JSON.parse(text);
  } catch {
    throw new Error("Not a valid JSON file.");
  }
  if (!snap || !Array.isArray(snap.transactions) || !Array.isArray(snap.categories)) {
    throw new Error("Invalid snapshot: expected arrays of transactions and categories.");
  }
  const cleanTx = snap.transactions.filter(t => {
    if (!t || typeof t.id !== "string" || typeof t.date !== "string" ||
        typeof t.amount !== "number" || typeof t.description !== "string") return false;
    // A transfer needs both ends; every other record needs a category.
    return t.type === "transfer" ? !!(t.fromAccountId && t.toAccountId) : !!t.categoryId;
  });
  const cleanCat = snap.categories.filter(
    c => c && typeof c.id === "string" && typeof c.name === "string" && c.color
  );
  const cleanAcc = Array.isArray(snap.accounts)
    ? snap.accounts.filter(a => a && typeof a.id === "string" && typeof a.name === "string")
    : null;
  return {
    transactions: cleanTx,
    categories: cleanCat,
    accounts: cleanAcc && cleanAcc.length ? cleanAcc : null,
    preferences: snap.preferences && typeof snap.preferences === "object" ? snap.preferences : null,
  };
}
