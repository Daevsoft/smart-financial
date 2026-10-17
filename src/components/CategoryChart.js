import { computed, loop } from "@daevsoft/jetz";
import { div, span } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { spendingByCategory, totalExpense, donutGradient, scopeLabel } from "../state/transactions.js";
import { fmt } from "../state/preferences.js";
import { tt } from "../state/i18n.js";

export function CategoryChart() {
  return div(
    css`@container card flex flex-col gap-5`,
    div(
      div(css`text-sm font-bold text-slate-900 dark:text-white`, tt("spendingOverview")),
      div(css`card-title`, scopeLabel)
    ),
    div(
      css`flex flex-col items-center gap-6 @[27rem]:flex-row`,
      div(
        {
          class: "relative h-44 w-44 shrink-0 rounded-full transition-colors duration-300",
          style: { background: () => donutGradient.value || "conic-gradient(#e2e8f0 0% 100%)" },
        },
        div(
          css`absolute inset-[16%] flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner dark:bg-slate-900`,
          span(css`text-xl font-bold tracking-tight text-slate-900 dark:text-white`, computed(() => fmt(totalExpense.value))),
          span(css`text-xs text-slate-400 dark:text-slate-500`, tt("totalSpent"))
        )
      ),
      div(
        css`min-w-0 flex-1 space-y-2.5`,
        div(
          { style: { display: () => (totalExpense.value ? "none" : "block") } },
          div(css`py-6 text-center text-sm text-slate-400 dark:text-slate-500`, tt("noSpending"))
        ),
        // Own container: loop() prepends rebuilt rows into its parent, which
        // would otherwise push the empty-state message above the list.
        div(css`space-y-2.5`, loop(spendingByCategory, r => r.id, r =>
          div(
            css`flex items-center gap-2 sm:gap-3`,
            span({ class: "h-2.5 w-2.5 shrink-0 rounded-full", style: { backgroundColor: r.color } }),
            span(css`min-w-0 flex-1 truncate text-sm text-slate-600 dark:text-slate-300`, r.name),
            span(css`shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100`, computed(() => fmt(r.total))),
            span(css`w-12 shrink-0 text-right text-xs tabular-nums text-slate-400 dark:text-slate-500`, `${r.share.toFixed(1)}%`)
          )))
      )
    )
  );
}
