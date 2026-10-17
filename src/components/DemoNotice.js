import { computed, effect, onDestroy } from "@daevsoft/jetz";
import { div, span, button } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { dispatcher, Actions, prefs, transactions } from "../state/store.js";
import { t, tt } from "../state/i18n.js";
import { scrollLock } from "../state/ui.js";
import { Icon, UI } from "./icons.js";

const TONE_FRESH =
  "border-brand-500/40 bg-brand-500/10 text-brand-700 hover:bg-brand-500/15 dark:text-brand-400";
const TONE_KEEP =
  "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200";

// One-time confirmation sheet: boot() seeds a demo dataset so the charts have
// something to show, and this asks the new visitor whether to keep it.
export function DemoNotice() {
  // `.values` reads on a ListState are untracked, so the seeded count is
  // snapshotted here — the sheet only ever exists on the first load.
  const seededCount = transactions.values.length;
  const show = computed(() => prefs.demoAsk.value);

  const answer = keep => {
    if (!keep) dispatcher.dispatch(Actions.DATA_CLEAR);
    dispatcher.dispatch(Actions.PREFS_SET, { demoAsk: false });
  };
  const onKey = e => {
    if (e.key === "Escape") answer(true);
  };

  const choice = (label, note, tone, onclick) =>
    button(
      { class: `w-full rounded-xl border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/40 ${tone}`, onclick },
      div(
        css`flex items-center gap-2`,
        span(css`text-sm font-bold`, label),
        span(css`ml-auto opacity-60`, Icon(UI.chevron, "h-4 w-4"))
      ),
      div(css`mt-1 text-xs leading-relaxed opacity-80`, note)
    );

  // Locks are counted globally, so only report a real transition.
  let locked = false;
  const setLock = on => {
    if (on === locked) return;
    locked = on;
    scrollLock(on);
  };
  const fresh = choice(tt("demoStartFresh"), computed(() => t("demoFreshNote", { n: seededCount })), TONE_FRESH, () => answer(false));

  effect(() => {
    const open = show.value;
    setLock(open);
    if (open) {
      document.addEventListener("keydown", onKey);
      requestAnimationFrame(() => fresh.o && fresh.o.focus());
    } else {
      document.removeEventListener("keydown", onKey);
    }
  });
  onDestroy(() => {
    document.removeEventListener("keydown", onKey);
    setLock(false);
  });

  return div(
    { class: () => `fixed inset-0 z-50 flex items-end justify-center transition-all duration-200 sm:items-center sm:p-4 ${show.value ? "visible" : "invisible pointer-events-none"}` },
    // Backdrop stays inert: the question wants an explicit answer (Escape keeps the data).
    div({ class: () => `absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200 ${show.value ? "opacity-100" : "opacity-0"}` }),
    div(
      {
        class: () => `card sheet relative max-h-[92dvh] w-full space-y-4 overflow-y-auto rounded-b-none p-5 transition-all duration-200 sm:max-w-lg sm:rounded-2xl ${show.value ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0 sm:translate-y-3 sm:scale-95"}`,
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "demo-notice-title",
      },
      div(
        css`flex items-start gap-3`,
        div(css`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400`, Icon(UI.alert, "h-5 w-5")),
        div(
          css`min-w-0`,
          div({ id: "demo-notice-title" }, css`text-base font-bold text-slate-900 dark:text-white`, tt("demoNoticeTitle")),
          div(css`mt-0.5 text-xs text-slate-400 dark:text-slate-500`,
            computed(() => t("transactionsCount", { n: seededCount })))
        )
      ),
      div(css`text-sm leading-relaxed text-slate-600 dark:text-slate-300`,
        computed(() => t("demoNoticeBody", { n: seededCount }))),
      div(css`text-sm font-semibold text-slate-900 dark:text-white`, tt("demoNoticeAsk")),
      div(
        css`space-y-2`,
        fresh,
        choice(tt("demoKeep"), tt("demoKeepNote"), TONE_KEEP, () => answer(true))
      ),
      div(css`text-center text-xs text-slate-400 dark:text-slate-500`, tt("demoLaterNote"))
    )
  );
}
