import { effect } from "@daevsoft/jetz";
import { prefs, dispatcher, Actions } from "./store.js";

const LOCALES = {
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  IDR: "id-ID",
  JPY: "ja-JP",
};

export const CURRENCY_CODES = Object.keys(LOCALES);

// Theme is applied globally; the inline script in index.html pre-applies the
// saved class before first paint to avoid a flash.
effect(() => {
  document.documentElement.classList.toggle("dark", prefs.theme.value === "dark");
});

// Call inside computeds / attribute callbacks so currency changes re-render.
export function fmt(amount) {
  const currency = prefs.currency.value;
  return new Intl.NumberFormat(LOCALES[currency] || "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

export const setPrefs = patch => dispatcher.dispatch(Actions.PREFS_SET, patch);
