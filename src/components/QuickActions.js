import { stateOf, computed, listOf, loop, batch, onMount, onDestroy } from "@daevsoft/jetz";
import { div, span, button, select, option, inputNumber, label, a } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { dispatcher, Actions } from "../state/store.js";
import {
  spendingByCategory, visibleTransactions, totalExpense, savingsRate,
  budgetPct, txCount, scopeLabel,
} from "../state/transactions.js";
import { fmt } from "../state/preferences.js";
import { scrollLock } from "../state/ui.js";
import { t, tt, localeTag } from "../state/i18n.js";
import { TransactionForm } from "./TransactionForm.js";
import { Icon, UI, CategoryIcon } from "./icons.js";

// `.values` reads on a ListState are untracked, so insight numbers are snapped
// into plain states when the modal opens (same pattern as TransactionForm.fill).
function buildInsightModal() {
  const open = stateOf(false);
  const topCat = listOf(); // one keyed row; value-dependent key forces a re-render
  const hasTop = stateOf(false);
  const topDesc = stateOf("—");
  const topAmount = stateOf(0);
  const topDate = stateOf("");
  const avgPerDay = stateOf(0);
  const activeDays = stateOf(0);

  const fmtDay = iso =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(localeTag(), { day: "numeric", month: "short" });

  const snap = () => {
    const cats = spendingByCategory.values;
    const expenses = visibleTransactions.values.filter(t => t.type === "expense");
    const biggest = expenses.reduce((max, t) => (!max || t.amount > max.amount ? t : max), null);
    const days = new Set(expenses.map(t => t.date)).size;
    batch(() => {
      topCat.set(cats.length ? [cats[0]] : []);
      hasTop.value = cats.length > 0;
      topDesc.value = biggest ? biggest.description : "—";
      topAmount.value = biggest ? biggest.amount : 0;
      topDate.value = biggest ? fmtDay(biggest.date) : "";
      activeDays.value = days;
      avgPerDay.value = days > 0 ? Math.round((totalExpense.value / days) * 100) / 100 : 0;
    });
  };

  const close = () => (open.value = false);
  const onKey = e => {
    if (e.key === "Escape") close();
  };
  const gotIt = button(
    { class: "btn btn-primary outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40", onclick: close },
    tt("gotIt")
  );

  open.subscribe(() => {
    if (open.value) {
      snap();
      document.addEventListener("keydown", onKey);
      requestAnimationFrame(() => gotIt.o && gotIt.o.focus());
    } else {
      document.removeEventListener("keydown", onKey);
    }
    scrollLock(open.value);
  });
  onDestroy(() => {
    if (open.value) {
      document.removeEventListener("keydown", onKey);
      scrollLock(false);
    }
  });

  const hero = c =>
    div(
      css`rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60`,
      div(
        css`flex items-center gap-3`,
        div(
          { class: "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", style: { backgroundColor: `${c.color}1f`, color: c.color } },
          CategoryIcon(c, "h-5 w-5")
        ),
        div(
          css`min-w-0`,
          div(css`card-title`, tt("topCategory")),
          div(css`truncate text-sm font-bold text-slate-900 dark:text-white`, c.name)
        ),
        span(css`badge ml-auto bg-purple-500/10 text-purple-600 dark:text-purple-400`, `${c.share.toFixed(1)}%`)
      ),
      div(css`mt-2 text-xl font-bold tabular-nums text-slate-900 dark:text-white`, fmt(c.total)),
      div(
        css`mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700`,
        div({ class: "h-full rounded-full", style: { width: `${Math.min(c.share, 100)}%`, backgroundColor: c.color } })
      )
    );

  const stat = (icon, label, value, sub) =>
    div(
      css`rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60`,
      div(
        css`flex items-center gap-1.5`,
        span(css`text-slate-400 dark:text-slate-500`, Icon(icon, "h-3.5 w-3.5")),
        span(css`card-title`, label)
      ),
      div(css`mt-1.5 truncate text-sm font-bold tabular-nums text-slate-900 dark:text-white`, value),
      div(css`mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500`, sub)
    );

  return {
    open,
    modal: div(
      {
        class: () => `fixed inset-0 z-50 flex items-end justify-center transition-all duration-200 sm:items-center sm:p-4 ${open.value ? "visible" : "invisible pointer-events-none"}`,
      },
      div({
        class: () => `absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200 ${open.value ? "opacity-100" : "opacity-0"}`,
        onclick: close,
      }),
      div(
        {
          class: () => `card sheet relative max-h-[92dvh] w-full space-y-5 overflow-y-auto rounded-b-none transition-all duration-200 sm:max-w-lg sm:rounded-2xl ${open.value ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0 sm:translate-y-3 sm:scale-95"}`,
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "insight-title",
        },
        div(
          css`flex items-start justify-between gap-3`,
          div(
            css`flex items-center gap-3`,
            div(
              css`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400`,
              Icon(UI.insight, "h-5 w-5")
            ),
            div(
              div({ id: "insight-title" }, css`text-base font-bold text-slate-900 dark:text-white`, tt("spendingInsight")),
              div(css`mt-0.5 text-xs text-slate-400 dark:text-slate-500`,
                computed(() => `${t("transactionsCount", { n: txCount.value })} · ${scopeLabel.value}`))
            )
          ),
          button(
            { class: "btn btn-ghost px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40", "aria-label": () => t("close"), onclick: close },
            Icon(UI.close, "h-4 w-4")
          )
        ),
        div(
          { style: { display: () => (hasTop.value ? "none" : "block") } },
          div(css`rounded-2xl bg-slate-50 py-8 text-center text-sm text-slate-400 dark:bg-slate-800/60 dark:text-slate-500`,
            tt("noSpending"))
        ),
        div(
          { style: { display: () => (hasTop.value ? "block" : "none") } },
          div(
            css`space-y-3`,
            div(loop(topCat, c => `${c.id}:${c.total}:${c.share}`, hero)),
            div(
              css`grid grid-cols-1 gap-3 sm:grid-cols-2`,
              stat(UI.receipt, tt("biggestExpense"),
                span(css`text-red-500 dark:text-red-400`, computed(() => fmt(topAmount.value))),
                computed(() => [topDesc.value, topDate.value].filter(Boolean).join(" · "))),
              stat(UI.chart, tt("avgPerDay"),
                computed(() => fmt(avgPerDay.value)),
                computed(() => t("acrossDays", {
                  n: activeDays.value,
                  unit: activeDays.value === 1 ? t("day") : t("days"),
                }))),
              stat(UI.savings, tt("savingsRate"),
                span(css`text-green-600 dark:text-green-400`, computed(() => `${savingsRate.value}%`)),
                tt("savingsKeptSub")),
              div(
                css`rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60`,
                div(
                  css`flex items-center gap-1.5`,
                  span(css`text-slate-400 dark:text-slate-500`, Icon(UI.budgets, "h-3.5 w-3.5")),
                  span(css`card-title`, tt("budgetUsed"))
                ),
                div(css`mt-1.5 text-sm font-bold tabular-nums text-slate-900 dark:text-white`,
                  computed(() => `${budgetPct.value.toFixed(1)}%`)),
                div(
                  css`mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700`,
                  div({
                    class: () => {
                      const p = budgetPct.value;
                      return `h-full rounded-full transition-all ${p >= 100 ? "bg-red-500" : p >= 75 ? "bg-amber-500" : "bg-brand-500"}`;
                    },
                    style: { width: () => `${Math.min(budgetPct.value, 100)}%` },
                  })
                )
              )
            )
          )
        ),
        div(css`flex justify-end`, gotIt)
      )
    ),
  };
}

function buildBudgetModal() {
  const open = stateOf(false);
  const categoryId = stateOf(spendingByCategory.values[0]?.id || "food");
  const amount = stateOf("");
  const error = stateOf("");

  const catSelect = select(
    { class: "input", onchange: e => (categoryId.value = e.target.value) },
    spendingByCategory.values.length
      ? spendingByCategory.values.map(c => option({ value: c.id }, c.name))
      : option({ value: "food" }, tt("noCategories"))
  );
  const syncCat = () => {
    if (catSelect.o) catSelect.o.value = categoryId.value;
  };
  categoryId.subscribe(syncCat);
  onMount(syncCat);
  open.subscribe(() => scrollLock(open.value));
  onDestroy(() => {
    if (open.value) scrollLock(false);
  });

  const submit = () => {
    const amt = parseFloat(amount.value);
    if (!Number.isFinite(amt) || amt < 0) return (error.value = t("enterValidAmount"));
    dispatcher.dispatch(Actions.BUDGET_SET, { id: categoryId.value, budget: Math.round(amt * 100) / 100 });
    error.value = "";
    open.value = false;
  };

  const close = () => {
    error.value = "";
    amount.value = "";
    open.value = false;
  };

  return {
    open,
    modal: div(
      { class: () => `fixed inset-0 z-50 flex items-end justify-center transition-all duration-200 sm:items-center sm:p-4 ${open.value ? "visible" : "invisible pointer-events-none"}` },
      div({ class: () => `absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200 ${open.value ? "opacity-100" : "opacity-0"}`, onclick: close }),
      div(
        { class: () => `card sheet relative max-h-[92dvh] w-full space-y-4 overflow-y-auto rounded-b-none transition-all duration-200 sm:max-w-sm sm:rounded-2xl ${open.value ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0 sm:translate-y-3 sm:scale-95"}` },
        div(
          css`flex items-center justify-between`,
          div(css`text-base font-bold text-slate-900 dark:text-white`, tt("setMonthlyBudget")),
          button({ class: "btn btn-ghost px-2 py-2", "aria-label": () => t("close"), onclick: close }, Icon(UI.close, "h-4 w-4"))
        ),
        div(
          label(css`label`, tt("categoryCap")),
          catSelect
        ),
        // Entry point to the Categories CRUD page from the Add Budget flow.
        div(css`-mt-2 text-right`,
          a(
            {
              href: "#/categories",
              class: "text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400",
              onclick: () => (open.value = false),
            },
            span(tt("manageCategories"))
          )
        ),
        div(
          label(css`label`, tt("monthlyLimit")),
          inputNumber({ class: "input", min: "0", step: "10", placeholder: "0", bind: amount })
        ),
        div(
          { style: { display: () => (error.value ? "block" : "none") } },
          div(css`rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400`, error)
        ),
        div(
          css`flex justify-end gap-2`,
          button({ class: "btn btn-ghost", onclick: close }, tt("cancel")),
          button({ class: "btn btn-primary", onclick: submit }, tt("saveBudget"))
        )
      )
    ),
  };
}

const ACTION_STYLES = {
  brand: "bg-brand-500/10 text-brand-700 dark:text-brand-400",
  green: "bg-green-500/10 text-green-600 dark:text-green-400",
  purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

function ActionCard({ icon, title, sub, tone, onclick }) {
  return button(
    {
      class: "card flex items-center gap-4 text-left transition-transform hover:-translate-y-0.5 hover:shadow-md",
      onclick,
    },
    div(
      { class: `flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ACTION_STYLES[tone]}` },
      Icon(icon, "h-5 w-5")
    ),
    div(
      div(css`text-sm font-bold text-slate-900 dark:text-white`, title),
      div(css`text-xs text-slate-500 dark:text-slate-400`, sub)
    ),
    span(css`ml-auto text-slate-300 dark:text-slate-600`, Icon(UI.chevron, "h-4 w-4"))
  );
}

export function QuickActions() {
  const insight = buildInsightModal();
  const budget = buildBudgetModal();
  const txOpen = stateOf(false);
  const editing = stateOf(null);

  return div(
    css`space-y-4`,
    div(
      css`grid gap-4 sm:grid-cols-3`,
      ActionCard({
        icon: UI.insight, title: tt("viewInsight"), sub: tt("whereMoneyGoes"), tone: "purple",
        onclick: () => (insight.open.value = true),
      }),
      ActionCard({
        icon: UI.add, title: tt("addTransaction"), sub: tt("logIncomeExpense"), tone: "brand",
        onclick: () => (txOpen.value = true),
      }),
      ActionCard({
        icon: UI.budgets, title: tt("addBudget"), sub: tt("setMonthlyLimit"), tone: "green",
        onclick: () => (budget.open.value = true),
      })
    ),
    insight.modal,
    budget.modal,
    TransactionForm({ open: txOpen, editing, onClose: () => (txOpen.value = false) })
  );
}
