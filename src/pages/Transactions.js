import { stateOf, computed, loop, onMount } from "@daevsoft/jetz";
import { div, p, button, label, inputText, select, option, span } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { TransactionTable } from "../components/TransactionTable.js";
import { TransactionForm } from "../components/TransactionForm.js";
import { filters, categories, selectedMonth } from "../state/store.js";
import { visibleTransactions, txCount, scopeLabel, totalIncome, totalExpense, monthOptions } from "../state/transactions.js";
import { fmt } from "../state/preferences.js";
import { t, tt } from "../state/i18n.js";
import { Icon, UI } from "../components/icons.js";

function filterSelect(state, onChange, options) {
  const sel = select({ class: "input", onchange: e => onChange(e.target.value) },
    options.map(o => option({ value: o.value }, o.label)));
  const sync = () => {
    if (sel.o) sel.o.value = state.value;
  };
  state.subscribe(sync);
  onMount(sync);
  return sel;
}

// Month options come from a derived ListState, so this uses `loop` (tracks list
// mutations) with the label folded into the key (recycling skips re-render of
// same-key rows, and a language change rewrites every label).
function periodSelect() {
  const sel = select(
    { class: "input", onchange: e => (selectedMonth.value = e.target.value) },
    option({ value: "all" }, tt("allTime")),
    loop(monthOptions, m => `${m.value}:${m.label}`, m => option({ value: m.value }, m.label))
  );
  const sync = () => {
    if (sel.o) sel.o.value = selectedMonth.value;
  };
  selectedMonth.subscribe(sync);
  onMount(sync);
  return sel;
}

export function Transactions() {
  const formOpen = stateOf(false);
  const editing = stateOf(null);

  const openAdd = () => {
    editing.value = null;
    formOpen.value = true;
  };
  const openEdit = tx => {
    editing.value = tx;
    formOpen.value = true;
  };

  return div(
    css`space-y-6`,
    div(
      css`flex flex-wrap items-end justify-between gap-4`,
      div(
        p(css`text-2xl font-bold tracking-tight text-slate-900 dark:text-white`, tt("transactions")),
        p(css`mt-1 text-sm text-slate-500 dark:text-slate-400`,
          computed(() => `${txCount.value} ${t("inView")} · ${scopeLabel.value}`))
      ),
      button({ class: "btn btn-primary", onclick: openAdd }, Icon(UI.plus, "h-4 w-4"), " ", tt("addTransaction"))
    ),
    div(
      css`card grid gap-3 sm:grid-cols-2 lg:grid-cols-4`,
      div(
        label(css`label`, tt("search")),
        inputText({ class: "input", placeholder: () => t("searchPlaceholder"), bind: filters.search })
      ),
      div(
        label(css`label`, tt("type")),
        filterSelect(
          filters.type,
          v => (filters.type.value = v),
          [{ value: "all", label: tt("allTypes") }, { value: "income", label: tt("income") }, { value: "expense", label: tt("expense") }]
        )
      ),
      div(
        label(css`label`, tt("categoryCap")),
        filterSelect(
          filters.categoryId,
          v => (filters.categoryId.value = v),
          [{ value: "all", label: tt("allCategories") }, ...categories.values.map(c => ({ value: c.id, label: c.name }))]
        )
      ),
      div(
        label(css`label`, tt("period")),
        periodSelect()
      )
    ),
    div(
      css`card`,
      TransactionTable({ rows: visibleTransactions, count: txCount, onEdit: openEdit })
    ),
    div(
      css`flex flex-wrap gap-4 text-sm`,
      span(css`font-semibold text-brand-600 dark:text-brand-400`, computed(() => `${t("income")} ${fmt(totalIncome.value)}`)),
      span(css`font-semibold text-red-500 dark:text-red-400`, computed(() => `${t("expenses")} ${fmt(totalExpense.value)}`))
    ),
    TransactionForm({ open: formOpen, editing, onClose: () => (formOpen.value = false) })
  );
}
