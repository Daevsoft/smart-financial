import { stateOf, listOf, Dispatcher } from "@daevsoft/jetz";
import { KEYS, loadJSON, saveJSON } from "../services/storage.js";
import { generateDemoData } from "../services/mockData.js";
import categorySeed from "../data/categories.json";

// ---------- Actions ----------

export const Actions = {
  TX_ADD: "tx/add",
  TX_UPDATE: "tx/update",
  TX_DELETE: "tx/delete",
  CAT_ADD: "cat/add",
  CAT_UPDATE: "cat/update",
  CAT_DELETE: "cat/delete",
  BUDGET_SET: "budget/set",
  PREFS_SET: "prefs/set",
  DATA_IMPORT: "data/import",
  DATA_DEMO: "data/demo",
  DATA_CLEAR: "data/clear",
  TREND_RANGE: "trend/range",
};

// ---------- Base state ----------

// Stored data may predate the icon-name migration (emoji icon fields).
const KNOWN_ICONS = new Set(categorySeed.map(c => c.icon));
function migrateIcons(cats) {
  let dirty = false;
  for (const c of cats) {
    if (!KNOWN_ICONS.has(c.icon)) {
      const seed = categorySeed.find(s => s.id === c.id);
      if (seed) {
        c.icon = seed.icon;
        dirty = true;
      }
    }
  }
  if (dirty) saveJSON(KEYS.categories, cats);
  return cats;
}

function boot() {
  let txs = loadJSON(KEYS.transactions, null);
  let cats = loadJSON(KEYS.categories, null);
  if (!Array.isArray(txs) || !Array.isArray(cats) || cats.length === 0) {
    const demo = generateDemoData();
    txs = demo.transactions;
    cats = demo.categories;
    saveJSON(KEYS.transactions, txs);
    saveJSON(KEYS.categories, cats);
  } else {
    migrateIcons(cats);
  }
  return { txs, cats };
}

const bootData = boot();

export const transactions = listOf(...bootData.txs);
export const categories = listOf(...bootData.cats);
// Defaults first so prefs saved before a key existed (e.g. language) still
// get the fallback value through stateOf's property walk.
export const prefs = stateOf({ theme: "light", currency: "USD", language: "en", ...loadJSON(KEYS.prefs, {}) });

// UI-local global state (filters + selected period). Written directly by
// controls; state/transactions.js watches them to re-derive lists.
export const filters = stateOf({ search: "", type: "all", categoryId: "all" });
export const selectedMonth = stateOf("all");

// Current hash route, synced by routes.js — lets the sidebar highlight active nav.
export const activeRoute = stateOf("/");

// ---------- Dispatcher (single mutation path for domain data) ----------

export const dispatcher = new Dispatcher();

const txIndex = id => transactions.values.findIndex(t => t.id === id);
const catIndex = id => categories.values.findIndex(c => c.id === id);

function replaceAll({ transactions: txs, categories: cats, preferences }) {
  transactions.set(txs);
  categories.set(cats);
  if (preferences) {
    prefs.theme.value = preferences.theme || "light";
    prefs.currency.value = preferences.currency || "USD";
  }
  filters.search.value = "";
  filters.type.value = "all";
  filters.categoryId.value = "all";
  selectedMonth.value = "all";
}

dispatcher.subscribe("store", (action, payload) => {
  switch (action) {
    case Actions.TX_ADD:
      transactions.push(payload);
      break;
    case Actions.TX_UPDATE:
      transactions.updateAt(txIndex(payload.id), t => ({ ...t, ...payload }));
      break;
    case Actions.TX_DELETE:
      transactions.removeAt(txIndex(payload));
      break;
    case Actions.BUDGET_SET:
      categories.updateAt(catIndex(payload.id), c => ({ ...c, budget: payload.budget }));
      break;
    case Actions.CAT_ADD:
      categories.push(payload);
      break;
    case Actions.CAT_UPDATE:
      categories.updateAt(catIndex(payload.id), c => ({ ...c, ...payload }));
      break;
    case Actions.CAT_DELETE: {
      const gone = categories.values.find(c => c.id === payload);
      categories.removeAt(catIndex(payload));
      if (gone) {
        // Re-home transactions that pointed at the deleted category so nothing
        // renders as "Uncategorized": prefer "other", else any same-type one.
        const fallback =
          categories.values.find(c => c.type === gone.type && c.id === "other") ||
          categories.values.find(c => c.type === gone.type);
        if (fallback) {
          transactions.set(
            transactions.values.map(t => (t.categoryId === gone.id ? { ...t, categoryId: fallback.id } : t))
          );
        }
      }
      if (filters.categoryId.value === payload) filters.categoryId.value = "all";
      break;
    }
    case Actions.PREFS_SET:
      for (const [key, val] of Object.entries(payload)) prefs[key].value = val;
      break;
    case Actions.DATA_IMPORT:
      migrateIcons(payload.categories || []);
      replaceAll(payload);
      break;
    case Actions.DATA_DEMO:
      replaceAll(generateDemoData());
      break;
    case Actions.DATA_CLEAR:
      transactions.clear();
      break;
  }
});

// Persistence runs after the store handler settles (waitFor guarantees order).
dispatcher.subscribe("persist", action => {
  dispatcher.waitFor("store");
  switch (action) {
    case Actions.TX_ADD:
    case Actions.TX_UPDATE:
    case Actions.TX_DELETE:
    case Actions.CAT_DELETE: // deletion may re-home transactions
    case Actions.DATA_IMPORT:
    case Actions.DATA_DEMO:
    case Actions.DATA_CLEAR:
      saveJSON(KEYS.transactions, transactions.values);
      break;
  }
  switch (action) {
    case Actions.BUDGET_SET:
    case Actions.CAT_ADD:
    case Actions.CAT_UPDATE:
    case Actions.CAT_DELETE:
    case Actions.DATA_IMPORT:
    case Actions.DATA_DEMO:
      saveJSON(KEYS.categories, categories.values);
      break;
    case Actions.PREFS_SET:
      saveJSON(KEYS.prefs, prefs.toObject());
      break;
  }
});
