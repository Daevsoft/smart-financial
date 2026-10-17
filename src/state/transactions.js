import { stateOf, listOf, computed, effect } from "@daevsoft/jetz";
import { transactions, categories, filters, selectedMonth, prefs, dispatcher, Actions } from "./store.js";
import { t, monthName, monthShort } from "./i18n.js";

// ---------- Helpers ----------

export const monthKey = dateStr => String(dateStr).slice(0, 7);

export const monthLabel = key => `${monthName(Number(key.slice(5, 7)) - 1)} ${key.slice(0, 4)}`;

export const scopeLabel = computed(() =>
  selectedMonth.value === "all" ? t("allTime") : monthLabel(selectedMonth.value)
);

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const round2 = n => Math.round(n * 100) / 100;

export const categoryById = id =>
  categories.values.find(c => c.id === id) || { id, name: t("uncategorized"), color: "#94a3b8", icon: "package", budget: 0 };

function shiftMonth(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---------- Derived state ----------

// `ListState.values` reads are untracked, so every derived value here is a
// plain `stateOf`/`listOf` that `refreshDerived()` rebuilds. The refresh is
// triggered by (a) the effect below for filter/period changes and (b) the
// dispatcher subscription in store-driven mutations.

export const visibleTransactions = listOf();
export const recentTransactions = listOf();
export const monthOptions = listOf();
export const spendingByCategory = listOf(); // [{ id, name, color, icon, total, share }]
export const budgetRows = listOf();         // [{ id, name, color, icon, budget, spent, pct }]

export const totalIncome = stateOf(0);
export const totalExpense = stateOf(0);
export const txCount = stateOf(0);
export const catCount = stateOf(0);
export const catUsage = stateOf({}); // { [categoryId]: txCount }
export const incomeDelta = stateOf(0); // % vs previous month
export const expenseDelta = stateOf(0);
export const donutGradient = stateOf("");
export const budgetTotal = stateOf(0);
export const budgetSpent = stateOf(0);

// Over-budget warnings — tracked primitives mirror the ListState rows because
// ListState reads are untracked.
export const overBudgetRows = listOf(); // [{ id, name, color, icon, budget, spent, over, pct }]
export const overBudgetCount = stateOf(0);
export const overBudgetTotal = stateOf(0); // sum of overspend

// Trend (income/expense) — stock-style rolling windows anchored at the latest
// transaction date ("market close"), with adaptive bucket granularity.
export const trendRange = stateOf("1m");
export const trendData = listOf(); // [{ key, label, income, expense }] ascending
export const trendEmpty = stateOf(true);

// Fixed 12-calendar-month net series (income − expense), independent of the
// trend range switch: stock-style charts always read against the same window.
export const netTrend = listOf(); // [{ key, label, income, expense, net }] ascending
export const netTrendEmpty = stateOf(true);

export const netBalance = computed(() => round2(totalIncome.value - totalExpense.value));
export const savingsRate = computed(() =>
  totalIncome.value > 0 ? Math.round((netBalance.value / totalIncome.value) * 100) : 0
);
export const budgetPct = computed(() =>
  budgetTotal.value > 0 ? Math.round((budgetSpent.value / budgetTotal.value) * 1000) / 10 : 0
);

function monthTotals(key) {
  let income = 0;
  let expense = 0;
  for (const t of transactions.values) {
    if (monthKey(t.date) !== key) continue;
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense };
}

function buildGradient(rows, grand) {
  if (!grand) return "";
  let acc = 0;
  const stops = [];
  for (const r of rows) {
    const from = (acc / grand) * 100;
    acc += r.total;
    stops.push(`${r.color} ${from}% ${(acc / grand) * 100}%`);
  }
  return `conic-gradient(${stops.join(", ")})`;
}

const pctChange = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : 0);

const TREND_RANGES = {
  "1d": { title: "today", bucket: "hour" },
  "1m": { title: "last30", bucket: "day", days: 30 },
  "3m": { title: "last3m", bucket: "day", days: 90 },
  "6m": { title: "last6m", bucket: "week", weeks: 26 },
  "1y": { title: "last12m", bucket: "month" },
};

export const trendTitle = computed(() => t(TREND_RANGES[trendRange.value].title));

const isoOf = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Demo data has no time-of-day, so intraday placement hashes the stable tx id.
const hourOf = id => [...String(id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 24, 0);

function buildTrend() {
  const cfg = TREND_RANGES[trendRange.value] || TREND_RANGES["1m"];
  const dates = transactions.values.map(t => t.date).sort();
  const anchorStr = dates[dates.length - 1] || todayISO();
  const anchor = new Date(`${anchorStr}T00:00:00`);

  const buckets = [];
  const index = new Map();
  const addBucket = (key, label) => {
    const b = { key, label, income: 0, expense: 0 };
    buckets.push(b);
    index.set(key, b);
  };

  if (cfg.bucket === "hour") {
    for (let h = 0; h < 24; h++) addBucket(String(h).padStart(2, "0"), `${String(h).padStart(2, "0")}:00`);
  } else if (cfg.bucket === "day") {
    const d = new Date(anchor);
    d.setDate(d.getDate() - (cfg.days - 1));
    while (d <= anchor) {
      addBucket(isoOf(d), `${d.getDate()} ${monthShort(d.getMonth())}`);
      d.setDate(d.getDate() + 1);
    }
  } else if (cfg.bucket === "week") {
    const d = new Date(anchor);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - (cfg.weeks - 1) * 7);
    while (d <= anchor) {
      addBucket(isoOf(d), `${d.getDate()} ${monthShort(d.getMonth())}`);
      d.setDate(d.getDate() + 7);
    }
  } else {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - 11, 1);
    while (d <= anchor) {
      addBucket(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        `${monthShort(d.getMonth())}${d.getMonth() === 0 ? " " + d.getFullYear() : ""}`);
      d.setMonth(d.getMonth() + 1);
    }
  }
  const startKey = buckets[0].key;

  for (const t of transactions.values) {
    let b = null;
    if (cfg.bucket === "hour") {
      if (t.date === anchorStr) b = index.get(String(hourOf(t.id)).padStart(2, "0"));
    } else if (cfg.bucket === "day") {
      b = index.get(t.date);
    } else if (cfg.bucket === "week") {
      if (t.date >= startKey) {
        b = buckets[Math.floor((Date.parse(t.date) - Date.parse(startKey)) / 86400000 / 7)];
      }
    } else {
      b = index.get(t.date.slice(0, 7));
    }
    if (!b) continue;
    if (t.type === "income") b.income += t.amount;
    else b.expense += t.amount;
  }

  // Trim leading empty buckets so the line starts where the data starts.
  let first = 0;
  while (first < buckets.length - 1 && buckets[first].income === 0 && buckets[first].expense === 0) first++;
  const view = buckets.slice(first);

  trendData.set(view.map(b => ({ key: b.key, label: b.label, income: round2(b.income), expense: round2(b.expense) })));
  trendEmpty.value = view.every(b => b.income === 0 && b.expense === 0);
}

export const netTrendLast = stateOf(0);   // net of the newest month
export const netTrendPrev = stateOf(0);   // net of the month before it
export const netTrendDelta = stateOf(0);  // % change, 0 when there is no baseline

function buildNetTrend() {
  const keys = transactions.values.map(t => monthKey(t.date)).sort();
  const anchor = keys[keys.length - 1] || monthKey(todayISO());

  const buckets = [];
  const index = new Map();
  for (let i = 11; i >= 0; i--) {
    const key = shiftMonth(anchor, -i);
    const b = { key, label: monthLabel(key), income: 0, expense: 0 };
    buckets.push(b);
    index.set(key, b);
  }
  for (const t of transactions.values) {
    const b = index.get(monthKey(t.date));
    if (!b) continue;
    if (t.type === "income") b.income += t.amount;
    else b.expense += t.amount;
  }

  // Same reasoning as buildTrend: a flat run of zero months says nothing, so
  // start the line where the data does — but keep two points to draw one.
  let first = 0;
  while (first < buckets.length - 2 && buckets[first].income === 0 && buckets[first].expense === 0) first++;
  const view = buckets.slice(first).map(b => ({ ...b, income: round2(b.income), expense: round2(b.expense), net: round2(b.income - b.expense) }));

  netTrend.set(view);
  netTrendEmpty.value = view.every(b => b.net === 0);
  netTrendLast.value = view.length ? view[view.length - 1].net : 0;
  netTrendPrev.value = view.length > 1 ? view[view.length - 2].net : 0;
  netTrendDelta.value = netTrendPrev.value !== 0
    ? Math.round(((netTrendLast.value - netTrendPrev.value) / Math.abs(netTrendPrev.value)) * 1000) / 10
    : 0;
}

export function refreshDerived() {
  // Visible rows (filters + period, newest first)
  const f = filters.toObject();
  const q = f.search.trim().toLowerCase();
  const visible = transactions.values
    .filter(t => selectedMonth.value === "all" || monthKey(t.date) === selectedMonth.value)
    .filter(t => f.type === "all" || t.type === f.type)
    .filter(t => f.categoryId === "all" || t.categoryId === f.categoryId)
    .filter(t => !q || t.description.toLowerCase().includes(q) || (t.note || "").toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  visibleTransactions.set(visible);
  recentTransactions.set(visible.slice(0, 6));
  txCount.value = visible.length;

  let income = 0;
  let expense = 0;
  for (const t of visible) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  totalIncome.value = round2(income);
  totalExpense.value = round2(expense);

  // Month options from the data. "All time" lives inside the list rather than as
  // a static <option> sibling: a loop() prepends its views into its parent
  // element, so any sibling of the loop gets pushed out of order on a rebuild.
  const keys = [...new Set(transactions.values.map(tx => monthKey(tx.date)))].sort().reverse();
  monthOptions.set([
    { value: "all", label: t("allTime") },
    ...keys.map(k => ({ value: k, label: monthLabel(k) })),
  ]);

  // Delta vs the previous calendar month
  const scopeKey = selectedMonth.value === "all" ? (keys[0] || null) : selectedMonth.value;
  if (scopeKey) {
    const cur = monthTotals(scopeKey);
    const prev = monthTotals(shiftMonth(scopeKey, -1));
    incomeDelta.value = pctChange(cur.income, prev.income);
    expenseDelta.value = pctChange(cur.expense, prev.expense);
  } else {
    incomeDelta.value = 0;
    expenseDelta.value = 0;
  }

  // Spending per category within the selected period
  const spendByCat = new Map();
  for (const t of visible) {
    if (t.type !== "expense") continue;
    spendByCat.set(t.categoryId, (spendByCat.get(t.categoryId) || 0) + t.amount);
  }
  const catRows = categories.values
    .filter(c => c.type === "expense")
    .map(c => ({
      id: c.id,
      name: c.name,
      color: c.color,
      icon: c.icon,
      total: round2(spendByCat.get(c.id) || 0),
    }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total);
  const grand = catRows.reduce((s, r) => s + r.total, 0);
  spendingByCategory.set(catRows.map(r => ({ ...r, share: grand ? round2((r.total / grand) * 100) : 0 })));
  donutGradient.value = buildGradient(catRows, grand);

  // Budget progress rows
  budgetRows.set(
    categories.values
      .filter(c => c.type === "expense")
      .map(c => {
        const spent = round2(spendByCat.get(c.id) || 0);
        return {
          id: c.id,
          name: c.name,
          color: c.color,
          icon: c.icon,
          budget: c.budget,
          spent,
          pct: c.budget > 0 ? Math.round((spent / c.budget) * 1000) / 10 : 0,
        };
      })
  );

  let budgetSum = 0;
  let spentSum = 0;
  for (const r of budgetRows.values) {
    budgetSum += r.budget;
    spentSum += r.spent;
  }
  budgetTotal.value = round2(budgetSum);
  budgetSpent.value = round2(spentSum);

  // Categories whose spending exceeds their monthly limit (worst first)
  const over = budgetRows.values
    .filter(r => r.budget > 0 && r.spent > r.budget)
    .map(r => ({ ...r, over: round2(r.spent - r.budget) }))
    .sort((a, b) => b.over - a.over);
  overBudgetRows.set(over);
  overBudgetCount.value = over.length;
  overBudgetTotal.value = round2(over.reduce((s, r) => s + r.over, 0));

  catCount.value = categories.values.length;

  // Transactions per category (for the Categories page rows / delete hints)
  const usage = {};
  for (const tx of transactions.values) usage[tx.categoryId] = (usage[tx.categoryId] || 0) + 1;
  catUsage.value = usage;

  buildTrend();
  buildNetTrend();
}

// Filters and period are written directly by bound controls. Trend range
// changes flow through the dispatcher instead: Jetz re-subscribes effect
// dependencies on every re-run, so a plain state subscription elsewhere
// could fire before this rebuild lands. Language changes rebuild here too,
// because month/trend labels live in these lists.
effect(() => {
  filters.search.value;
  filters.type.value;
  filters.categoryId.value;
  selectedMonth.value;
  prefs.language.value;
  refreshDerived();
});

// Store-driven mutations notify this module through the dispatcher.
const DERIVED_ACTIONS = new Set([
  Actions.TX_ADD,
  Actions.TX_UPDATE,
  Actions.TX_DELETE,
  Actions.CAT_ADD,
  Actions.CAT_UPDATE,
  Actions.CAT_DELETE,
  Actions.BUDGET_SET,
  Actions.DATA_IMPORT,
  Actions.DATA_DEMO,
  Actions.DATA_CLEAR,
  Actions.TREND_RANGE,
  Actions.PREFS_SET,
]);

dispatcher.subscribe("derived", (action, payload) => {
  dispatcher.waitFor("store");
  if (action === Actions.TREND_RANGE) trendRange.value = payload;
  if (DERIVED_ACTIONS.has(action)) refreshDerived();
});
