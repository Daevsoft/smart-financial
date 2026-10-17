import { stateOf, computed, loop } from "@daevsoft/jetz";
import { div, span, button, a } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { overBudgetRows, overBudgetCount, overBudgetTotal } from "../state/transactions.js";
import { fmt } from "../state/preferences.js";
import { t, tt } from "../state/i18n.js";
import { Icon, UI, CategoryIcon } from "./icons.js";

// Warning banner listing categories that exceeded their monthly limit for the
// selected period. Dismissal is session-local; it re-appears on later visits.
export function BudgetAlert() {
  const dismissed = stateOf(false);
  const visible = computed(() => overBudgetCount.value > 0 && !dismissed.value);
  // In-flow conditional: mount first, paint the collapsed frame, then flip the
  // open classes so the max-height transition actually runs (display:none
  // elements skip transitions).
  const mounted = stateOf(false);
  const shown = stateOf(false);

  const reveal = () => {
    mounted.value = true;
    requestAnimationFrame(() => requestAnimationFrame(() => (shown.value = true)));
  };
  visible.subscribe(v => {
    if (v) {
      if (!mounted.value) reveal();
    } else {
      shown.value = false;
      setTimeout(() => {
        if (!visible.value) mounted.value = false;
      }, 320);
    }
  });
  if (visible.value) reveal();

  const row = r =>
    div(
      css`flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2.5 dark:bg-slate-900/60`,
      div(
        { class: "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", style: { backgroundColor: `${r.color}1f`, color: r.color } },
        CategoryIcon(r, "h-4 w-4")
      ),
      div(
        css`min-w-0 flex-1`,
        div(css`text-sm font-bold text-slate-900 dark:text-white`, r.name),
        div(
          css`mt-1 flex items-center gap-2`,
          div(css`h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-red-500/20`,
            div({ class: "h-full rounded-full bg-red-500", style: { width: "100%" } })),
          span(css`text-xs font-semibold text-red-600 dark:text-red-400`,
            computed(() => t("pctOf", { pct: r.pct.toFixed(0), amt: fmt(r.budget) })))
        )
      ),
      div(css`shrink-0 text-right`,
        div(css`text-sm font-bold text-red-600 dark:text-red-400`, fmt(r.over)),
        div(css`text-xs text-slate-400 dark:text-slate-500`, computed(() => `${fmt(r.spent)} ${t("spent")}`))
      )
    );

  const summary = computed(() =>
    t("catsOverLimit", {
      n: overBudgetCount.value,
      unit: overBudgetCount.value === 1 ? t("category") : t("categories"),
      amt: fmt(overBudgetTotal.value),
    })
  );

  return div(
    {
      class: () =>
        `overflow-hidden transition-all duration-300 ${
          mounted.value ? (shown.value ? "max-h-[42rem] opacity-100" : "max-h-0 opacity-0") : "hidden"
        }`,
    },
    div(
      {
        class: "card border border-red-500/30 bg-red-500/5 dark:bg-red-500/10",
        role: "alert",
      },
    div(
      css`flex items-center justify-between gap-3`,
      div(
        css`flex items-center gap-2.5`,
        div(css`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-600 dark:text-red-400`,
          Icon(UI.alert, "h-5 w-5")),
        div(
          div(css`flex items-center gap-2`,
            div(css`text-sm font-bold text-slate-900 dark:text-white`, tt("overBudgetTitle")),
            span(css`rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-600 dark:text-red-400`,
              overBudgetCount)
          ),
          div(css`mt-0.5 text-xs text-slate-500 dark:text-slate-400`, summary)
        )
      ),
      button({ class: "btn btn-ghost px-2 py-1 text-red-500 dark:text-red-400", title: () => t("dismiss"),
        onclick: () => (dismissed.value = true) }, Icon(UI.close, "h-4 w-4"))
    ),
    div(css`mt-3 space-y-2`, loop(overBudgetRows, r => r.id, row)),
    div(
      css`mt-3 flex items-center justify-between border-t border-red-500/15 pt-3`,
      span(css`text-xs font-semibold text-slate-500 dark:text-slate-400`, summary),
      a({ href: "#/budgets", class: "text-xs font-bold text-red-600 hover:underline dark:text-red-400" },
        tt("reviewBudgets"))
    )
    )
  );
}
