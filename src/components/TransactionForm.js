import { stateOf, computed, batch, onMount, onDestroy } from "@daevsoft/jetz";
import { div, span, button, label, inputText, inputNumber, inputDate, select, option } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { dispatcher, Actions, categories, accounts, savings } from "../state/store.js";
import { todayISO } from "../state/transactions.js";
import { scrollLock } from "../state/ui.js";
import { t, tt } from "../state/i18n.js";
import { Icon, UI } from "./icons.js";

// The account a record starts on: the plan's spending account when it still
// exists, else the first non-deposit account, else whatever is there.
const spendDefault = () => {
  const list = accounts.values;
  const planned = list.find(a => a.id === savings.sourceAccountId.value);
  return (planned || list.find(a => a.kind !== "deposit") || list[0] || {}).id || "";
};

const depositDefault = exclude => {
  const list = accounts.values;
  const planned = list.find(a => a.id === savings.depositAccountId.value && a.id !== exclude);
  if (planned) return planned.id;
  const other = list.find(a => a.id !== exclude && a.kind === "deposit");
  return (other || list.find(a => a.id !== exclude) || {}).id || "";
};

// Two-way bound modal form. `open`/`editing` are owned by the page; the form
// fills itself from `editing` every time it opens.
export function TransactionForm({ open, editing, onClose }) {
  const description = stateOf("");
  const amount = stateOf("");
  const type = stateOf("expense");
  const categoryId = stateOf("food");
  const accountId = stateOf(spendDefault());
  const fromAccountId = stateOf(spendDefault());
  const toAccountId = stateOf(depositDefault(spendDefault()));
  const date = stateOf(todayISO());
  const note = stateOf("");
  const error = stateOf("");

  const fill = () => {
    const tx = editing.value;
    batch(() => {
      description.value = tx ? tx.description : "";
      amount.value = tx ? String(tx.amount) : "";
      type.value = tx ? tx.type : "expense";
      categoryId.value = tx ? tx.categoryId || "food" : "food";
      const spend = tx?.accountId || tx?.fromAccountId || spendDefault();
      accountId.value = spend;
      fromAccountId.value = spend;
      toAccountId.value = tx?.toAccountId || depositDefault(spend);
      date.value = tx ? tx.date : todayISO();
      note.value = tx ? tx.note || "" : "";
      error.value = "";
    });
  };

  const close = () => {
    error.value = "";
    onClose();
  };

  const submit = () => {
    const amt = parseFloat(amount.value);
    if (!description.value.trim()) return (error.value = t("descRequired"));
    if (!Number.isFinite(amt) || amt <= 0) return (error.value = t("amountPositive"));
    if (!date.value) return (error.value = t("pickDate"));
    const shared = {
      description: description.value.trim(),
      amount: Math.round(amt * 100) / 100,
      type: type.value,
      date: date.value,
      note: note.value.trim(),
    };
    let base;
    if (type.value === "transfer") {
      if (!fromAccountId.value || !toAccountId.value || fromAccountId.value === toAccountId.value) {
        return (error.value = t("pickTwoAccounts"));
      }
      base = { ...shared, categoryId: null, fromAccountId: fromAccountId.value, toAccountId: toAccountId.value };
    } else {
      base = { ...shared, categoryId: categoryId.value, accountId: accountId.value };
    }
    const existing = editing.value;
    if (existing) dispatcher.dispatch(Actions.TX_UPDATE, { id: existing.id, ...base });
    else dispatcher.dispatch(Actions.TX_ADD, { id: `tx-${Date.now()}`, ...base });
    close();
  };

  const setType = next => {
    // Moving between the two shapes keeps the accounts coherent: a transfer out
    // of the account the record already used.
    if (next === "transfer") {
      fromAccountId.value = accountId.value || fromAccountId.value;
      if (toAccountId.value === fromAccountId.value) toAccountId.value = depositDefault(fromAccountId.value);
    } else if (!accountId.value || accountId.value === toAccountId.value) {
      accountId.value = fromAccountId.value;
    }
    type.value = next;
  };

  const categorySelect = select(
    {
      class: "input",
      onchange: e => (categoryId.value = e.target.value),
    },
    categories.values.map(c => option({ value: c.id }, c.name))
  );

  const accountOptions = () => accounts.values.map(a => option({ value: a.id }, a.name));
  const accountSelect = select(
    { class: "input", onchange: e => (accountId.value = e.target.value) },
    accountOptions()
  );
  const fromSelect = select(
    { class: "input", onchange: e => (fromAccountId.value = e.target.value) },
    accountOptions()
  );
  const toSelect = select(
    { class: "input", onchange: e => (toAccountId.value = e.target.value) },
    accountOptions()
  );

  // Fill on open and sync the select via targeted subscriptions — `listen()`
  // re-runs on every state change, and fill() writes states, so it would loop.
  open.subscribe(() => {
    if (open.value) fill();
    scrollLock(open.value);
  });
  onDestroy(() => {
    if (open.value) scrollLock(false);
  });
  const syncControls = () => {
    if (categorySelect.o) categorySelect.o.value = categoryId.value;
    if (accountSelect.o) accountSelect.o.value = accountId.value;
    if (fromSelect.o) fromSelect.o.value = fromAccountId.value;
    if (toSelect.o) toSelect.o.value = toAccountId.value;
  };
  categoryId.subscribe(syncControls);
  accountId.subscribe(syncControls);
  fromAccountId.subscribe(syncControls);
  toAccountId.subscribe(syncControls);
  onMount(syncControls);

  const accountLabel = computed(() => (type.value === "income" ? t("goesTo") : t("paidFrom")));

  return div(
    { class: () => `fixed inset-0 z-50 flex items-end justify-center transition-all duration-200 sm:items-center sm:p-4 ${open.value ? "visible" : "invisible pointer-events-none"}` },
    div({ class: () => `absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200 ${open.value ? "opacity-100" : "opacity-0"}`, onclick: close }),
    div(
      { class: () => `card sheet relative max-h-[92dvh] w-full space-y-4 overflow-y-auto rounded-b-none transition-all duration-200 sm:max-w-lg sm:rounded-2xl ${open.value ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0 sm:translate-y-3 sm:scale-95"}` },
      div(
        css`flex items-center justify-between`,
        div(css`text-base font-bold text-slate-900 dark:text-white`,
          computed(() => (editing.value ? t("editTransaction") : t("newTransaction")))),
        button({ class: "btn btn-ghost px-2 py-2", "aria-label": () => t("close"), onclick: close }, Icon(UI.close, "h-5 w-5"))
      ),
      div(
        label(css`label`, tt("type")),
        div(
          css`grid grid-cols-3 gap-2`,
          button({ class: () => `btn ${type.value === "expense" ? "bg-red-500/10 text-red-600 dark:text-red-400" : "btn-ghost"}`, onclick: () => setType("expense") }, Icon(UI.minus, "h-4 w-4"), " ", tt("expense")),
          button({ class: () => `btn ${type.value === "income" ? "bg-brand-500/15 text-brand-700 dark:text-brand-400" : "btn-ghost"}`, onclick: () => setType("income") }, Icon(UI.plus, "h-4 w-4"), " ", tt("income")),
          button({ class: () => `btn ${type.value === "transfer" ? "bg-sky-500/10 text-sky-600 dark:text-sky-400" : "btn-ghost"}`, onclick: () => setType("transfer") }, Icon(UI.transfer, "h-4 w-4"), " ", tt("transfer"))
        )
      ),
      div(
        { style: { display: () => (type.value === "transfer" ? "block" : "none") } },
        div(
          css`grid grid-cols-2 gap-3`,
          div(
            label(css`label`, tt("fromAccount")),
            fromSelect
          ),
          div(
            label(css`label`, tt("toAccount")),
            toSelect
          )
        ),
        div(css`mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400`, tt("transferNote"))
      ),
      div(
        label(css`label`, tt("description")),
        inputText({ class: "input", placeholder: () => t("descPlaceholder"), bind: description })
      ),
      div(
        css`grid grid-cols-2 gap-3`,
        div(
          label(css`label`, tt("amount")),
          inputNumber({ class: "input", step: "0.01", min: "0", placeholder: "0.00", bind: amount })
        ),
        div(
          label(css`label`, tt("date")),
          inputDate({ class: "input", bind: date })
        )
      ),
      div(
        { style: { display: () => (type.value === "transfer" ? "none" : "block") } },
        div(
          label(css`label`, accountLabel),
          accountSelect
        ),
        div(
          label(css`label`, tt("categoryCap")),
          categorySelect
        )
      ),
      div(
        label(css`label`, tt("note")),
        inputText({ class: "input", placeholder: () => t("notePlaceholder"), bind: note })
      ),
      div(
        { style: { display: () => (error.value ? "block" : "none") } },
        div(css`rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400`, error)
      ),
      div(
        css`flex justify-end gap-2 pt-1`,
        button({ class: "btn btn-ghost", onclick: close }, tt("cancel")),
        button({ class: "btn btn-primary", onclick: submit },
          span(computed(() => (editing.value ? t("saveChanges") : t("addTransaction")))))
      )
    )
  );
}
