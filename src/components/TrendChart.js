import { Chart } from "chart.js/auto";
import { computed, onMount, onDestroy } from "@daevsoft/jetz";
import { div, button, span, canvas } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { trendRange, trendData, trendTitle, trendEmpty } from "../state/transactions.js";
import { fmt } from "../state/preferences.js";
import { t, tt, localeTag } from "../state/i18n.js";
import { dispatcher, Actions } from "../state/store.js";

const RANGES = [
  { value: "1d", label: "1D" },
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
];

const DERIVED_ACTIONS = new Set([
  Actions.TX_ADD, Actions.TX_UPDATE, Actions.TX_DELETE,
  Actions.CAT_ADD, Actions.CAT_UPDATE, Actions.CAT_DELETE,
  Actions.BUDGET_SET, Actions.DATA_IMPORT, Actions.DATA_DEMO, Actions.DATA_CLEAR,
  Actions.TREND_RANGE, Actions.PREFS_SET,
]);

const compactTick = v =>
  new Intl.NumberFormat(localeTag(), { notation: "compact", maximumFractionDigits: 1 }).format(v);

export function TrendChart() {
  let chart = null;
  const el = canvas();

  const toChartData = () => ({
    labels: trendData.values.map(r => r.label),
    datasets: [
      {
        label: t("income"),
        data: trendData.values.map(r => r.income),
        borderColor: "#22c55e",
        backgroundColor: "rgba(34, 197, 94, 0.10)",
        fill: true,
        tension: 0.35,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
      {
        label: t("expenses"),
        data: trendData.values.map(r => r.expense),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.08)",
        fill: true,
        tension: 0.35,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  });

  const options = () => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { labels: { color: "#94a3b8", usePointStyle: true, boxWidth: 8, boxHeight: 8 } },
      tooltip: {
        callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` },
      },
    },
    scales: {
      x: {
        ticks: { color: "#94a3b8", maxTicksLimit: 10, maxRotation: 0, font: { size: 11 } },
        grid: { display: false },
      },
      y: {
        ticks: { color: "#94a3b8", font: { size: 11 }, callback: v => compactTick(v) },
        grid: { color: "rgba(148, 163, 184, 0.15)" },
        beginAtZero: true,
      },
    },
  });

  const init = () => {
    if (chart || !el.o) return;
    chart = new Chart(el.o, { type: "line", data: toChartData(), options: options() });
  };

  const update = () => {
    if (!chart) return;
    chart.data = toChartData();
    chart.options = options();
    chart.update();
  };

  // Data mutations (including range changes) flow through the dispatcher;
  // waitFor("derived") guarantees trendData was rebuilt before we read it.
  const offDispatch = dispatcher.subscribe("trendchart", action => {
    dispatcher.waitFor("derived");
    if (DERIVED_ACTIONS.has(action)) update();
  });

  onMount(init);
  onDestroy(() => {
    if (chart) chart.destroy();
    chart = null;
    offDispatch();
  });

  return div(
    css`card`,
    div(
      css`mb-4 flex flex-wrap items-center justify-between gap-3`,
      div(
        div(css`text-sm font-bold text-slate-900 dark:text-white`, tt("cashFlowTrend")),
        div(css`card-title`, span(computed(() => `${trendTitle.value} · ${t("incomeVsExpenses")}`)))
      ),
      div(
        css`grid w-full grid-cols-5 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 lg:w-auto lg:flex`,
        RANGES.map(r =>
          button(
            {
              class: () =>
                `rounded-lg px-1 py-1.5 text-center text-xs font-bold tabular-nums transition-colors sm:px-3 ${
                  trendRange.value === r.value
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`,
              onclick: () => dispatcher.dispatch(Actions.TREND_RANGE, r.value),
            },
            r.label
          )
        )
      )
    ),
    div(
      { style: { display: () => (trendEmpty.value ? "block" : "none") } },
      div(css`py-16 text-center text-sm text-slate-400 dark:text-slate-500`, tt("noTrendData"))
    ),
    div({ class: () => `h-56 sm:h-72 ${trendEmpty.value ? "hidden" : ""}` }, el)
  );
}
