import { stateOf, listOf, computed, effect } from "@daevsoft/jetz";
import { transactions, accounts, savings, skippedDays, prefs, dispatcher, Actions } from "./store.js";
import { todayISO, monthKey } from "./transactions.js";
import { fmt } from "./preferences.js";
import { showDeviceNotification } from "../services/notify.js";
import { t } from "./i18n.js";

// ---------- Account vocabulary ----------

export const ACCOUNT_KINDS = ["cash", "bank", "digital", "deposit", "custom"];
const KIND_KEYS = {
  cash: "kindCash",
  bank: "kindBank",
  digital: "kindDigital",
  deposit: "kindDeposit",
  custom: "kindCustom",
};

export const kindLabel = kind => t(KIND_KEYS[kind] || "kindCustom");

export const accountById = id =>
  accounts.values.find(a => a.id === id) ||
  { id, name: t("noAccount"), color: "#94a3b8", icon: "package", kind: "custom", opening: 0 };

const isoOf = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const shiftDay = (key, delta) => {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return isoOf(d);
};

// `monthKey` gives YYYY-MM, so day 0 of the following month is this one's last.
const daysInMonth = month => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

// A stored plan can predate the field or hold a hand-edited value.
export const planStartDay = () => Math.min(31, Math.max(1, Math.round(Number(savings.startDay.value) || 1)));

// Monthly reminders open on the plan's start day. A short month pulls the date
// back to its last day so a plan set to the 31st still nudges in February.
const monthlyWindowOpen = day => Number(day.slice(8, 10)) >= Math.min(planStartDay(), daysInMonth(monthKey(day)));

// ---------- Derived views ----------
export const accountBalances = listOf(); // [{ id, name, kind, color, icon, opening, balance }]
export const accCount = stateOf(0);
export const netWorth = stateOf(0);        // every account, openings included
export const totalSaved = stateOf(0);      // deposit-kind accounts only
export const savedThisPeriod = stateOf(0); // today (daily) or this month (monthly)
export const depositStreak = stateOf(0);   // consecutive days with a deposit
export const savedDaysThisMonth = stateOf(0);
export const savedThisMonth = stateOf(0);    // deposit inflows within this month
export const accountUsage = stateOf({});     // { [accountId]: record count }
export const skippedRecent = stateOf(0);     // days skipped in the recent history
export const promptVisible = stateOf(false);
export const currentPeriod = stateOf("");

// Money counts as saved when it lands in a deposit account: a transfer in, or
// income booked straight to the savings account.
function refreshDerivedAccounts() {
  const list = accounts.values;
  const bal = new Map(list.map(a => [a.id, Number(a.opening) || 0]));
  const depositIds = new Set(list.filter(a => a.kind === "deposit").map(a => a.id));
  const savedDates = new Set();
  const daysInMonth = new Set();
  const thisMonth = monthKey(todayISO());
  let monthSaved = 0;
  const usage = {};
  const bump = id => {
    if (id) usage[id] = (usage[id] || 0) + 1;
  };

  for (const tx of transactions.values) {
    const amt = Number(tx.amount) || 0;
    if (tx.type === "transfer") {
      bump(tx.fromAccountId);
      bump(tx.toAccountId);
    } else {
      bump(tx.accountId);
    }
    const enters = (id, whole) => {
      if (!id) return;
      if (depositIds.has(id)) {
        savedDates.add(tx.date);
        if (whole) {
          monthSaved += amt;
          daysInMonth.add(tx.date);
        }
      }
    };
    if (tx.type === "transfer") {
      if (bal.has(tx.fromAccountId)) bal.set(tx.fromAccountId, bal.get(tx.fromAccountId) - amt);
      if (bal.has(tx.toAccountId)) bal.set(tx.toAccountId, bal.get(tx.toAccountId) + amt);
      enters(tx.toAccountId, monthKey(tx.date) === thisMonth);
    } else if (tx.type === "income") {
      if (bal.has(tx.accountId)) bal.set(tx.accountId, bal.get(tx.accountId) + amt);
      enters(tx.accountId, monthKey(tx.date) === thisMonth);
    } else {
      if (bal.has(tx.accountId)) bal.set(tx.accountId, bal.get(tx.accountId) - amt);
    }
  }

  const rows = list.map(a => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    color: a.color,
    icon: a.icon,
    opening: Number(a.opening) || 0,
    balance: Math.round((bal.get(a.id) || 0) * 100) / 100,
  }));
  accountBalances.set(rows);
  accCount.value = rows.length;
  accountUsage.value = usage;
  netWorth.value = Math.round(rows.reduce((s, r) => s + r.balance, 0) * 100) / 100;
  totalSaved.value = Math.round(rows.filter(r => r.kind === "deposit").reduce((s, r) => s + r.balance, 0) * 100) / 100;
  savedThisMonth.value = Math.round(monthSaved * 100) / 100;
  savedDaysThisMonth.value = daysInMonth.size;

  // A run of days ends only when a whole day passes without a deposit; today
  // being untouched so far must not break it.
  const today = todayISO();
  let streak = 0;
  for (let cursor = savedDates.has(today) ? 0 : 1; savedDates.has(shiftDay(today, -cursor)); cursor++) {
    streak++;
  }
  depositStreak.value = streak;

  refreshPrompt();
}

// Daily: once per calendar day, and "remind later" defers to the next day.
// Monthly: every open from the plan's start day until the month has a deposit,
// unless it was skipped.
// Session-scoped so reopening the app the same day can nudge again.
let notifiedPeriod = "";

function refreshPrompt() {
  const day = todayISO();
  const month = monthKey(day);
  const schedule = savings.schedule.value === "monthly" ? "monthly" : "daily";
  const period = schedule === "daily" ? day : month;
  currentPeriod.value = period;

  let inPeriod = 0;
  const depositIds = new Set(accounts.values.filter(a => a.kind === "deposit").map(a => a.id));
  for (const tx of transactions.values) {
    const inside = schedule === "daily" ? tx.date === day : monthKey(tx.date) === month;
    if (!inside) continue;
    const target = tx.type === "transfer" ? tx.toAccountId : tx.type === "income" ? tx.accountId : null;
    if (target && depositIds.has(target)) inPeriod += Number(tx.amount) || 0;
  }
  savedThisPeriod.value = Math.round(inPeriod * 100) / 100;
  skippedRecent.value = skippedDays.values.length;

  const usable =
    savings.enabled.value &&
    !prefs.demoAsk.value && // never stack a second sheet on the first-visit question
    depositIds.has(savings.depositAccountId.value) && // savings only count in a deposit account
    !!savings.sourceAccountId.value &&
    savings.sourceAccountId.value !== savings.depositAccountId.value;
  const alreadyAsked = schedule === "daily" && savings.lastPromptDay.value === day;
  const monthSkipped = schedule === "monthly" && savings.skippedMonth.value === month;
  const beforeStartDay = schedule === "monthly" && !monthlyWindowOpen(day);
  promptVisible.value = Boolean(
    usable && inPeriod <= 0 && !alreadyAsked && !monthSkipped && !beforeStartDay
  );

  // The sheet is already on screen when this fires, so the device copy exists
  // for the notification shade: the nudge outlives closing the app, and tapping
  // it comes back through the worker's notificationclick handler.
  if (promptVisible.value && notifiedPeriod !== period) {
    notifiedPeriod = period;
    const monthly = schedule === "monthly";
    showDeviceNotification({
      title: t(monthly ? "savePromptTitleMonthly" : "savePromptTitleDaily"),
      body: t("savePromptBody", {
        target: fmt(Number(savings.target.value) || 0),
        from: accountById(savings.sourceAccountId.value).name,
        to: accountById(savings.depositAccountId.value).name,
      }),
      tag: `save-${period}`,
    });
  }
}

// ---------- Plan + prompt writers ----------

export const setPlan = patch => dispatcher.dispatch(Actions.SAVE_PLAN_SET, patch);

export const markPromptShown = () => dispatcher.dispatch(Actions.SAVE_PROMPT, todayISO());

export const skipPeriod = () =>
  dispatcher.dispatch(Actions.SAVE_SKIP, {
    schedule: savings.schedule.value === "monthly" ? "monthly" : "daily",
    period: currentPeriod.value,
  });

export function logDeposit({ amount, fromAccountId, toAccountId, date, description }) {
  dispatcher.dispatch(Actions.TX_ADD, {
    id: `tx-save-${Date.now()}`,
    date: date || todayISO(),
    description: description || t("saveMoneyEntry"),
    categoryId: null,
    type: "transfer",
    amount: Math.round(amount * 100) / 100,
    fromAccountId,
    toAccountId,
    note: "",
  });
  // Treated as a normal transaction, so it also flows into the ledger totals.
  markPromptShown();
}

// Quick picks for the prompt: the plan target split into usable steps. Read at
// render time — a computed returning an array is not tracked by Jetz.
export const quickAmountList = () => {
  const target = Number(savings.target.value) || 0;
  if (target <= 0) return [];
  return [...new Set([target, Math.round(target / 2), Math.round(target / 4)].filter(v => v > 0))].sort((a, b) => a - b);
};

export const periodSavedLabel = computed(() =>
  savings.schedule.value === "monthly" ? t("savedThisMonth") : t("savedToday")
);

export const depositAccounts = () => accounts.values.filter(a => a.kind === "deposit");

// ---------- Wiring ----------

effect(() => {
  savings.enabled.value;
  savings.schedule.value;
  savings.startDay.value;
  savings.lastPromptDay.value;
  savings.skippedMonth.value;
  prefs.demoAsk.value;
  refreshPrompt();
});

const ACCOUNT_ACTIONS = new Set([
  Actions.TX_ADD,
  Actions.TX_UPDATE,
  Actions.TX_DELETE,
  Actions.ACC_ADD,
  Actions.ACC_UPDATE,
  Actions.ACC_DELETE,
  Actions.BUDGET_SET,
  Actions.DATA_IMPORT,
  Actions.DATA_DEMO,
  Actions.DATA_CLEAR,
  Actions.SAVE_PLAN_SET,
  Actions.SAVE_PROMPT,
  Actions.SAVE_SKIP,
  Actions.PREFS_SET,
]);

dispatcher.subscribe("accounts", action => {
  dispatcher.waitFor("store");
  if (ACCOUNT_ACTIONS.has(action)) refreshDerivedAccounts();
});

refreshDerivedAccounts();
