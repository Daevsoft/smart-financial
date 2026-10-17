# Jetz API Quick Reference

## State & Reactivity

- `stateOf(initialValue)` — reactive single value; read/write `.value`, `setState(v)`, `subscribe(fn)`
- `rememberOf(key, initialValue)` — reactive value persisted in `localStorage`
- `computed(fn)` — auto-tracked derived state (return a primitive)
- `effect(fn)` — auto-tracked imperative effect; returns `dispose()`
- `batch(fn)` — coalesce multi-state updates; synchronous callback
- `listen(callback)` — reactive inline listener attached to an element (`parent` passed in)
- `shallowStateOf(object)` / `rowOf(object)` — row-level record with one shared version signal
- `rawOf(row)` — untracked read of a shallow row's plain data
- `touchRow(row)` — manually bump a shallow row's version

## Collections & Reconciliation

- `listOf(...items)` — reactive array (`push`, `set`, `insertAt`, `remove`, `removeAt`, `replaceAt`, `updateAt`, `transform`, `sort`, `filter`, `clear`, `asUnique`, `asRemember`, `size`, `values`, `first()`, `last()`)
- `sequenceOf(...items)` — reactive list keeping duplicate primitives distinct
- `loop(list, keyFn, renderFn)` — key-reconciled rendering; each item gets an automatic disposal scope
- `element.disposeBindings()` — release every reactive binding of an element and its subtree

## Conditional Rendering

- `_if(conditionFn)` / `_elseif(conditionFn)` / `_else` — multi-branch chain, no wrapper elements
- `ifElse(condFn, trueFn, falseFn)` — inline two-way conditional

## Components & Lifecycle

- `Component` — base class (`render()` plus lifecycle methods, instantiate with `new` or `.new()`)
- `onCreate(fn)` — before initial render
- `onMount(fn)` — after DOM attachment
- `onUpdate(fn)` — on bound state changes
- `onDestroy(fn)` — on DOM removal (clear timers/subscriptions here)

## UI (`@daevsoft/jetz/ui`)

- Element factories: `div`, `span`, `p`, `h1`–`h6`, `button`, `a`, `img`, `input`, `inputText`, `table`, `tbody`, `tr`, `td`, `ul`, `li`, `nav`, `main`, `title`, `meta`, ... (one function per HTML element)
- `css` — tagged template for classes; callback/State interpolations are reactive
- `style` — object, tagged template (css block), or reactive callback/State; per-property bindings
- `text` — tagged template building reactive text strings
- `aria_({ ... })`, `data_({ ... })`, `href(state)` — attribute helpers
- `find(selector)` / `findAll(selector)` — global DOM query helpers
- Element methods: `attr`, `addAttr`, `removeAttr`, `data`, `setStyle`, `getStyle`, `addClass`, `removeClass`, `toggleClass`, `replaceClass`, `text`, `disable`, `enable`, `focus`, `blur`, `empty`, `remove`, `disposeBindings`

## Routing (`@daevsoft/jetz/router`)

- `new Router(...routes)` + `Jetz.use(router)` + `Jetz.$route.browser()` viewport
- `route(path, component | { component, head })` — `:param` segments, static paths win
- `group(prefix, { middlewares, routes })` — nested route groups
- `link(path, child)`, `asLink(path, params)`, `asBackLink`, `redirect(url)`
- `router.to(path)` — programmatic navigation (`#/hash` targets supported without opt-in)

## Middleware (`@daevsoft/jetz/middleware`)

- `class Guard extends Middleware` with `next(params, _continue)` — return `true` or `this.deny("reason")`
- `middleware(guard | [guards], ...routes)` — attach guards; arrays run in order

## Session (`@daevsoft/jetz/session`)

- `new JetzSession(defaults)` + `Jetz.use(session)` — `session.key = v`, `set`, `get`, `has`, `destroy`; exposes `Jetz.$session`
- `sessionOf(defaults)` — standalone reactive session proxy

## Application & Utilities (`@daevsoft/jetz`)

- `Jetz.mount(App, container)` — mount application to DOM
- `Jetz.unmount(container)` — clean teardown of mounted elements
- `Jetz.use(plugin)` — install router/session plugin
- `Jetz.style(cssString)` — inject dynamic `<style>` rules
- `Jetz.devtools = true` — extra diagnostics (stringified-function warnings, bind stack frames)
- `Dispatcher` — `new Dispatcher(handler)`, `dispatcher.dispatch(action)`
- `addScript(url, { async, onload })` — dynamic script loading
- `html(string)` — raw HTML wrapped in a Raw element
- `range(a, b)`, `flatMap(arr)`, `createList(n, fn)` — array helpers
- Prototypes: `arr.last()`, `arr.take(n)`, `num.range(end)`
