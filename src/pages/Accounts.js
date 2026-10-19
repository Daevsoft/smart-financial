import { stateOf, computed, batch, loop, onMount, onDestroy } from "@daevsoft/jetz";
import { div, p, span, button, label, inputText, inputNumber, select, option, input, a } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { dispatcher, Actions, accounts, savings } from "../state/store.js";
import {
  accCount, accountBalances, accountUsage, netWorth, totalSaved, savedThisPeriod,
  savedDaysThisMonth, depositStreak, periodSavedLabel, kindLabel, ACCOUNT_KINDS, skippedRecent,
} from "../state/accounts.js";
import { fmt } from "../state/preferences.js";
import { scrollLock } from "../state/ui.js";
import { t, tt } from "../state/i18n.js";
import { Icon, UI, AccountIcon } from "../components/icons.js";

const SWATCHES = ["#22c55e", "#3b82f6", "#a855f7", "#eab308", "#06b6d4", "#f97316", "#ef4444", "#94a3b8"];

// Labels for the Tabler icon keys available to accounts.
const ICON_LABELS = {
  wallet: "Wallet",
  "building-bank": "Bank",
  "device-mobile": "Mobile",
  coins: "Coins",
  package: "Box",
};

// Picking a kind suggests the icon that fits it, so the common cases need no
// extra taps.
const KIND_ICON = {
  cash: "wallet",
  bank: "building-bank",
  digital: "device-mobile",
  deposit: "coins",
  custom: "package",
};

function uniqueId(name) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "account";
  let id = base;
  for (let n = 2; accounts.values.some(a => a.id === id); n++) id = `${base}-${n}`;
  return id;
}

// Account a delete would move records to (mirrors store.js ACC_DELETE).
function deleteFallback(cat) {
  const rest = accounts.values.filter(a => a.id !== cat.id);
  return rest.find(a => a.kind === "cash") || rest.find(a => a.kind !== "deposit") || rest[0] || null;
}

function AccountForm({ open, editing, onClose }) {
  const name = stateOf("");
  const kind = stateOf("cash");
  const color = stateOf("#22c55e");
  const icon = stateOf("wallet");
  const opening = stateOf("");
  const error = stateOf("");

  const fill = () => {
    const a = editing.value;
    batch(() => {
      name.value = a ? a.name : "";
      kind.value = a ? a.kind : "cash";
      color.value = a ? a.color : "#22c55e";
      icon.value = a ? a.icon : "wallet";
      opening.value = a && a.opening ? String(a.opening) : "";
      error.value = "";
    });
  };

  const setKind = next => {
    kind.value = next;
    icon.value = KIND_ICON[next] || "package";
  };

  const submit = () => {
    const nm = name.value.trim();
    if (!nm) return (error.value = t("nameRequired"));
    const dupe = accounts.values.some(
      a => a.id !== editing.value?.id && a.name.toLowerCase() === nm.toLowerCase()
    );
    if (dupe) return (error.value = t("nameTaken"));
    const amt = parseFloat(opening.value);
    const base = {
      name: nm,
      kind: kind.value,
      color: color.value,
      icon: icon.value,
      opening: Number.isFinite(amt) ? Math.round(amt * 100) / 100 : 0,
    };
    const existing = editing.value;
    if (existing) dispatcher.dispatch(Actions.ACC_UPDATE, { id: existing.id, ...base });
    else dispatcher.dispatch(Actions.ACC_ADD, { id: uniqueId(nm), ...base });
    onClose();
  };

  const kindSelect = select(
    { class: "input", onchange: e => setKind(e.target.value) },
    ACCOUNT_KINDS.map(k => option({ value: k }, kindLabel(k)))
  );
  const iconSelect = select(
    { class: "input", onchange: e => (icon.value = e.target.value) },
    Object.entries(ICON_LABELS).map(([key, lbl]) => option({ value: key }, lbl))
  );
  const colorInput = input({
    type: "color",
    class: "h-10 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900",
    oninput: e => (color.value = e.target.value),
  });

  open.subscribe(() => {
    if (open.value) fill();
    scrollLock(open.value);
  });
  onDestroy(() => {
    if (open.value) scrollLock(false);
  });
  const syncControls = () => {
    if (kindSelect.o) kindSelect.o.value = kind.value;
    if (iconSelect.o) iconSelect.o.value = icon.value;
    if (colorInput.o) colorInput.o.value = color.value;
  };
  kind.subscribe(syncControls);
  icon.subscribe(syncControls);
  color.subscribe(syncControls);
  onMount(syncControls);

  return div(
    { class: () => `fixed inset-0 z-50 flex items-end justify-center transition-all duration-200 sm:items-center sm:p-4 ${open.value ? "visible" : "invisible pointer-events-none"}` },
    div({ class: () => `absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200 ${open.value ? "opacity-100" : "opacity-0"}`, onclick: onClose }),
    div(
      { class: () => `card sheet relative max-h-[92dvh] w-full space-y-4 overflow-y-auto rounded-b-none transition-all duration-200 sm:max-w-lg sm:rounded-2xl ${open.value ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0 sm:translate-y-3 sm:scale-95"}` },
      div(
        css`flex items-center justify-between`,
        div(css`text-base font-bold text-slate-900 dark:text-white`,
          computed(() => (editing.value ? t("editAccount") : t("newAccount")))),
        button({ class: "btn btn-ghost px-2 py-2", "aria-label": () => t("close"), onclick: onClose }, Icon(UI.close, "h-5 w-5"))
      ),
      div(
        label(css`label`, tt("accountName")),
        inputText({ class: "input", placeholder: () => t("accountNamePlaceholder"), bind: name })
      ),
      div(
        css`grid grid-cols-1 gap-3 sm:grid-cols-2`,
        div(label(css`label`, tt("kind")), kindSelect),
        div(
          label(css`label`, tt("openingBalance")),
          inputNumber({ class: "input", step: "1", placeholder: "0", bind: opening })
        )
      ),
      div(
        css`grid grid-cols-1 gap-3 sm:grid-cols-2`,
        div(
          label(css`label`, tt("color")),
          div(css`flex flex-wrap items-center gap-2`,
            colorInput,
            SWATCHES.map(hex =>
              button({
                class: () => `h-6 w-6 rounded-full transition-transform hover:scale-110 ${color.value === hex ? "ring-2 ring-brand-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900" : ""}`,
                style: { backgroundColor: hex },
                onclick: () => (color.value = hex),
              })
            )
          )
        ),
        div(label(css`label`, tt("icon")), iconSelect)
      ),
      div(css`text-xs leading-relaxed text-slate-500 dark:text-slate-400`, tt("accountsHint")),
      div(
        { style: { display: () => (error.value ? "block" : "none") } },
        div(css`rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400`, error)
      ),
      div(
        css`flex justify-end gap-2 pt-1`,
        button({ class: "btn btn-ghost", onclick: onClose }, tt("cancel")),
        button({ class: "btn btn-primary", onclick: submit },
          span(computed(() => (editing.value ? t("saveChanges") : t("addAccount")))))
      )
    )
  );
}

function statBox(caption, value) {
  return div(
    css`rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60`,
    div(css`text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500`, caption),
    div(css`mt-0.5 text-sm font-bold text-slate-900 dark:text-white`, value)
  );
}

function planCard() {
  const scheduleLabel = computed(() => t(savings.schedule.value === "monthly" ? "scheduleMonthly" : "scheduleDaily"));
  const streakText = computed(() =>
    depositStreak.value > 0 ? t("streak", { n: depositStreak.value }) : t("streakNone")
  );
  const skipped = computed(() =>
    skippedRecent.value ? t("skippedDaysInfo", { n: skippedRecent.value }) : ""
  );
  return div(
    css`card space-y-4`,
    div(
      css`flex flex-wrap items-start justify-between gap-3`,
      div(
        css`flex items-center gap-3`,
        div(css`flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400`, Icon(UI.savings, "h-5 w-5")),
        div(
          p(css`text-sm font-bold text-slate-900 dark:text-white`, tt("totalSaved")),
          p(css`text-2xl font-bold tracking-tight text-slate-900 dark:text-white`, computed(() => fmt(totalSaved.value)))
        )
      ),
      a({ href: "#/settings", class: "btn btn-ghost ml-auto text-xs" }, Icon(UI.settings, "h-4 w-4"), " ", tt("settings"))
    ),
    div(
      css`grid grid-cols-2 gap-3 sm:grid-cols-4`,
      statBox(tt("schedule"), scheduleLabel),
      statBox(tt("planTarget"), computed(() => fmt(Number(savings.target.value) || 0))),
      statBox(tt("streakCap"), streakText),
      statBox(tt("savedDaysCap"), computed(() => String(savedDaysThisMonth.value)))
    ),
    div(
      css`flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400`,
      span(computed(() => `${periodSavedLabel.value}: ${fmt(savedThisPeriod.value)}`)),
      span({ class: () => (skipped.value ? "" : "hidden") }, skipped)
    )
  );
}

function accountRow(a, { onEdit, onDelete }) {
  const usage = computed(() => accountUsage.value[a.id] || 0);
  return div(
    css`card flex flex-wrap items-center gap-4`,
    div(
      css`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl`,
      { style: { backgroundColor: `${a.color}1f`, color: a.color } },
      AccountIcon(a, "h-5 w-5")
    ),
    div(
      css`min-w-40 flex-1`,
      div(css`flex flex-wrap items-center gap-2`,
        span(css`text-sm font-bold text-slate-900 dark:text-white`, a.name),
        span(
          {
            class: () => `rounded-full px-2 py-0.5 text-[11px] font-bold ${
              a.kind === "deposit"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                : "bg-slate-500/10 text-slate-600 dark:text-slate-300"
            }`,
          },
          computed(() => kindLabel(a.kind))
        )
      ),
      div(css`mt-0.5 text-xs text-slate-500 dark:text-slate-400`,
        computed(() => `${t("usedBy", { n: usage.value })} · ${t("openingBalance")} ${fmt(a.opening)}`))
    ),
    div(
      css`ml-auto text-right`,
      div(css`text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500`, tt("balance")),
      div({ class: () => `text-sm font-bold tabular-nums ${a.balance < 0 ? "text-red-500" : "text-slate-900 dark:text-white"}` },
        computed(() => fmt(a.balance)))
    ),
    div(
      css`flex gap-2`,
      button({ class: "btn btn-ghost px-2 py-1", title: () => t("editAccount"), onclick: () => onEdit(a) }, Icon(UI.pencil, "h-4 w-4")),
      button({ class: "btn btn-ghost px-2 py-1 text-red-500 hover:text-red-600", title: () => t("deleteAccount"), onclick: () => onDelete(a) }, Icon(UI.trash, "h-4 w-4"))
    )
  );
}

export function Accounts() {
  const formOpen = stateOf(false);
  const editing = stateOf(null);

  const openAdd = () => {
    editing.value = null;
    formOpen.value = true;
  };
  const openEdit = a => {
    editing.value = a;
    formOpen.value = true;
  };
  const remove = a => {
    const fb = deleteFallback(a);
    if (!fb) {
      alert(t("deleteAccountBlocked"));
      return;
    }
    if (confirm(t("deleteAccountConfirm", { name: a.name, fallback: fb.name }))) {
      dispatcher.dispatch(Actions.ACC_DELETE, a.id);
    }
  };

  return div(
    css`space-y-6`,
    div(
      css`flex flex-wrap items-end justify-between gap-4`,
      div(
        p(css`text-2xl font-bold tracking-tight text-slate-900 dark:text-white`, tt("accounts")),
        p(css`mt-1 text-sm text-slate-500 dark:text-slate-400`,
          computed(() => t("accountCount", { n: accCount.value, total: fmt(netWorth.value) })))
      ),
      button({ class: "btn btn-primary", onclick: openAdd }, Icon(UI.plus, "h-4 w-4"), " ", tt("addAccount"))
    ),
    planCard(),
    AccountForm({ open: formOpen, editing, onClose: () => (formOpen.value = false) }),
    // Own container: loop() prepends rebuilt rows into its parent, which would
    // otherwise drop the page header below the list after any account edit.
    div(css`space-y-4`, loop(accountBalances, a => a.id, a => accountRow(a, { onEdit: openEdit, onDelete: remove })))
  );
}
