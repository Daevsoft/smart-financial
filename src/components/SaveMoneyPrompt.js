import { stateOf, computed, effect, onMount, onDestroy, loop } from "@daevsoft/jetz";
import { div, span, button, label, inputNumber, select, option } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { accounts, savings } from "../state/store.js";
import {
  promptVisible, markPromptShown, skipPeriod, logDeposit, setPlan, quickAmountList, accountById,
} from "../state/accounts.js";
import { fmt } from "../state/preferences.js";
import { scrollLock } from "../state/ui.js";
import { t, tt, monthName } from "../state/i18n.js";
import { Icon, UI } from "./icons.js";

const nextMonthLabel = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${monthName(d.getMonth())}${d.getMonth() === 0 ? ` ${d.getFullYear()}` : ""}`;
};

// The habit nudge: once per day, or once per month until a deposit lands. Its
// visibility is decided in state/accounts.js, which knows the schedule, whether
// the period already has a deposit, and whether the first-visit sheet is open.
export function SaveMoneyPrompt() {
  const shown = stateOf(false);
  const confirming = stateOf(false);
  const amount = stateOf("");
  const error = stateOf("");
  // Closing for now: daily waits for tomorrow, monthly waits for the next open.
  let closed = false;

  const src = computed(() => accountById(savings.sourceAccountId.value));
  const dst = computed(() => accountById(savings.depositAccountId.value));
  const monthly = computed(() => savings.schedule.value === "monthly");

  const openSheet = () => {
    amount.value = String(Number(savings.target.value) || 0);
    error.value = "";
    confirming.value = false;
    shown.value = true;
    markPromptShown();
  };

  const close = () => {
    closed = true;
    shown.value = false;
    confirming.value = false;
  };

  effect(() => {
    const visible = promptVisible.value;
    if (!visible) closed = false; // a new period, or reminders switched back on
    if (visible && !closed && !shown.value) openSheet();
  });

  const save = () => {
    const amt = parseFloat(amount.value);
    if (!Number.isFinite(amt) || amt <= 0) return (error.value = t("amountPositive"));
    if (!savings.sourceAccountId.value || !savings.depositAccountId.value) return;
    logDeposit({
      amount: amt,
      fromAccountId: savings.sourceAccountId.value,
      toAccountId: savings.depositAccountId.value,
    });
    close();
  };

  const title = computed(() => t(monthly.value ? "savePromptTitleMonthly" : "savePromptTitleDaily"));
  const body = computed(() =>
    t("savePromptBody", {
      target: fmt(Number(savings.target.value) || 0),
      from: src.value.name,
      to: dst.value.name,
    })
  );
  const skipConfirmText = computed(() =>
    monthly.value ? t("skipMonthlyConfirm", { next: nextMonthLabel() }) : t("skipDailyConfirm")
  );
  const skipLabel = computed(() => t(monthly.value ? "skipMonth" : "skipDay"));
  const remindNote = computed(() => t(monthly.value ? "remindLaterMonthly" : "remindLaterDaily"));

  // Options come from the live account list, so an account added elsewhere
  // appears without remounting the sheet. `loop` is each select's only child.
  // Only deposit-kind accounts can receive savings (that is what total saved
  // counts), so the other side of the pair is disabled rather than filtered.
  const accountPickers = () => {
    const opts = allow =>
      loop(accounts, a => `${a.id}:${a.name}:${allow(a) ? 1 : 0}`, a =>
        option({ value: a.id, disabled: !allow(a) }, a.name)
      );
    const isDeposit = a => a.kind === "deposit";
    const notDeposit = a => a.kind !== "deposit";
    const sourceSelect = select(
      { class: "input", onchange: e => setPlan({ sourceAccountId: e.target.value }) },
      opts(a => notDeposit(a) && a.id !== savings.depositAccountId.value)
    );
    const depositSelect = select(
      { class: "input", onchange: e => setPlan({ depositAccountId: e.target.value }) },
      opts(isDeposit)
    );
    const sync = () => {
      if (sourceSelect.o) sourceSelect.o.value = savings.sourceAccountId.value;
      if (depositSelect.o) depositSelect.o.value = savings.depositAccountId.value;
    };
    savings.sourceAccountId.subscribe(sync);
    savings.depositAccountId.subscribe(sync);
    onMount(sync);
    return div(
      css`grid grid-cols-2 gap-3`,
      div(label(css`label`, tt("sourceAccountPlan")), sourceSelect),
      div(label(css`label`, tt("depositAccount")), depositSelect)
    );
  };

  const chip = value =>
    button(
      {
        class: () => `rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
          Number(amount.value) === value
            ? "bg-brand-500/15 text-brand-700 dark:text-brand-400"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
        }`,
        onclick: () => { amount.value = String(value); error.value = ""; },
      },
      computed(() => fmt(value))
    );

  let locked = false;
  const setLock = on => {
    if (on === locked) return;
    locked = on;
    scrollLock(on);
  };
  effect(() => setLock(shown.value));
  onDestroy(() => setLock(false));

  // Escape means "not now", never "no" — the deposit itself stays one tap away.
  const onKey = e => {
    if (e.key === "Escape" && shown.value) close();
  };
  effect(() => {
    if (shown.value) document.addEventListener("keydown", onKey);
    else document.removeEventListener("keydown", onKey);
  });
  onDestroy(() => document.removeEventListener("keydown", onKey));

  return div(
    { class: () => `fixed inset-0 z-50 flex items-end justify-center transition-all duration-200 sm:items-center sm:p-4 ${shown.value ? "visible" : "invisible pointer-events-none"}` },
    div({ class: () => `absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200 ${shown.value ? "opacity-100" : "opacity-0"}`, onclick: close }),
    div(
      {
        class: () => `card sheet relative max-h-[92dvh] w-full space-y-4 overflow-y-auto rounded-b-none p-5 transition-all duration-200 sm:max-w-lg sm:rounded-2xl ${shown.value ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0 sm:translate-y-3 sm:scale-95"}`,
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "save-prompt-title",
      },
      div(
        css`flex items-start gap-3`,
        div(css`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400`, Icon(UI.savings, "h-5 w-5")),
        div(
          css`min-w-0`,
          div({ id: "save-prompt-title" }, css`text-base font-bold text-slate-900 dark:text-white`, title),
          div(css`mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400`, body)
        )
      ),
      // The two-step skip lives in the same sheet, so backing out is one tap.
      div(
        { style: { display: () => (confirming.value ? "none" : "block") } },
        div(
          css`space-y-4`,
          div(
            css`flex flex-wrap items-center gap-2`,
            ...quickAmountList().map(chip)
          ),
          div(
            label(css`label`, tt("amount")),
            inputNumber({ class: "input", step: "1", min: "0", placeholder: "0", bind: amount })
          ),
          accountPickers(),
          div(
            { style: { display: () => (error.value ? "block" : "none") } },
            div(css`mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400`, error)
          ),
          button({ class: "btn btn-primary w-full", onclick: save },
            Icon(UI.plus, "h-4 w-4"), " ", span(tt("saveNow")),
            span(css`ml-auto text-sm font-bold tabular-nums`, computed(() => fmt(parseFloat(amount.value) || 0)))
          )
        )
      ),
      div(
        { style: { display: () => (confirming.value ? "block" : "none") } },
        div(
          css`rounded-xl bg-amber-500/10 px-3 py-2 text-sm font-medium leading-relaxed text-amber-700 dark:text-amber-400`,
          skipConfirmText
        ),
        div(
          css`mt-3 flex gap-2`,
          button({ class: "btn btn-ghost flex-1 ring-1 ring-slate-300 dark:ring-slate-700", onclick: () => (confirming.value = false) }, tt("backToSave")),
          button({ class: "btn btn-danger flex-1", onclick: () => { skipPeriod(); close(); } }, tt("confirmSkip"))
        )
      ),
      div(
        { class: () => `${confirming.value ? "hidden" : "flex"} flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800` },
        // The note is a second line under the label: side by side it squeezes
        // the button's own text out on a phone.
        button({ class: "btn btn-ghost flex-1 flex-col", onclick: close },
          div(css`flex items-center gap-2`, Icon(UI.remind, "h-4 w-4"), tt("remindLater")),
          span(css`text-center text-xs font-normal leading-tight text-slate-400 dark:text-slate-500`, remindNote)
        ),
        button({ class: "btn btn-ghost flex-1 text-slate-500 dark:text-slate-400", onclick: () => (confirming.value = true) },
          Icon(UI.close, "h-4 w-4"), " ", skipLabel)
      ),
      div(css`text-center text-xs text-slate-400 dark:text-slate-500`, tt("transferNote"))
    )
  );
}
