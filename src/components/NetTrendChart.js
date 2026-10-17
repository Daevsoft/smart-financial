import { Chart } from "chart.js/auto";
import { computed, onMount, onDestroy } from "@daevsoft/jetz";
import { div, span, canvas } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import {
  netTrend, netTrendEmpty, netTrendLast, netTrendPrev, netTrendDelta,
} from "../state/transactions.js";
import { fmt } from "../state/preferences.js";
import { t, tt, localeTag } from "../state/i18n.js";
import { dispatcher, Actions } from "../state/store.js";
import { Icon, UI } from "./icons.js";

const UP = "#22c55e";
const DOWN = "#ef4444";

const DERIVED_ACTIONS = new Set([
  Actions.TX_ADD, Actions.TX_UPDATE, Actions.TX_DELETE,
  Actions.CAT_ADD, Actions.CAT_UPDATE, Actions.CAT_DELETE,
  Actions.BUDGET_SET, Actions.DATA_IMPORT, Actions.DATA_DEMO, Actions.DATA_CLEAR,
  Actions.PREFS_SET,
]);

const compactTick = v =>
  new Intl.NumberFormat(localeTag(), { notation: "compact", signed: true, maximumFractionDigits: 1 }).format(v);

export function NetTrendChart() {
  let chart = null;
  let up = true; // sign of the newest month; decides line + gradient colour
  const el = canvas();

  // Scriptable fill: chartArea only exists after the first layout pass.
  const areaFill = ctx => {
    const { chart: c } = ctx;
    if (!c.chartArea) return up ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.10)";
    const g = c.ctx.createLinearGradient(0, c.chartArea.top, 0, c.chartArea.bottom);
    g.addColorStop(0, up ? "rgba(34, 197, 94, 0.30)" : "rgba(239, 68, 68, 0.26)");
    g.addColorStop(1, "rgba(255, 255, 255, 0)");
    return g;
  };

  const toChartData = () => {
    const rows = netTrend.values;
    up = netTrendLast.value >= 0;
    return {
      labels: rows.map(r => r.label),
      datasets: [
        {
          label: t("net"),
          data: rows.map(r => r.net),
          borderColor: up ? UP : DOWN,
          backgroundColor: areaFill,
          fill: "origin",
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBorderWidth: 0,
          pointBackgroundColor: c => (c.raw >= 0 ? UP : DOWN),
        },
        // Dashed zero baseline: Chart.js grid lines cannot be dashed per-tick.
        {
          label: "zero",
          data: rows.map(() => 0),
          borderColor: "rgba(148, 163, 184, 0.65)",
          borderDash: [5, 5],
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
          tension: 0,
        },
      ],
    };
  };

  const options = () => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        filter: item => item.datasetIndex === 0,
        callbacks: {
          label: ctx => {
            const r = netTrend.values[ctx.dataIndex] || { income: 0, expense: 0 };
            return [
              ` ${t("net")}: ${fmt(ctx.parsed.y)}`,
              ` ${t("income")}: ${fmt(r.income)}`,
              ` ${t("expenses")}: ${fmt(r.expense)}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "#94a3b8", maxTicksLimit: 8, maxRotation: 0, font: { size: 11 } },
        grid: { display: false },
      },
      y: {
        ticks: { color: "#94a3b8", font: { size: 11 }, callback: v => compactTick(v) },
        grid: { color: "rgba(148, 163, 184, 0.15)" },
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

  const offDispatch = dispatcher.subscribe("nettrendchart", action => {
    dispatcher.waitFor("derived");
    if (DERIVED_ACTIONS.has(action)) update();
  });

  onMount(init);
  onDestroy(() => {
    if (chart) chart.destroy();
    chart = null;
    offDispatch();
  });

  const isUp = () => netTrendLast.value >= 0;
  const chipIcon = (svg, positive) =>
    span({ class: () => (isUp() === positive ? "inline-flex" : "hidden") }, Icon(svg, "h-3.5 w-3.5"));

  return div(
    css`card`,
    div(
      css`mb-4 flex flex-wrap items-start justify-between gap-3`,
      div(
        div(css`text-sm font-bold text-slate-900 dark:text-white`, tt("netTrend")),
        div(css`card-title`, span(computed(() => t("netTrendSub"))))
      ),
      div(
        css`text-right`,
        div(
          { class: () => `text-xl font-bold tabular-nums ${isUp() ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}` },
          computed(() => fmt(netTrendLast.value))
        ),
        div(
          {
            class: () =>
              `mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold tabular-nums ${
                isUp() ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"
              }`,
          },
          chipIcon(UI.trendUp, true),
          chipIcon(UI.trendDown, false),
          computed(() =>
            netTrendPrev.value === 0
              ? t("noChange")
              : `${Math.abs(netTrendDelta.value).toFixed(1)}% ${t("vsLastMonth")}`
          )
        )
      )
    ),
    div(
      { style: { display: () => (netTrendEmpty.value ? "block" : "none") } },
      div(css`py-16 text-center text-sm text-slate-400 dark:text-slate-500`, tt("noTrendData"))
    ),
    div({ class: () => `h-56 sm:h-72 ${netTrendEmpty.value ? "hidden" : ""}` }, el)
  );
}
