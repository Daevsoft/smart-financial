# Jetz: Application Features

Routing, navigation guards, session state, dispatcher, and utilities for complete SPAs. Imports: `@daevsoft/jetz`, `@daevsoft/jetz/ui`, `@daevsoft/jetz/router`, `@daevsoft/jetz/middleware`, `@daevsoft/jetz/session`.

## Router & Link Navigation

```javascript
import { Jetz } from "@daevsoft/jetz";
import { Router, route, link, asLink, asBackLink, redirect } from "@daevsoft/jetz/router";
import { div, nav, main } from "@daevsoft/jetz/ui";

const HomeView = () => div("Welcome Home");
const AboutView = () => div("About Us");

const appRouter = new Router(
  route("/", HomeView),
  route("/about", AboutView)
);

Jetz.use(appRouter);

function AppShell() {
  return main(
    nav(
      link("/", div("Home")),
      link("/about", div("About"))
    ),
    Jetz.$route.browser() // router viewport
  );
}

Jetz.mount(AppShell(), document.body);
```

### Route SEO metadata

Attach a `head` callback to update document title/meta on activation. Return one head element or an array; Jetz removes previously managed route elements while preserving unrelated `<head>` tags:

```javascript
import { route } from "@daevsoft/jetz/router";
import { title, meta } from "@daevsoft/jetz/ui";

const appRouter = new Router(
  route("/", HomeView),
  route("/about", {
    component: AboutView,
    head: () => [
      title("About Jetz"),
      meta({ name: "description", content: "Learn about the Jetz framework." })
    ]
  })
);
```

Client-side updates alone cannot add tags to the initial server response; use SSR/prerendering when crawlers need metadata in the initial HTML.

### Dynamic route parameters

Use `:name` for a dynamic segment. Values are URL-decoded and passed to the component, middleware, and `head`. Static paths take precedence over dynamic matches:

```javascript
const router = new Router(
  route("/order/:orderId/message", {
    component: ({ orderId }) => div(`Messages for order ${orderId}`),
    head: ({ orderId }) => title(`Messages for order ${orderId}`)
  })
);

router.to("/order/A%2012/message"); // orderId is "A 12"
```

### Nested route groups

`group()` shares a path prefix and middleware across nested routes; `route()` defines endpoints. Parent middleware runs first:

```javascript
import { Router, group, route } from "@daevsoft/jetz/router";

const routes = [
  route("/", Home),
  group("/admin", {
    middlewares: AuthGuard,
    routes: [
      route("/", Dashboard),
      group("/users", {
        middlewares: [AdminGuard, RoleGuard],
        routes: [
          route("/", UserList),
          route("/:id", UserDetail)
        ]
      })
    ]
  })
];

const router = new Router(routes);
Jetz.use(router);
```

Resolves to `/admin`, `/admin/users`, `/admin/users/:id`; user detail runs `AuthGuard`, then `AdminGuard`, then `RoleGuard`.

### Hash routing

Hash routing (`#/product`) works without opt-in: a route-shaped fragment always wins over the pathname, so static hosts without server rewrites stay navigable.

```javascript
router.to("#/product"); // URL becomes /#/product, pathname stays /
```

Loading `index.html#/product` (or `#/product/42` for dynamic segments) boots straight into that route; hash back/forward works through the same `hashchange` listener; `router.to()` keeps whichever addressing the navigation used. Plain in-page anchors (`#section`) are never routes — they fall through to the pathname route.

### Link helpers

- `asLink("/path", params)`: event modifier navigating to a route on click.
- `asBackLink`: triggers `history.back()` on click.
- `redirect("https://example.com")`: programmatic full-page navigation.

## Route Middlewares

Guards extend `Middleware` and implement `next(params, _continue)`. Return `true` to allow or `this.deny("reason")` to stop navigation; arrays run in order until the first denial:

```javascript
import { route } from "@daevsoft/jetz/router";
import { Middleware, middleware } from "@daevsoft/jetz/middleware";

class AuthGuard extends Middleware {
  next(params, _continue) {
    if (!Boolean(localStorage.getItem("token"))) {
      return this.deny("User is not authenticated");
    }
    return true;
  }
}

class AdminGuard extends Middleware {
  next(params, _continue) {
    const user = JSON.parse(sessionStorage.getItem("user") || "null");
    if (user?.role !== "admin") {
      return this.deny("Administrator access is required");
    }
    return true;
  }
}

const router = new Router(
  route("/", HomeView),
  // Every guard must return true for navigation to proceed:
  middleware([AuthGuard, AdminGuard],
    route("/admin", AdminView)
  ),
  // Multiple routes can share one middleware:
  middleware(AuthGuard,
    route("/dashboard", DashboardView),
    route("/settings", SettingsView)
  )
);
```

## Session Storage (`JetzSession`, `sessionOf`)

Reactive key-value store backed by `sessionStorage`:

```javascript
import { Jetz } from "@daevsoft/jetz";
import { JetzSession, sessionOf } from "@daevsoft/jetz/session";

// 1. Managed session
const session = new JetzSession({ user: null, theme: "dark" });
Jetz.use(session); // exposes Jetz.$session

session.theme = "light";                    // property mutations persist
session.set("user", { id: 1, name: "Alice" });
session.get("user");                        // { id: 1, name: "Alice" }
session.has("user");                        // true
session.destroy();                          // clear storage, reset defaults

// 2. Standalone reactive session proxy
const localSession = sessionOf({ activeFilter: "all" });
localSession.activeFilter = "completed";    // persisted
```

## Dispatcher Pattern

Flux-like unidirectional flow:

```javascript
import { stateOf, Dispatcher } from "@daevsoft/jetz";
import { main, nav, ul, li } from "@daevsoft/jetz/ui";

const currentPage = stateOf("home");

const dispatcher = new Dispatcher(action => {
  switch (action) {
    case "NAV_HOME":
      currentPage.setState("home");
      break;
    case "NAV_ABOUT":
      currentPage.setState("about");
      break;
  }
});

const App = main(
  nav(
    ul(
      li("Home", { onclick: () => dispatcher.dispatch("NAV_HOME") }),
      li("About", { onclick: () => dispatcher.dispatch("NAV_ABOUT") })
    )
  ),
  currentPage
);
```

## Script & Raw HTML Injection

```javascript
import { addScript, html } from "@daevsoft/jetz";
import { div } from "@daevsoft/jetz/ui";

// Dynamically load an external script with callback
addScript("https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js", {
  async: true,
  onload: () => console.log("Confetti library loaded!")
});

// Render raw HTML safely wrapped in a Raw element
const RawBox = div(html("<strong>Formatted HTML snippet</strong>"));
```

## Prototype Extensions & Array Helpers

```javascript
import { range, flatMap, createList } from "@daevsoft/jetz";

range(1, 4);                     // [1, 2, 3, 4]
flatMap([1, [2, [3]], 4]);       // [1, 2, 3, 4]
createList(3, i => `Item ${i}`); // ['Item 0', 'Item 1', 'Item 2']

// Extended prototypes:
[10, 20, 30].last();             // 30
[10, 20, 30].take(2);            // [10, 20]
(3).range(6);                    // [3, 4, 5, 6]
document.querySelectorAll("li").last(); // last matched DOM node
```
