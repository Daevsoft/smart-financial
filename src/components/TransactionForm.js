import { stateOf, computed, batch, onMount, onDestroy } from "@daevsoft/jetz";
import { div, span, button, label, inputText, inputNumber, inputDate, select, option } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { dispatcher, Actions, categories } from "../state/store.js";
import { todayISO } from "../state/transactions.js";
import { scrollLock } from "../state/ui.js";
import { t, tt } from "../state/i18n.js";
import { Icon, UI } from "./icons.js";

// Two-way bound modal form. `open`/`editing` are owned by the page; the form
// fills itself from `editing` every time it opens.
export function TransactionForm({ open, editing, onClose }) {
  const description = stateOf("");
  const amount = stateOf("");
  const type = stateOf("expense");
  const categoryId = stateOf("food");
  const date = stateOf(todayISO());
  const note = stateOf("");
  const error = stateOf("");

  const fill = () => {
    const tx = editing.value;
    batch(() => {
      description.value = tx ? tx.description : "";
      amount.value = tx ? String(tx.amount) : "";
      type.value = tx ? tx.type : "expense";
      categoryId.value = tx ? tx.categoryId : "food";
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
    const base = {
      description: description.value.trim(),
      amount: Math.round(amt * 100) / 100,
      type: type.value,
      categoryId: categoryId.value,
      date: date.value,
      note: note.value.trim(),
    };
    const existing = editing.value;
    if (existing) dispatcher.dispatch(Actions.TX_UPDATE, { id: existing.id, ...base });
    else dispatcher.dispatch(Actions.TX_ADD, { id: `tx-${Date.now()}`, ...base });
    close();
  };

  const categorySelect = select(
    {
      class: "input",
      onchange: e => (categoryId.value = e.target.value),
    },
    categories.values.map(c => option({ value: c.id }, c.name))
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
  const syncCategory = () => {
    if (categorySelect.o) categorySelect.o.value = categoryId.value;
  };
  categoryId.subscribe(syncCategory);
  onMount(syncCategory);

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
          css`grid grid-cols-2 gap-2`,
          button({ class: () => `btn ${type.value === "expense" ? "bg-red-500/10 text-red-600 dark:text-red-400" : "btn-ghost"}`, onclick: () => (type.value = "expense") }, Icon(UI.minus, "h-4 w-4"), " ", tt("expense")),
          button({ class: () => `btn ${type.value === "income" ? "bg-brand-500/15 text-brand-700 dark:text-brand-400" : "btn-ghost"}`, onclick: () => (type.value = "income") }, Icon(UI.plus, "h-4 w-4"), " ", tt("income"))
        )
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
        label(css`label`, tt("categoryCap")),
        categorySelect
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
