import { stateOf, listOf, Dispatcher } from "@daevsoft/jetz";
import { KEYS, loadJSON, saveJSON } from "../services/storage.js";
import { generateDemoData } from "../services/mockData.js";
import categorySeed from "../data/categories.json";
import accountSeed from "../data/accounts.json";

// ---------- Actions ----------

export const Actions = {
  TX_ADD: "tx/add",
  TX_UPDATE: "tx/update",
  TX_DELETE: "tx/delete",
  CAT_ADD: "cat/add",
  CAT_UPDATE: "cat/update",
  CAT_DELETE: "cat/delete",
  ACC_ADD: "acc/add",
  ACC_UPDATE: "acc/update",
  ACC_DELETE: "acc/delete",
  BUDGET_SET: "budget/set",
  PREFS_SET: "prefs/set",
  SAVE_PLAN_SET: "save/plan",
  SAVE_PROMPT: "save/prompt",
  SAVE_SKIP: "save/skip",
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

// Accounts wrap every record: spending pulls from one, income lands in one, and
// a deposit account is where "save money" accumulates.
export const DEFAULT_ACCOUNT_ID = "cash";

function bootAccounts(stored) {
  if (Array.isArray(stored) && stored.length) {
    return stored.map(a => ({ color: "#94a3b8", icon: "package", kind: "custom", opening: 0, ...a }));
  }
  return accountSeed.map(a => ({ ...a }));
}

const firstSpendId = list => (list.find(a => a.kind !== "deposit") || list[0] || {}).id || DEFAULT_ACCOUNT_ID;

// `seeded` reports whether this load generated the demo dataset, which is what
// triggers the first-visit confirmation sheet.
function boot() {
  let txs = loadJSON(KEYS.transactions, null);
  let cats = loadJSON(KEYS.categories, null);
  const storedAccounts = loadJSON(KEYS.accounts, null);
  const accs = bootAccounts(storedAccounts);
  if (!Array.isArray(txs) || !Array.isArray(cats) || cats.length === 0) {
    const demo = generateDemoData();
    saveJSON(KEYS.transactions, demo.transactions);
    saveJSON(KEYS.categories, demo.categories);
    saveJSON(KEYS.accounts, demo.accounts);
    return {
      txs: demo.transactions,
      cats: demo.categories,
      accounts: demo.accounts,
      seeded: true,
    };
  }
  migrateIcons(cats);
  // A ledger written before accounts existed has no accountId anywhere: give
  // each record the default wallet so balances and pickers stay meaningful.
  let backfilled = false;
  for (const t of txs) {
    if (t.type !== "transfer" && !t.accountId) {
      t.accountId = firstSpendId(accs);
      backfilled = true;
    }
  }
  if (backfilled || !Array.isArray(storedAccounts)) {
    if (backfilled) saveJSON(KEYS.transactions, txs);
    saveJSON(KEYS.accounts, accs);
  }
  return { txs, cats, accounts: accs, seeded: false };
}

const bootData = boot();

export const transactions = listOf(...bootData.txs);
export const categories = listOf(...bootData.cats);
export const accounts = listOf(...bootData.accounts);
// The save-money plan lives in its own key so clearing preferences (theme,
// currency, language) never erases savings history or the streak.
const savingsStore = loadJSON(KEYS.savings, {});
const { skippedDays: skippedSeed, ...savingsSeed } = savingsStore;

export const savings = stateOf({
  enabled: true,
  schedule: "daily",
  target: 25000,
  depositAccountId: "deposit",
  sourceAccountId: "bank",
  lastPromptDay: "",
  skippedMonth: "",
  ...savingsSeed,
});

// A stateOf() walks its own properties into States, and an array is not a
// primitive, so the skipped-day history lives in its own list instead. It is
// saved back into the same key by saveSavings().
export const skippedDays = listOf(...(Array.isArray(skippedSeed) ? skippedSeed : []));

export const saveSavings = () =>
  saveJSON(KEYS.savings, { ...savings.toObject(), skippedDays: skippedDays.values });

// Points the plan at accounts that still exist — after a boot, an import or an
// account delete.
function repointPlan() {
  const list = accounts.values;
  const lives = id => list.some(a => a.id === id);
  const depositKind = list.find(a => a.kind === "deposit");
  // A savings target only counts toward "total saved" while it is a deposit
  // account, so a stale reference moves to one as soon as it exists.
  const targetOk = id => lives(id) && list.find(a => a.id === id).kind === "deposit";
  if (!targetOk(savings.depositAccountId.value)) {
    savings.depositAccountId.value = (depositKind || list[0] || {}).id || "";
  }
  if (!lives(savings.sourceAccountId.value) || savings.sourceAccountId.value === savings.depositAccountId.value) {
    savings.sourceAccountId.value =
      (list.find(a => a.id !== savings.depositAccountId.value && a.kind !== "deposit") ||
        list.find(a => a.id !== savings.depositAccountId.value) ||
        list[0] || {}).id || "";
  }
  saveSavings();
}
repointPlan();
// Defaults first so prefs saved before a key existed (e.g. language) still
// get the fallback value through stateOf's property walk.
export const prefs = stateOf({
  theme: "light",
  currency: "IDR",
  language: "id",
  demoAsk: false,
  ...loadJSON(KEYS.prefs, {}),
});

// Recorded in storage so the question survives a refresh: it stays open until
// the user actually answers it in the sheet.
if (bootData.seeded) {
  prefs.demoAsk.value = true;
  saveJSON(KEYS.prefs, prefs.toObject());
}

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
const accIndex = id => accounts.values.findIndex(a => a.id === id);

function replaceAll({ transactions: txs, categories: cats, accounts: accs, preferences }) {
  transactions.set(txs);
  categories.set(cats);
  if (Array.isArray(accs) && accs.length) accounts.set(accs);
  if (preferences) {
    prefs.theme.value = preferences.theme || "light";
    prefs.currency.value = preferences.currency || "IDR";
  }
  filters.search.value = "";
  filters.type.value = "all";
  filters.categoryId.value = "all";
  selectedMonth.value = "all";
  // A new dataset invalidates the skipped-day history it was built on.
  skippedDays.clear();
  // An explicit import or demo load is the user's own choice, so the
  // first-visit question no longer applies.
  prefs.demoAsk.value = false;
  repointPlan();
}

// When an account is deleted its records move to a surviving one, the same way
// deleting a category re-homes transactions.
function rehomeRecords(goneId, nextId) {
  transactions.set(
    transactions.values.map(t => {
      if (t.type === "transfer") {
        return {
          ...t,
          fromAccountId: t.fromAccountId === goneId ? nextId : t.fromAccountId,
          toAccountId: t.toAccountId === goneId ? nextId : t.toAccountId,
        };
      }
      return t.accountId === goneId ? { ...t, accountId: nextId } : t;
    })
  );
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
    case Actions.ACC_ADD:
      accounts.push(payload);
      break;
    case Actions.ACC_UPDATE:
      accounts.updateAt(accIndex(payload.id), a => ({ ...a, ...payload }));
      break;
    case Actions.ACC_DELETE: {
      if (accounts.values.length <= 1) break; // always keep a place for money to sit
      const gone = accounts.values.find(a => a.id === payload);
      accounts.removeAt(accIndex(payload));
      const rest = accounts.values;
      const fallback =
        rest.find(a => a.kind === "cash") || rest.find(a => a.kind !== "deposit") || rest[0];
      if (gone && fallback) rehomeRecords(gone.id, fallback.id);
      repointPlan();
      break;
    }
    case Actions.PREFS_SET:
      for (const [key, val] of Object.entries(payload)) prefs[key].value = val;
      break;
    case Actions.SAVE_PLAN_SET:
      for (const [key, val] of Object.entries(payload)) savings[key].value = val;
      break;
    case Actions.SAVE_PROMPT:
      savings.lastPromptDay.value = payload;
      break;
    case Actions.SAVE_SKIP:
      if (payload.schedule === "daily") {
        savings.lastPromptDay.value = payload.period;
        skippedDays.set([...skippedDays.values, payload.period].slice(-45));
      } else {
        savings.skippedMonth.value = payload.period;
      }
      break;
    case Actions.DATA_IMPORT: {
      migrateIcons(payload.categories || []);
      const accs = Array.isArray(payload.accounts) && payload.accounts.length ? payload.accounts : accounts.values;
      const home = firstSpendId(accs);
      replaceAll({
        ...payload,
        accounts: accs,
        // A v1 snapshot has no account on each record — send it to the default.
        transactions: (payload.transactions || []).map(
          t => (t.type === "transfer" || accs.some(a => a.id === t.accountId) ? t : { ...t, accountId: home })
        ),
      });
      break;
    }
    case Actions.DATA_DEMO:
      replaceAll(generateDemoData());
      break;
    case Actions.DATA_CLEAR:
      transactions.clear();
      skippedDays.clear();
      savings.lastPromptDay.value = "";
      savings.skippedMonth.value = "";
      prefs.demoAsk.value = false;
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
    case Actions.ACC_DELETE: // ... and so does deleting an account
    case Actions.DATA_IMPORT:
    case Actions.DATA_DEMO:
    case Actions.DATA_CLEAR:
      saveJSON(KEYS.transactions, transactions.values);
      break;
  }
  // One switch per stored key: an action like DATA_DEMO touches several files,
  // and a single switch would break after the first matching group.
  switch (action) {
    case Actions.BUDGET_SET:
    case Actions.CAT_ADD:
    case Actions.CAT_UPDATE:
    case Actions.CAT_DELETE:
    case Actions.DATA_IMPORT:
    case Actions.DATA_DEMO:
      saveJSON(KEYS.categories, categories.values);
      break;
  }
  switch (action) {
    case Actions.ACC_ADD:
    case Actions.ACC_UPDATE:
    case Actions.ACC_DELETE:
    case Actions.DATA_IMPORT:
    case Actions.DATA_DEMO:
      saveJSON(KEYS.accounts, accounts.values);
      break;
  }
  switch (action) {
    case Actions.PREFS_SET:
    case Actions.DATA_CLEAR: // clears the pending first-visit question
    case Actions.DATA_IMPORT:
    case Actions.DATA_DEMO:
      saveJSON(KEYS.prefs, prefs.toObject());
      break;
  }
  switch (action) {
    case Actions.SAVE_PLAN_SET:
    case Actions.SAVE_PROMPT:
    case Actions.SAVE_SKIP:
    case Actions.DATA_CLEAR: // resets the skipped-day history
    case Actions.ACC_DELETE: // the plan may have lost an account reference
    case Actions.DATA_IMPORT:
    case Actions.DATA_DEMO:
      saveSavings();
      break;
  }
});
