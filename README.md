<div align="center">
  <h1>FinTrack</h1>
  <p><strong>Offline personal finance tracker — a single-page app built with the Jetz framework.</strong></p>

  <p>
    <a href="#quick-start">Quick Start</a> •
    <a href="#features">Features</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#project-structure">Structure</a>
  </p>

  <p>Your data never leaves the browser. No account, no backend, no network calls.</p>
</div>

---

## Table of Contents

- [Why FinTrack?](#why-fintrack)
- [Quick Start](#quick-start)
- [Installable and offline](#installable-and-offline)
- [Deploying](#deploying)
- [Features](#features)
  - [Dashboard](#dashboard)
  - [Transactions](#transactions)
  - [Budgets](#budgets)
  - [Categories](#categories)
  - [Settings](#settings)
- [Architecture](#architecture)
  - [Data flow](#data-flow)
  - [Persistence](#persistence)
  - [Derived state](#derived-state)
  - [Internationalization](#internationalization)
  - [Theme and currency](#theme-and-currency)
  - [Responsive shell](#responsive-shell)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Development Notes](#development-notes)
- [License](#license)

---

## Why FinTrack?

Most budgeting tools are either spreadsheets or cloud accounts. FinTrack aims for the middle: a real
app — dashboards, charts, budgets, filters — that is entirely local. Everything lives in
`localStorage`, exports to a plain JSON file, and reimports from one.

It doubles as a reference for building a non-trivial SPA with [Jetz](https://github.com/devarofi/jetz):
plain JavaScript composition functions instead of JSX, fine-grained reactive state instead of a
virtual DOM, and a Flux-style dispatcher as the single mutation path for domain data.

---

## Quick Start

Requires Node.js 20+ and [pnpm](https://pnpm.io) (declared through `devEngines`).

```bash
pnpm install
pnpm start          # rspack serve → http://localhost:8080
```

The first load seeds roughly nine months of demo transactions and a default category set so the
charts are never empty (amounts are generated in rupiah, matching the IDR default), then a sheet
asks whether to keep that sample data or **start fresh** (clears the transactions, keeps the
categories). The answer is stored in `fintracker.prefs`, so the question appears once and never
again — reloads included. Later, use **Settings → Load demo data** to regenerate, or **Clear all
transactions** to start from zero.

```bash
pnpm build          # rspack build → dist/ (bundle + public assets)
```

`dist/` is a plain static folder — serve it from any host over HTTPS (or `localhost`) and the app
installs as a PWA.

---

## Installable and offline

FinTrack is a PWA:

- `public/manifest.webmanifest` — name, `start_url: "/"`, `scope: "/"`, `display: standalone`,
  theme color `#84cc16`, and icons: `192x192` / `512x512` PNG, a `512x512` maskable PNG, plus an
  `"any"` SVG. `index.html` also links `apple-touch-icon.png` and the iOS web-app meta tags.
- `public/img/app-icon.svg` and `app-icon-maskable.svg` are the icon sources (bars + trend arrow on
  the brand gradient); the maskable variant keeps the glyph inside the safe zone.
- `public/sw.js` — a network-first worker: same-origin GETs go to the network and are mirrored into
  the `fintrack-v*` cache, and a failed navigation falls back to the cached `index.html`. Because it
  is network-first, a dev-server rebuild is always picked up on the next load. Registered from
  `index.js` on `load`.
- On `install` the worker fetches `/index.html`, scans its `src`/`href` attributes and precaches
  those too — `DOMParser` is not available in a service worker, so it is a regex scan. This matters:
  the very first document request is not intercepted (no worker exists yet), so without it
  `main.js` would never be cached and a cold offline start would render a blank page.
- No backend, no API calls: after one visit the app is fully usable with no network — routes, charts,
  forms and LocalStorage all work.

Install with the browser's install entry (address-bar icon on desktop, browser menu on Android);
`localhost` counts as a secure context, so installs can be tested locally.

---

## Deploying

`vercel.json` carries the whole deploy config, so importing the GitHub repo needs no manual
settings:

| Setting | Value |
|---|---|
| Root directory | repository root (where `package.json` lives) |
| Framework preset | `null` — Rspack is not auto-detected |
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm build` |
| Output directory | `dist` |

`packageManager` is pinned in `package.json` because the host must use pnpm; an `npm`-based install
fails on the `devEngines` declaration. Two rules in `vercel.json` matter for a PWA:

- `rewrites` sends every unmatched path to `/index.html`, so path-style routes (`/budgets`) deep-link
  correctly. Static files are matched first, so `/sw.js` and `/manifest.webmanifest` are never
  swallowed by the rewrite.
- `headers` forces `application/manifest+json` on the manifest (Chrome ignores a manifest served as
  `text/plain`) and `no-cache` on the service worker so an updated worker is noticed immediately.

Any static host works the same way — publish `dist/`, point the host's SPA fallback at
`index.html`, and keep those two content types.

---

## Features

### Dashboard

- Four stat cards — balance, income, expenses, savings rate — each with a month-over-month delta chip.
- **Cash-flow trend** (Chart.js line + area) with a range switch: 1D / 1M / 3M / 6M / 1Y.
- **Monthly net** stock-style chart: `income − expenses` over the last 12 calendar months, with a
  gradient area fill, a dashed zero baseline, and a MoM percentage chip.
- **Spending overview**: CSS conic-gradient donut plus a per-category legend with amounts and shares.
- Over-budget alert strip and the recent transactions table.

### Transactions

- Add, edit and delete through a bottom-sheet form (centered modal on desktop).
- Two-way bound inputs (`{ bind: state }`), income/expense toggle, category picker, date and amount.
- Live search plus filters by type, category and month; the month list is derived from the data.
- Responsive row layout: stacked label/value pairs on narrow screens, a six-column grid inside wide
  containers — the same component adapts to the card it sits in, not the viewport.

### Budgets

- Monthly budget per expense category, editable inline.
- Progress bars colored by usage, with spent / budget / remaining figures.
- Categories over budget surface in the alert strip with the exact overspend.

### Categories

- Add, rename, recolor, re-icon, switch type (income/expense), delete.
- Deleting a category re-homes its transactions to a same-type fallback so nothing renders as
  "Uncategorized".
- Per-category usage counts; a migration restores seed icon names when stored data predates them.

### Settings

- Theme (light/dark), currency, and language.
- Export the full snapshot to JSON, import a snapshot file (validated; malformed records dropped).
- Load demo data, clear all transactions.

---

## Architecture

### Data flow

```text
UI event
   │  dispatcher.dispatch(Actions.TX_ADD, payload)
   ▼
Dispatcher ──► "store"    mutates ListState / prefs (single source of truth)
          └─► "persist"   waitFor("store"), then writes localStorage
   ▼
Jetz reactive state (stateOf / listOf)
   ▼
computed() + loop()       fine-grained DOM updates, no re-render pass
```

Components never mutate domain data directly — they dispatch actions. Subscription ordering is
explicit through `dispatcher.waitFor(...)` rather than module import order: persistence waits for
`"store"`, and chart components wait for `"derived"` so they always read settled data.

### Persistence

| Key | Contents |
|---|---|
| `fintracker.transactions` | Array of transaction records |
| `fintracker.categories` | Array of category records (name, color, icon, type, budget) |
| `fintracker.prefs` | `{ theme, currency, language }` |

`src/services/storage.js` owns the keys plus `loadJSON`, `saveJSON`, `clearAll`, `exportSnapshot`
and `importSnapshot`. Import is defensive: a snapshot must contain `transactions` and `categories`
arrays, and records are shape-filtered before they reach the store.

### Derived state

`src/state/transactions.js` is the read-model layer. `refreshDerived()` runs on every store change
and rebuilds the filtered list, recent list, month options, per-category spending, budget rows,
over-budget rows, the cash-flow trend series, and the monthly net series.

Reactivity rules that matter here:

- `computed()` returns primitives only; collections are written into dedicated `listOf()` instances.
- Each `ListState` renders at exactly one `loop()` site. Keyed loops (`loop(list, r => r.id, …)`)
  recycle rows and dispose their effects and subscriptions automatically.
- Mutable content inside a row goes through `computed()` or an attribute callback — a bare value is
  read once at render and never updates.

### Internationalization

`src/state/i18n.js` holds ~150 keys in English and Indonesian. `t(key)` / `tt(key)` return reactive
values, so switching language updates the UI in place without a remount, and `<html lang>` stays in
sync. Only interface chrome is translated — user-entered category names and transaction descriptions
are left as written.

Bahasa Indonesia and IDR are the initial defaults (`state/store.js` merges stored prefs *over* them,
so a returning user keeps their choice). The first-visit sheet carries a language picker, so someone
who lands on the Indonesian UI can switch to English before answering — every label in it is
reactive, so the sheet retranslates live.

### Theme and currency

- An inline script in `index.html` applies the saved `dark` class before first paint, so a reload
  never flashes the wrong theme.
- `src/state/preferences.js` toggles that class reactively and exposes `fmt(amount)`, which formats
  through `Intl.NumberFormat` with a locale per currency (USD, EUR, GBP, IDR, JPY). Call `fmt()`
  inside a `computed()` or attribute callback so a currency change re-renders.

### Responsive shell

- Desktop: fixed 240px sidebar. Mobile: top bar with a hamburger drawer and backdrop; the drawer
  closes automatically on route change.
- Modals are bottom sheets on phones (`items-end sm:items-center`, `max-h-[92dvh]`, scroll-locked).
- Component-level layout uses Tailwind v4 **container queries** (`@container` with `@[44rem]:` and
  `@[27rem]:`) so a card lays itself out from its own width rather than the viewport.
- Overflow is handled with `min-w-0` on flex/grid children and `shrink-0 whitespace-nowrap
  tabular-nums` on money columns — `Intl` currency output contains non-breaking spaces that
  otherwise clip.
- Icons are Lucide and Tabler SVGs inlined through a raw-node helper; no emoji glyphs anywhere.

---

## Tech Stack

| Concern | Choice |
|---|---|
| UI framework | `@daevsoft/jetz` 1.1.3 — reactive state, `loop`, router, `Dispatcher` |
| Bundler / dev server | Rspack (`@rspack/cli`, `@rspack/core`, `@rspack/dev-server`) |
| Styling | Tailwind CSS v4 via `@tailwindcss/postcss`, tokens and component classes in `src/styles/app.css` |
| Charts | Chart.js 4 (line/area; the donut is a CSS conic gradient) |
| Icons | `lucide-static`, `@tabler/icons` |
| Persistence | Browser `localStorage` |
| App shell | Web app manifest + one service worker (`public/sw.js`) |
| Package manager | pnpm |

---

## Project Structure

```text
.
├── index.html                 # app shell, theme pre-paint script, manifest + icon links
├── index.js                   # router install, Jetz.mount, service worker registration
├── rspack.config.mjs          # html/monaco/copy plugins, css + asset rules
├── postcss.config.mjs         # tailwind v4
├── vercel.json                # build settings, SPA rewrite, PWA headers
├── public
│   ├── manifest.webmanifest   # install metadata
│   ├── sw.js                  # network-first offline shell
│   └── img/                   # app icons (svg sources + 192/512/maskable/apple PNGs)
└── src
    ├── app.js                 # layout root
    ├── routes.js              # hash + history router, syncs activeRoute
    ├── home.css               # base layer
    ├── styles/app.css         # tailwind entry, design tokens, component classes
    ├── data/                  # seed categories and transactions (JSON)
    ├── services/
    │   ├── storage.js         # localStorage keys, snapshot export/import
    │   └── mockData.js        # demo data generator
    ├── state/
    │   ├── store.js           # actions, lists, prefs, dispatcher, persistence
    │   ├── transactions.js    # derived read-model: filters, totals, trends, budgets
    │   ├── preferences.js     # theme effect, currency formatting
    │   ├── i18n.js            # en/id dictionaries
    │   └── ui.js              # drawer state, scroll lock
    ├── components/
    │   ├── AppLayout.js       Sidebar.js          StatCard.js
    │   ├── TrendChart.js      NetTrendChart.js    CategoryChart.js
    │   ├── TransactionTable.js      TransactionForm.js
    │   ├── QuickActions.js    BudgetAlert.js      DemoNotice.js   icons.js
    └── pages/
        ├── Dashboard.js   Transactions.js   Budgets.js   Categories.js   Settings.js
```

Routes are hash-based: `#/`, `#/transactions`, `#/budgets`, `#/categories`, `#/settings`.

---

## Development Notes

- `pnpm start` runs `rspack serve` with `hot: false` and `historyApiFallback: true`; `pnpm build`
  emits `dist/` and copies `public/` into it via `CopyRspackPlugin`.
- The service worker is network-first, so development reloads are never stale. To reset a stuck
  registration: DevTools → Application → Service Workers → Unregister, then clear the
  `fintrack-v*` cache. Bumping `CACHE` in `public/sw.js` also drops the previous cache on activate.
- Tailwind's scanner cannot see dynamically interpolated class names, so every class used inside a
  `class: () => …` callback must also appear literally somewhere in the source.
- `src/playground.js` and the Monaco plugin are leftover framework scaffolding — the app entry does
  not import them.
- `pnpm test` is a placeholder; there is no test suite yet.

---

## License

ISC.
