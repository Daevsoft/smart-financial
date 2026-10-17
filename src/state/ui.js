import { stateOf } from "@daevsoft/jetz";

// Off-canvas navigation drawer (mobile only; hidden at the lg breakpoint).
export const navOpen = stateOf(false);

// Overlays cover the page but the body still scrolls behind them, so every
// modal counts itself in here and the lock drops only when all are closed.
let locks = 0;

export function scrollLock(on) {
  locks = Math.max(0, locks + (on ? 1 : -1));
  document.body.style.overflow = locks ? "hidden" : "";
}
