---
name: jetz
description: Build reactive web interfaces with the Jetz framework (@daevsoft/jetz) — composable JavaScript UI functions (no JSX), stateOf/computed/effect reactivity, keyed loop reconciliation, routing, and session state. Use when writing or modifying Jetz elements, components, reactive state, lists, routers, middleware, or sessions in any project that imports @daevsoft/jetz.
---

# Jetz Framework Guide

## Overview

Jetz is a composable JavaScript framework for reactive UIs, inspired by Jetpack Compose. UI is described by calling element functions (`div`, `button`, `p`); reactive state updates the DOM directly with fine-grained bindings — no JSX, no template language, no virtual DOM. All of it is plain, executable JavaScript.

## Imports

```javascript
import { Jetz, stateOf, computed, effect, listOf, loop } from "@daevsoft/jetz";
import { div, p, button, css, style } from "@daevsoft/jetz/ui";
import { Router, route, link } from "@daevsoft/jetz/router";
import { Middleware, middleware } from "@daevsoft/jetz/middleware";
import { JetzSession, sessionOf } from "@daevsoft/jetz/session";
```

Subpath exports: `@daevsoft/jetz` (core reactivity), `/ui` (element factories, `css`, `style`, `find`), `/router`, `/middleware`, `/session`.

## Mental model

```javascript
import { Jetz, stateOf } from "@daevsoft/jetz";
import { button, div, p } from "@daevsoft/jetz/ui";

const count = stateOf(0);

const App = () => div(
  p("Count: ", count),                       // state as child = bound text node
  button({ onclick() { count.value++; } }, "Increment")
);

Jetz.mount(App, "#app");
```

1. Create reactive state (`stateOf`, `listOf`).
2. Compose the UI tree with element functions.
3. React to state: pass states as children, bind inputs with `{ bind: state }`, or update state in event handlers.
4. Mount with `Jetz.mount(App, selector)`.

Element functions accept arguments in any order: strings/numbers become text children, elements become children, plain objects become attributes and event handlers (`{ id, onclick }`), `` css`...` ``/`` style`...` `` set classes/styles, states and callbacks bind reactive content.

## Critical rules

**Reactivity boundaries — bare values are read once.** A bare value or bare function child is evaluated once at render. Wrap mutable content in `computed()`, or read it inside attribute/class/style callbacks or tagged-template interpolations:

```javascript
td(emp.score);                        // immutable: rendered once, never updates
td(computed(() => emp.score));        // reactive text
td({ class: () => emp.dept });        // reactive attribute
```

**Tagged templates are reactive; untagged ones are not.** `` div`Count: ${() => count.value}` `` re-renders the interpolation. `div(`Count: ${() => count.value}`)` flattens the function to its source text — a silent bug. Use the tagged form or `text` for string building: `div(text`Count: ${() => count.value}`)`.

**Reactive `css` callbacks must read `.value`.** `` css`task ${() => task.done.value ? "done" : ""}` `` works; `` css`task ${task.done ? "done" : ""}` `` does not — the State object itself is truthy, so the ternary runs once with a constant result.

**Function components need a reference, not a call.** `div(UserCard)` lets Jetz invoke the component with its own lifecycle. `div(UserCard("Alice"))` is an ordinary immediate call with no lifecycle. To pass arguments, wrap: `div(() => Greeting({ name }))`. Never `div(Greeting(name.value))` if you need child lifecycle.

**State API.** Read/write `state.value` or use `state.setState(v)`. Wrap multi-state updates in `batch(fn)` (synchronous callback) so effects run once on completion. `computed(fn)` auto-tracks its reads and must return a primitive — derive lists through `list.set()`, not `computed()`. `effect(fn)` runs immediately, re-runs on tracked changes, and returns a `dispose()`.

**`stateOf(object)` has no `.value` of its own.** Its properties become individual States: read a whole snapshot with `state.toObject()`, write per property (`state.name.value = "x"`). `state.value` is `undefined` — a common cause of "Cannot read properties of undefined". To replace the whole object, set each property (or wrap in `batch`).

**Lists mutate through methods, never via `.values`.** `listOf(...)` / `sequenceOf(...)` return a `ListState`: `push`, `insertAt`, `remove`, `removeAt`, `replaceAt`, `updateAt`, `set`, `sort`, `clear`, `transform` update rendered views. `map`/`filter` return plain arrays without touching the list. Caution: `ListState` extends Array, so `.values`/`.size` reads inside `computed`/`effect` are NOT tracked — for derived collections (filtered/sorted views), keep a `stateOf` of source data or a refresh function writing into another `listOf`, not a computed over `list.values`.

**Remembered state has partial persistence.** `rememberOf(key, initial)` and `list.asRemember(key)` sync to `localStorage`, but for lists only `push`, `set`, `clear` persist — persist any other mutation with `set()`. Store JSON-serializable data only.

**Keyed reconciliation.** `loop(list, item => item.id, item => li(...))` recycles DOM per key. Each item render runs in a disposal scope: every `effect()`, `computed()`, subscription and listener created there is released automatically when the row leaves the DOM. The classic `loop(list, renderFn)` form still works.

**One `loop()` site per `ListState`.** Two `loop()` calls over the same list fight over its DOM: the second site receives nodes produced by the first renderer (e.g. `<tr>` inside a card container) and renders nothing useful. Render the list once and make the single row layout responsive instead.

**A `loop()` must be the only child of its parent element.** The reconciler inserts and moves rebuilt views with `parent.prepend(...)`, so on the first list update every non-loop sibling — a page heading, a table header row, a static `<option>`, an empty-state message — is pushed below the rows. Wrap the loop in its own container (`div(css\`space-y-4\`, loop(...))`) and put entries like an "All time" option inside the looped data.

**Same-key recycling freezes plain children.** A rebuilt list that keeps the key (derived month/category rows, localized labels) reuses the DOM node without re-running the render function, so plain string children and closed-over values (`const over = r.budget > 0`) stay stale. Make derived content either a `computed()` child, or fold the value into the key: `list(m => `${m.value}:${m.label}`, ...)`.

**Large tables use shallow rows.** `rowOf(obj)` (alias `shallowStateOf`) gives a record one version signal instead of one State per property; bump with `row.touch()` / `row.set(patch)`, read untracked with `rawOf(row)` in filter/sort pipelines, bulk-bump with `touchRow(row)`.

**`bind:` targets must be states.** `{ bind: query }` two-way-binds an input; the target must come from `stateOf()`, `computed()` or `rememberOf()` — otherwise Jetz throws a descriptive `JetzBindingError`. Input factories are typed: `inputText` hard-codes `type="text"` — use `inputNumber` / `inputDate` (etc.) for other types; `{ type: "number" }` on `inputText` is silently ignored.

**`listen()` is global — prefer `state.subscribe(fn)`.** `listen(fn)` re-runs on EVERY state change anywhere; if the callback writes states it loops infinitely ("Maximum call stack size exceeded"). Use `state.subscribe(fn)` for targeted reactions (e.g. syncing a select to a state, filling a form when a modal opens). Note the asymmetry: `State.subscribe(fn)` returns **nothing** — to unsubscribe, call `state.unsubscribe(fn)` with the handler reference. Only `Dispatcher.subscribe()` returns an unsubscribe function.

**Subscriber order between `effect()` and `state.subscribe()` is not stable.** Each `effect` re-run re-tracks and re-subscribes its dependencies, moving it to the END of that State's subscriber list — so a component subscribed earlier can fire before the effect that rebuilds the data it reads ("one update behind" after the first change). Never let correctness depend on subscription order across modules: route multi-step updates through the `Dispatcher` and use `waitFor("otherStore")` in later handlers to force ordering.

**Raw DOM (`el.o`) exists only after render.** Guards like `if (select.o) select.o.value = ...` are required in `subscribe` callbacks that run before first render; re-check after `bind:` wires the element. The initial `sync()` call in the `state.subscribe(sync); sync();` pattern always runs pre-mount and is a no-op — put it in `onMount(sync)` instead, or restored values (selects bound to persisted state) snap back to the first option on every page remount.

**Conditionals render without wrapper elements.** Chain `_if(fn)`, `_elseif(fn)`, `_else` as siblings in one parent, or use `ifElse(condFn, trueFn, falseFn)` inline.

**Lifecycle hooks are imported functions** (`onCreate`, `onMount`, `onUpdate`, `onDestroy`) used inside function components; class components overriding `Component` use the same-named methods plus `render()`. Always clean up timers/subscriptions in `onDestroy`.

**Routing.** `new Router(route("/", Home), route("/user/:id", User))`, install with `Jetz.use(router)`, render the viewport with `Jetz.$route.browser()`. Hash URLs (`#/path`) work without opt-in. Guards extend `Middleware`, implement `next(params, _continue)`, and return `true` or `this.deny("reason")`.

## Minimal setup (Rspack)

```bash
pnpm add @daevsoft/jetz && pnpm add -D @rspack/core @rspack/cli
```

`rspack.config.js`:

```javascript
import { rspack } from "@rspack/core";

export default {
  entry: "./index.js",
  plugins: [new rspack.HtmlRspackPlugin({ template: "./index.html" })],
  devServer: { hot: false },
};
```

`index.js`:

```javascript
import { Jetz } from "@daevsoft/jetz";
import { Router, route } from "@daevsoft/jetz/router";
import { Home } from "./src/home.js";
import { App } from "./src/app.js";

const router = new Router([route("/", Home)]);
Jetz.use(router);
Jetz.mount(App, "#app");
```

`src/app.js` renders the router viewport: `main(Jetz.$route.browser())`. `index.html` needs a `<div id="app"></div>`. Run with `rspack serve`.

## Resources

Load on demand — do not read all at once:

- `references/core-concepts.md` — element composition, tagged templates, `css`/`style` helpers, components, state/computed/effect/batch, `rememberOf`, ListState API, `loop`, conditionals, lifecycle, `bind`, `listen`, DOM utilities.
- `references/scaling.md` — `rowOf`/`shallowStateOf`, which forms re-read on a row bump, `rawOf` untracked pipelines, automatic and manual cleanup (`disposeBindings`).
- `references/application.md` — router (params, groups, hash routing, SEO head), middleware guards, session storage, dispatcher, script/HTML injection, array helpers.
- `references/api-reference.md` — one-line API quick reference.
