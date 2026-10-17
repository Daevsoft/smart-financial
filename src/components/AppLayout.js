import { div } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { MobileTopBar, NavBackdrop, Sidebar } from "./Sidebar.js";
import { DemoNotice } from "./DemoNotice.js";

export function AppLayout(content) {
  return div(
    css`flex min-h-dvh`,
    Sidebar,
    NavBackdrop,
    // Passed by reference, not called, so its effects get their own lifecycle.
    DemoNotice,
    div(
      css`min-w-0 flex-1`,
      MobileTopBar,
      div(css`mx-auto w-full max-w-7xl px-4 pb-10 pt-5 sm:px-8 sm:py-8`, content)
    )
  );
}
