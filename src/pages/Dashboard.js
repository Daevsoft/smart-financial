import { computed, loop, onMount } from "@daevsoft/jetz";
import { div, p, select, option, a } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { StatCard } from "../components/StatCard.js";
import { CategoryChart } from "../components/CategoryChart.js";
import { TransactionTable } from "../components/TransactionTable.js";
import { TrendChart } from "../components/TrendChart.js";
import { NetTrendChart } from "../components/NetTrendChart.js";
import { QuickActions } from "../components/QuickActions.js";
import { BudgetAlert } from "../components/BudgetAlert.js";
import { selectedMonth } from "../state/store.js";
import {
  netBalance, totalIncome, totalExpense, savingsRate,
  incomeDelta, expenseDelta, txCount, recentTransactions, scopeLabel, monthOptions,
} from "../state/transactions.js";
import { fmt } from "../state/preferences.js";
import { t, tt } from "../state/i18n.js";
import { UI } from "../components/icons.js";

function monthPicker() {
  const sel = select(
    { class: "input w-44", onchange: e => (selectedMonth.value = e.target.value) },
    option({ value: "all" }, tt("allTime")),
    // Label is part of the key: same-key rows are recycled without re-render,
    // so a language change must force a fresh option element.
    loop(monthOptions, m => `${m.value}:${m.label}`, m => option({ value: m.value }, m.label))
  );
  const sync = () => {
    if (sel.o) sel.o.value = selectedMonth.value;
  };
  selectedMonth.subscribe(sync);
  onMount(sync);
  return sel;
}

const deltaText = (deltaState, upIsGood) => computed(() => {
  const d = deltaState.value;
  if (!d) return t("noChange");
  const good = upIsGood ? d > 0 : d < 0;
  return `${d > 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)}% ${t("vsLastMonth")} · ${good ? t("onTrack") : t("watchThis")}`;
});

export function Dashboard() {
  return div(
    css`space-y-6`,
    div(
      css`flex flex-wrap items-end justify-between gap-4`,
      div(
        p(css`text-2xl font-bold tracking-tight text-slate-900 dark:text-white`, tt("welcome")),
        p(css`mt-1 text-sm text-slate-500 dark:text-slate-400`,
          computed(() => t("moneyFor", { scope: scopeLabel.value.toLowerCase() })))
      ),
      monthPicker()
    ),
    BudgetAlert(),
    QuickActions(),
    TrendChart(),
    NetTrendChart(),
    div(
      css`grid gap-4 sm:grid-cols-2 xl:grid-cols-4`,
      StatCard({
        label: tt("totalBalance"),
        value: computed(() => fmt(netBalance.value)),
        icon: UI.wallet,
        tone: "brand",
        sub: tt("incomeMinusExpenses"),
      }),
      StatCard({
        label: tt("income"),
        value: computed(() => fmt(totalIncome.value)),
        icon: UI.income,
        tone: "green",
        sub: deltaText(incomeDelta, true),
      }),
      StatCard({
        label: tt("expenses"),
        value: computed(() => fmt(totalExpense.value)),
        icon: UI.expense,
        tone: "red",
        sub: deltaText(expenseDelta, false),
      }),
      StatCard({
        label: tt("savingsRate"),
        value: computed(() => `${savingsRate.value}%`),
        icon: UI.savings,
        tone: "purple",
        sub: computed(() => (totalIncome.value > 0 ? t("incomeKept") : t("addIncomeTrack"))),
      })
    ),
    div(
      css`grid gap-6 lg:grid-cols-5`,
      // The donut + legend needs ~500px to sit side by side, so the chart takes
      // the wider track; the recent list is stacked rows and fits in the narrow one.
      div(css`min-w-0 lg:col-span-3`, CategoryChart()),
      div(
        css`card min-w-0 lg:col-span-2`,
        div(
          css`mb-4 flex items-center justify-between`,
          div(css`text-sm font-bold text-slate-900 dark:text-white`, tt("recentTransactions")),
          a({ href: "#/transactions", class: "text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400" }, tt("viewAll"))
        ),
        TransactionTable({ rows: recentTransactions, count: txCount })
      )
    )
  );
}
