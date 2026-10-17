import { div, p } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { Icon, UI } from "./icons.js";

const TONES = {
  brand: "bg-brand-500/10 text-brand-600 dark:text-brand-400",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  red: "bg-red-500/10 text-red-500 dark:text-red-400",
  blue: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

// `value`, `sub` and `delta` accept plain strings or reactive States — states
// stay live so callers can pass computed() results directly. `icon` is a raw
// SVG string from components/icons.js.
export function StatCard({ label, value, icon = UI.card, tone = "brand", sub = null }) {
  return div(
    css`card flex flex-col gap-3`,
    div(
      css`flex items-start justify-between`,
      div(css`flex h-10 w-10 items-center justify-center rounded-xl ${TONES[tone] || TONES.brand}`, Icon(icon, "h-5 w-5")),
      sub ? div(css`max-w-[55%] text-right text-xs font-medium text-slate-400 dark:text-slate-500`, sub) : null
    ),
    p(css`card-title`, label),
    div(css`text-2xl font-bold tracking-tight text-slate-900 dark:text-white`, value)
  );
}
