import { computed, effect } from "@daevsoft/jetz";
import { div, aside, nav, a, span, p, button } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { activeRoute } from "../state/store.js";
import { navOpen } from "../state/ui.js";
import { t, tt } from "../state/i18n.js";
import { Icon, UI } from "./icons.js";

const ITEMS = [
  { path: "/", key: "dashboard", icon: UI.dashboard },
  { path: "/transactions", key: "transactions", icon: UI.transactions },
  { path: "/budgets", key: "budgets", icon: UI.budgets },
  { path: "/categories", key: "categoriesPage", icon: UI.tags },
  { path: "/settings", key: "settings", icon: UI.settings },
];

const brand = size =>
  div(
    css`flex items-center gap-2.5`,
    div(
      css`flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm`,
      Icon(UI.wallet, size)
    ),
    span(css`text-lg font-bold tracking-tight text-slate-900 dark:text-white`, "FinTrack")
  );

// Navigating away always collapses the drawer.
effect(() => {
  activeRoute.value;
  navOpen.value = false;
});

const routeTitle = computed(
  () => t(ITEMS.find(i => i.path === activeRoute.value)?.key || "dashboard")
);

export function MobileTopBar() {
  return div(
    css`sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90`,
    button(
      { class: "btn btn-ghost px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40", "aria-label": () => t("menu"), onclick: () => (navOpen.value = true) },
      Icon(UI.menu, "h-5 w-5")
    ),
    brand("h-5 w-5"),
    span(css`card-title ml-auto`, routeTitle)
  );
}

export function NavBackdrop() {
  return div({
    class: () => `fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${navOpen.value ? "opacity-100" : "pointer-events-none opacity-0"}`,
    onclick: () => (navOpen.value = false),
  });
}

export function Sidebar() {
  return aside(
    {
      class: () =>
        `fixed inset-y-0 left-0 z-50 flex w-72 max-w-[82vw] shrink-0 flex-col gap-6 overflow-y-auto border-r border-slate-200/70 bg-white px-4 py-6 transition-transform duration-300 dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-60 lg:max-w-none lg:translate-x-0 lg:overflow-hidden ${
          navOpen.value ? "translate-x-0" : "-translate-x-full"
        }`,
    },
    div(
      css`flex items-center justify-between gap-2 px-2`,
      brand("h-5 w-5"),
      button(
        { class: "btn btn-ghost px-2 py-2 lg:hidden", "aria-label": () => t("close"), onclick: () => (navOpen.value = false) },
        Icon(UI.close, "h-5 w-5")
      )
    ),
    nav(
      css`flex flex-col gap-1`,
      ITEMS.map(item =>
        a({ href: `#${item.path}`, class: () => `nav-link ${activeRoute.value === item.path ? "nav-link-active" : ""}` },
          Icon(item.icon, "h-[18px] w-[18px]"),
          span(tt(item.key))
        )
      )
    ),
    div(
      css`mt-auto rounded-2xl bg-brand-50 p-4 dark:bg-brand-500/10`,
      p(css`text-xs font-bold text-brand-800 dark:text-brand-300`, tt("offlineTitle")),
      p(css`mt-1 text-xs leading-relaxed text-brand-700/80 dark:text-brand-400/80`,
        tt("offlineBody"))
    )
  );
}
