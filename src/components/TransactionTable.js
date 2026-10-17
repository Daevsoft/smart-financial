import { computed, loop } from "@daevsoft/jetz";
import { div, span, button } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { dispatcher, Actions } from "../state/store.js";
import { categoryById } from "../state/transactions.js";
import { fmt } from "../state/preferences.js";
import { t, tt, localeTag } from "../state/i18n.js";
import { Icon, UI, CategoryIcon } from "./icons.js";

// A six-column grid is unusable on a phone and in a narrow card, but the same
// rows must render at both sizes, so each row is one grid: two auto-placed
// columns in a narrow container (description + amount, then meta + actions)
// and six explicitly placed columns in a wide one. `@[44rem]:contents`
// dissolves the meta wrapper only when it can join the grid. Breakpoints are
// container-based because the table lives both in a full-width page and in a
// 3/5-column dashboard card.
const GRID = "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 @[44rem]:grid-cols-[5rem_minmax(7rem,1fr)_9rem_6.5rem_6.5rem_4.5rem] @[44rem]:items-center @[44rem]:gap-3";

function categoryBadge(categoryId) {
  const c = categoryById(categoryId);
  return span(
    {
      class: "badge",
      style: { backgroundColor: `${c.color}1f`, color: c.color },
    },
    CategoryIcon(c, "h-3 w-3"),
    c.name
  );
}

function typeBadge(type) {
  return type === "income"
    ? span(css`badge bg-brand-500/10 text-brand-700 dark:text-brand-400`, tt("income"))
    : span(css`badge bg-slate-500/10 text-slate-500 dark:text-slate-400`, tt("expense"));
}

const amountText = tx => computed(() => `${tx.type === "income" ? "+" : "−"}${fmt(tx.amount)}`);

const dateText = tx =>
  computed(() =>
    new Date(`${tx.date}T00:00:00`).toLocaleDateString(localeTag(), { month: "short", day: "numeric", year: "numeric" })
  );

const iconButton = (label, icon, onclick) =>
  button(
    { class: "btn btn-ghost px-2 py-1.5 text-xs", title: () => t(label), onclick },
    Icon(icon, "h-3.5 w-3.5")
  );

// rows: a ListState rebuilt by the store; count: tracked stateOf mirroring
// rows.length (ListState reads are untracked, so emptiness needs a signal).
export function TransactionTable({ rows, count, onEdit = null }) {
  const row = tx =>
    div(
      { class: `border-t border-slate-100 px-1 py-3 @[44rem]:px-3 dark:border-slate-800 ${GRID}` },
      div(
        css`min-w-0 @[44rem]:col-start-2 @[44rem]:row-start-1`,
        div(css`truncate text-sm font-medium text-slate-800 dark:text-slate-100`, tx.description),
        ...(tx.note ? [div(css`mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500`, tx.note)] : [])
      ),
      div(
        {
          class: "shrink-0 text-right text-sm font-semibold tabular-nums @[44rem]:col-start-5 @[44rem]:row-start-1",
          style: { color: tx.type === "income" ? "#65a30d" : undefined },
        },
        amountText(tx)
      ),
      div(
        css`flex flex-wrap items-center gap-2 @[44rem]:contents`,
        span(css`text-xs whitespace-nowrap text-slate-500 dark:text-slate-400 @[44rem]:col-start-1 @[44rem]:row-start-1 @[44rem]:block`,
          dateText(tx)),
        span(css`@[44rem]:col-start-3 @[44rem]:row-start-1 @[44rem]:block`, categoryBadge(tx.categoryId)),
        span(css`hidden @[44rem]:col-start-4 @[44rem]:row-start-1 @[44rem]:block`, typeBadge(tx.type))
      ),
      ...(onEdit
        ? [div(
            css`flex justify-end gap-1 @[44rem]:col-start-6 @[44rem]:row-start-1`,
            iconButton("edit", UI.pencil, () => onEdit(tx)),
            iconButton("delete", UI.trash, () => dispatcher.dispatch(Actions.TX_DELETE, tx.id))
          )]
        : [])
    );

  const head = () =>
    div(
      { class: "hidden border-b border-slate-200 pb-1 @[44rem]:grid @[44rem]:grid-cols-[5rem_minmax(7rem,1fr)_9rem_6.5rem_6.5rem_4.5rem] @[44rem]:items-center @[44rem]:gap-3 @[44rem]:px-3 dark:border-slate-800" },
      span(css`table-head @[44rem]:col-start-1`, tt("date")),
      span(css`table-head @[44rem]:col-start-2`, tt("description")),
      span(css`table-head @[44rem]:col-start-3`, tt("category")),
      span(css`table-head @[44rem]:col-start-4`, tt("type")),
      span(css`table-head text-right @[44rem]:col-start-5`, tt("amount")),
      ...(onEdit ? [span(css`table-head text-right @[44rem]:col-start-6`, "")] : [])
    );

  return div(
    css`@container min-w-0`,
    div(
      { style: { display: () => (count.value ? "none" : "block") } },
      div(css`py-10 text-center text-sm text-slate-400 dark:text-slate-500`,
        tt("noTransactions"))
    ),
    div(
      { style: { display: () => (count.value ? "block" : "none") } },
      head(),
      loop(rows, tx => tx.id, row)
    )
  );
}
