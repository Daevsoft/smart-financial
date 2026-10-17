import { computed, loop } from "@daevsoft/jetz";
import { div, p, span, inputNumber } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { dispatcher, Actions } from "../state/store.js";
import { budgetRows, budgetTotal, budgetSpent, budgetPct, scopeLabel } from "../state/transactions.js";
import { fmt } from "../state/preferences.js";
import { t, tt } from "../state/i18n.js";
import { CategoryIcon } from "../components/icons.js";

function budgetRow(r) {
  const over = r.budget > 0 && r.spent > r.budget;
  return div(
    css`card flex flex-col gap-4 lg:flex-row lg:items-center`,
    div(
      css`flex min-w-0 items-center gap-3`,
      div(
        { class: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg", style: { backgroundColor: `${r.color}1f` } },
        CategoryIcon(r, "h-5 w-5")
      ),
      div(
        div(css`text-sm font-bold text-slate-900 dark:text-white`, r.name),
        div(css`text-xs text-slate-500 dark:text-slate-400`,
          computed(() => t("spentOf", { spent: fmt(r.spent), budget: fmt(r.budget) })))
      )
    ),
    div(
      css`flex-1`,
      div(css`h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800`,
        div({
          class: () => `h-full rounded-full transition-all duration-300 ${over ? "bg-red-500" : "bg-brand-500"}`,
          style: { width: () => `${Math.min(r.pct, 100)}%` },
        })),
      div(css`mt-1.5 flex justify-between text-xs`,
        span(
          { class: () => `font-semibold ${over ? "text-red-500 dark:text-red-400" : "text-slate-400 dark:text-slate-500"}` },
          computed(() =>
            r.budget > 0
              ? `${t("pctUsed", { pct: r.pct.toFixed(1) })}${over ? ` · ${t("overBudgetShort")}` : ""}`
              : t("noBudgetSet")
          )
        ),
        span(css`text-slate-400 dark:text-slate-500`,
          computed(() => (r.budget > 0 ? t("left", { amt: fmt(Math.max(r.budget - r.spent, 0)) }) : "")))
      )
    ),
    div(
      css`w-full lg:w-32`,
      div(css`label mb-1`, tt("monthlyBudget")),
      inputNumber({
        class: "input",
        min: "0",
        step: "10",
        value: r.budget,
        onchange: e => dispatcher.dispatch(Actions.BUDGET_SET, { id: r.id, budget: Math.max(parseFloat(e.target.value) || 0, 0) }),
      })
    )
  );
}

export function Budgets() {
  return div(
    css`space-y-6`,
    div(
      p(css`text-2xl font-bold tracking-tight text-slate-900 dark:text-white`, tt("budgets")),
      p(css`mt-1 text-sm text-slate-500 dark:text-slate-400`,
        computed(() => t("budgetsSub", { scope: scopeLabel.value.toLowerCase() })))
    ),
    div(
      css`card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`,
      div(
        div(css`card-title`, tt("overallUsage")),
        div(css`mt-1 text-xl font-bold text-slate-900 dark:text-white`,
          computed(() => `${fmt(budgetSpent.value)} / ${fmt(budgetTotal.value)}`))
      ),
      div(
        css`w-full sm:w-72`,
        div(css`h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800`,
          div({
            class: () => `h-full rounded-full transition-all duration-300 ${budgetPct.value > 100 ? "bg-red-500" : "bg-brand-500"}`,
            style: { width: () => `${Math.min(budgetPct.value, 100)}%` },
          })),
        div(css`mt-1 text-right text-xs font-semibold text-slate-400 dark:text-slate-500`,
          computed(() => t("pctUsed", { pct: budgetPct.value.toFixed(1) })))
      )
    ),
    div(css`space-y-4`, loop(budgetRows, r => r.id, budgetRow))
  );
}
