import { stateOf, computed, effect, onDestroy, onMount } from "@daevsoft/jetz";
import { div, p, button, label, span, input, inputNumber, select, option, a } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { prefs, dispatcher, Actions, transactions, categories, accounts, savings } from "../state/store.js";
import { CURRENCY_CODES, setPrefs } from "../state/preferences.js";
import { txCount, catCount, todayISO } from "../state/transactions.js";
import { setPlan, planStartDay } from "../state/accounts.js";
import { scrollLock } from "../state/ui.js";
import { exportSnapshot, importSnapshot, downloadFile } from "../services/storage.js";
import { ledgerToCSV } from "../services/exportLedger.js";
import { notificationsSupported, notificationPermission, requestNotificationPermission } from "../services/notify.js";
import { LANGUAGES, t, tt } from "../state/i18n.js";
import { Icon, UI } from "../components/icons.js";

function cardHead(title, description, right) {
  return div(
    css`flex items-start justify-between gap-4`,
    div(
      div(css`text-sm font-bold text-slate-900 dark:text-white`, title),
      div(css`mt-0.5 text-xs text-slate-500 dark:text-slate-400`, description)
    ),
    right || []
  );
}

function sectionCard(title, description, ...children) {
  return div(css`card space-y-4`, cardHead(title, description), ...children);
}

function switchCard(title, description, right, ...children) {
  return div(css`card space-y-4`, cardHead(title, description, right), ...children);
}

// `on` and `labelKey` are read through callbacks so the switch and its caption
// restyle themselves when the plan changes, rather than keeping the class and
// text they were built with.
function Switch(on, onclick, labelKey) {
  return button(
    {
      role: "switch",
      "aria-checked": () => String(on()),
      "aria-label": () => t(labelKey),
      // The pseudo-element widens the hit area to roughly a button's without
      // changing the 24px visual height of the track.
      class: () =>
        `relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 before:absolute before:-inset-2 before:content-[''] ${on() ? "bg-brand-500" : "bg-slate-300 dark:bg-slate-600"}`,
      onclick,
    },
    div({
      class: () =>
        `h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${on() ? "translate-x-5" : "translate-x-0"}`,
    })
  );
}

// Account pickers here are built once per page mount: accounts only change on
// the #/accounts page, so this component always remounts with them.
function accountSelect(kind, onchange) {
  const list = accounts.values.filter(kind);
  const sel = select(
    { class: "input w-full sm:w-56", onchange: e => onchange(e.target.value) },
    list.length ? list.map(a => option({ value: a.id }, a.name)) : [option({ value: "" }, "—")]
  );
  return { sel, empty: !list.length };
}

// The browser owns this permission and cannot revoke it from the page, so the
// three states hide each other instead of swapping children. The row only
// exists where notifications work at all — iOS, for one, needs an installed
// PWA before `Notification` is available.
function notificationRow() {
  if (!notificationsSupported()) return [];
  const permission = stateOf(notificationPermission());
  const only = state => () => (permission.value === state ? "" : "hidden");
  const ask = async () => {
    permission.value = await requestNotificationPermission();
  };

  return div(
    css`flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800`,
    div(
      css`min-w-0`,
      div(css`text-sm font-semibold text-slate-900 dark:text-white`, tt("notifTitle")),
      div(css`mt-0.5 text-xs text-slate-500 dark:text-slate-400`, tt("notifDesc"))
    ),
    button(
      { class: () => `btn btn-ghost ring-1 ring-slate-300 dark:ring-slate-700 ${only("default")()}`, onclick: ask },
      Icon(UI.bell, "h-4 w-4"), " ", tt("notifEnable")
    ),
    span({ class: () => `badge bg-brand-500/10 text-brand-700 dark:text-brand-300 ${only("granted")()}` },
      Icon(UI.check, "h-3.5 w-3.5"), " ", tt("notifOn")),
    span({ class: () => `text-xs font-medium text-amber-600 dark:text-amber-400 ${only("denied")()}` },
      tt("notifBlocked"))
  );
}

// The monthly start day is a day-of-month, never an amount, so it is tapped out
// on a 1–31 grid instead of typed.
function startDayPicker() {
  const open = stateOf(false);
  const show = () => open.value;
  const pick = d => {
    setPlan({ startDay: d });
    open.value = false;
  };
  // The selected class reads planStartDay() through the callback, so choosing a
  // new day restyles every cell.
  const cell = d =>
    button(
      {
        class: () =>
          `h-10 cursor-pointer rounded-xl text-sm font-semibold tabular-nums transition-colors ${
            planStartDay() === d
              ? "bg-brand-500 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          }`,
        onclick: () => pick(d),
      },
      String(d)
    );

  const onKey = e => {
    if (e.key === "Escape") open.value = false;
  };
  let locked = false;
  effect(() => {
    if (open.value === locked) return;
    locked = open.value;
    scrollLock(locked);
    if (locked) document.addEventListener("keydown", onKey);
    else document.removeEventListener("keydown", onKey);
  });
  onDestroy(() => {
    scrollLock(false);
    document.removeEventListener("keydown", onKey);
  });

  const days = Array.from({ length: 31 }, (_, i) => cell(i + 1));

  return div(
    div(
      label(css`label`, tt("planStartDay")),
      button(
        { class: "input flex w-40 cursor-pointer items-center gap-2 text-left", onclick: () => (open.value = true) },
        Icon(UI.calendar, "h-4 w-4"),
        span(computed(() => String(planStartDay())))
      )
    ),
    div(
      { class: () => `fixed inset-0 z-50 flex items-end justify-center transition-all duration-200 sm:items-center sm:p-4 ${show() ? "visible" : "invisible pointer-events-none"}` },
      div({ class: () => `absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200 ${show() ? "opacity-100" : "opacity-0"}`, onclick: () => (open.value = false) }),
      div(
        {
          class: () => `card sheet relative w-full space-y-4 rounded-b-none p-5 transition-all duration-200 sm:max-w-sm sm:rounded-2xl ${show() ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0 sm:translate-y-3 sm:scale-95"}`,
          role: "dialog",
          "aria-modal": "true",
        },
        div(css`text-base font-bold text-slate-900 dark:text-white`, tt("planStartDayPick")),
        div(css`grid grid-cols-7 gap-1.5`, ...days),
        div(css`text-xs leading-relaxed text-slate-500 dark:text-slate-400`, tt("planStartDayNote")),
        button({ class: "btn btn-ghost w-full ring-1 ring-slate-300 dark:ring-slate-700", onclick: () => (open.value = false) }, tt("cancel"))
      )
    )
  );
}

function planSection() {
  // `active` is read through a callback so the button restyles itself when the
  // plan changes instead of keeping the class it was built with.
  const toggle = (key, active, onclick) =>
    button({ class: () => `btn ${active() ? "btn-primary" : "btn-ghost"}`, onclick }, tt(key));

  const deposit = accountSelect(a => a.kind === "deposit", id => id && setPlan({ depositAccountId: id }));
  const source = accountSelect(a => a.kind !== "deposit", id => id && setPlan({ sourceAccountId: id }));

  const targetInput = inputNumber({
    class: "input w-40",
    min: "0",
    step: "1000",
    onchange: e => setPlan({ target: Math.max(0, Math.round(Number(e.target.value) || 0)) }),
  });

  const sync = () => {
    if (targetInput.o) targetInput.o.value = String(savings.target.value || 0);
    if (deposit.sel.o) deposit.sel.o.value = savings.depositAccountId.value;
    if (source.sel.o) source.sel.o.value = savings.sourceAccountId.value;
  };
  // Account deletions re-point the plan, and the sheet may set it; mirror both
  // back into the controls after first render.
  savings.target.subscribe(sync);
  savings.depositAccountId.subscribe(sync);
  savings.sourceAccountId.subscribe(sync);
  onMount(sync);

  return switchCard(
    tt("planTitle"),
    tt("planDesc"),
    div(
      css`flex shrink-0 items-center gap-2`,
      // The caption is dropped below the `sm` breakpoint so the card title keeps
      // a single line — the switch alone reads clearly on a phone.
      span(css`hidden text-xs font-medium text-slate-500 dark:text-slate-400 sm:inline`,
        computed(() => t(savings.enabled.value ? "planEnabled" : "planDisabled"))),
      Switch(() => savings.enabled.value, () => setPlan({ enabled: !savings.enabled.value }), "planTitle")
    ),
    div(
      { style: { display: () => (savings.enabled.value ? "block" : "none") } },
      div(css`space-y-4 pt-1`,
        div(
          css`flex flex-wrap gap-2`,
          toggle("scheduleDaily", () => savings.schedule.value === "daily", () => setPlan({ schedule: "daily" })),
          toggle("scheduleMonthly", () => savings.schedule.value === "monthly", () => setPlan({ schedule: "monthly" }))
        ),
        // A start day only means something for a monthly plan, and Jetz element
        // children cannot be null, so its cell hides instead of leaving the row.
        div(
          css`grid gap-3 sm:grid-cols-2`,
          div(label(css`label`, tt("planTarget")), targetInput),
          div(
            { style: { display: () => (savings.schedule.value === "monthly" ? "block" : "none") } },
            startDayPicker()
          )
        ),
        div(
          css`grid gap-3 sm:grid-cols-2`,
          div(label(css`label`, tt("depositAccount")), deposit.sel),
          div(label(css`label`, tt("sourceAccountPlan")), source.sel)
        ),
        // Jetz element children cannot be null, so the warning is hidden
        // instead of left out.
        div({ class: () => `text-xs font-medium ${deposit.empty ? "text-amber-600 dark:text-amber-400" : "hidden"}` },
          tt("planNoDeposit")),
        notificationRow(),
        div(
          css`text-xs text-slate-500 dark:text-slate-400`,
          a({ href: "#/accounts", class: "font-semibold text-brand-600 hover:underline dark:text-brand-400" }, tt("accounts")),
          " · ",
          tt("transferNote")
        )
      )
    )
  );
}

export function Settings() {
  const status = stateOf("");

  const doExport = () => {
    downloadFile(`fintrack-export-${todayISO()}.json`, exportSnapshot(transactions.values, categories.values, prefs.toObject()), "application/json");
    status.value = t("statusExported");
  };

  const doExportCsv = () => {
    const list = transactions.values;
    downloadFile(`fintrack-ledger-${todayISO()}.csv`, ledgerToCSV(list), "text/csv");
    status.value = t("csvExported", { n: list.length });
  };

  const onFile = async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const snap = importSnapshot(await file.text());
      dispatcher.dispatch(Actions.DATA_IMPORT, snap);
      status.value = t("statusImported", { n: snap.transactions.length, m: snap.categories.length });
    } catch (err) {
      status.value = t("importFailed", { msg: err.message });
    }
  };

  const fileInput = input({ type: "file", accept: "application/json", class: "hidden", onchange: onFile });

  const currencySelect = select(
    { class: "input w-40", onchange: e => setPrefs({ currency: e.target.value }) },
    CURRENCY_CODES.map(code => option({ value: code }, code))
  );
  const syncCurrency = () => {
    if (currencySelect.o) currencySelect.o.value = prefs.currency.value;
  };
  prefs.currency.subscribe(syncCurrency);
  // Subscriptions fire only on change, so the saved value must be re-applied
  // once the select is actually in the DOM (every page remount).
  onMount(syncCurrency);

  const languageSelect = select(
    { class: "input w-40", onchange: e => setPrefs({ language: e.target.value }) },
    Object.entries(LANGUAGES).map(([code, name]) => option({ value: code }, name))
  );
  const syncLanguage = () => {
    if (languageSelect.o) languageSelect.o.value = prefs.language.value;
  };
  prefs.language.subscribe(syncLanguage);
  onMount(syncLanguage);

  return div(
    css`mx-auto max-w-3xl space-y-6`,
    div(
      p(css`text-2xl font-bold tracking-tight text-slate-900 dark:text-white`, tt("settings")),
      p(css`mt-1 text-sm text-slate-500 dark:text-slate-400`, tt("settingsSub"))
    ),
    sectionCard(
      tt("appearance"),
      tt("themeDesc"),
      div(
        css`flex items-center gap-2`,
        button({ class: () => `btn ${prefs.theme.value === "light" ? "btn-primary" : "btn-ghost"}`, onclick: () => setPrefs({ theme: "light" }) }, Icon(UI.sun, "h-4 w-4"), " ", tt("light")),
        button({ class: () => `btn ${prefs.theme.value === "dark" ? "btn-primary" : "btn-ghost"}`, onclick: () => setPrefs({ theme: "dark" }) }, Icon(UI.moon, "h-4 w-4"), " ", tt("dark"))
      ),
      div(
        label(css`label`, tt("currency")),
        currencySelect
      ),
      div(
        label(css`label`, tt("language")),
        languageSelect
      )
    ),
    planSection(),
    sectionCard(
      tt("dataTitle"),
      computed(() => `${t("transactionsCount", { n: txCount.value })} · ${catCount.value} ${t("categories")} · ${t("snapshotVersion")}`),
      div(
        css`flex flex-wrap gap-2`,
        button({ class: "btn btn-primary", onclick: doExport }, Icon(UI.download, "h-4 w-4"), " ", tt("exportJson")),
        button({ class: "btn btn-ghost ring-1 ring-slate-300 dark:ring-slate-700", onclick: doExportCsv }, Icon(UI.sheet, "h-4 w-4"), " ", tt("exportCsvAll")),
        button({ class: "btn btn-ghost ring-1 ring-slate-300 dark:ring-slate-700", onclick: () => fileInput.o.click() }, Icon(UI.upload, "h-4 w-4"), " ", tt("importJson")),
        fileInput
      ),
      div(
        css`flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800`,
        button({
          class: "btn btn-ghost",
          onclick: () => {
            if (confirm(t("demoConfirm"))) {
              dispatcher.dispatch(Actions.DATA_DEMO);
              status.value = t("statusDemo");
            }
          },
        }, Icon(UI.dices, "h-4 w-4"), " ", tt("loadDemo")),
        button({
          class: "btn btn-danger",
          onclick: () => {
            if (confirm(t("clearConfirm"))) {
              dispatcher.dispatch(Actions.DATA_CLEAR);
              status.value = t("statusCleared");
            }
          },
        }, Icon(UI.trash, "h-4 w-4"), " ", tt("clearAll"))
      ),
      div(
        { class: () => `${status.value ? "animate-fade-in-up" : "hidden"}` },
        div(css`rounded-xl bg-brand-500/10 px-3 py-2 text-sm font-medium text-brand-700 dark:text-brand-300`, status)
      )
    ),
    sectionCard(tt("about"), tt("aboutBody"))
  );
}
