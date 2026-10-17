import { stateOf, computed, onMount } from "@daevsoft/jetz";
import { div, p, button, label, input, select, option } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { prefs, dispatcher, Actions, transactions, categories } from "../state/store.js";
import { CURRENCY_CODES, setPrefs } from "../state/preferences.js";
import { txCount, catCount, todayISO } from "../state/transactions.js";
import { exportSnapshot, importSnapshot, downloadFile } from "../services/storage.js";
import { ledgerToCSV } from "../services/exportLedger.js";
import { LANGUAGES, t, tt } from "../state/i18n.js";
import { Icon, UI } from "../components/icons.js";

function sectionCard(title, description, ...children) {
  return div(
    css`card space-y-4`,
    div(
      div(css`text-sm font-bold text-slate-900 dark:text-white`, title),
      div(css`mt-0.5 text-xs text-slate-500 dark:text-slate-400`, description)
    ),
    ...children
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
    sectionCard(
      tt("dataTitle"),
      computed(() => `${t("transactionsCount", { n: txCount.value })} · ${catCount.value} ${t("categories")} · ${t("snapshotV1")}`),
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
