const PREFIX = "fintracker";

export const KEYS = {
  transactions: `${PREFIX}.transactions`,
  categories: `${PREFIX}.categories`,
  prefs: `${PREFIX}.prefs`,
};

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`FinTrack: could not persist "${key}"`, err);
  }
}

export function clearAll() {
  for (const key of Object.values(KEYS)) localStorage.removeItem(key);
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

export function exportSnapshot(transactions, categories, prefs) {
  return JSON.stringify(
    {
      app: "fintracker",
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions,
      categories,
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
  const cleanTx = snap.transactions.filter(
    t => t && typeof t.id === "string" && typeof t.date === "string" &&
         typeof t.amount === "number" && typeof t.description === "string" && t.categoryId
  );
  const cleanCat = snap.categories.filter(
    c => c && typeof c.id === "string" && typeof c.name === "string" && c.color
  );
  return {
    transactions: cleanTx,
    categories: cleanCat,
    preferences: snap.preferences && typeof snap.preferences === "object" ? snap.preferences : null,
  };
}
