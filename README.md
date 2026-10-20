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
  - [Accounts and save money](#accounts-and-save-money)
  - [Settings](#settings)
- [Architecture](#architecture)
  - [Data flow](#data-flow)
  - [Persistence](#persistence)
  - [Derived state](#derived-state)
  - [Device reminders](#device-reminders)
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
`IndexedDB`, exports to a plain JSON file or an Excel-friendly CSV, and reimports from the JSON snapshot.

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

The first load seeds roughly nine months of demo transactions, a default category set and four
accounts (cash, bank, e-wallet and a deposit one) so the charts are never empty (amounts are
generated in rupiah, matching the IDR default), then a sheet
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
  forms and IndexedDB all work.

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

- Five stat cards — balance, income, expenses, savings rate, and **Total saved** (money parked in
  deposit accounts, with a "Saved today / this month" sub-line) — each of the first four with a
  month-over-month delta chip.
- **Cash-flow trend** (Chart.js line + area) with a range switch: 1D / 1M / 3M / 6M / 1Y.
- **Monthly net** stock-style chart: `income − expenses` over the last 12 calendar months, with a
  gradient area fill, a dashed zero baseline, and a MoM percentage chip.
- **Spending overview**: CSS conic-gradient donut plus a per-category legend with amounts and shares.
- Over-budget alert strip and the recent transactions table.

### Transactions

- Add, edit and delete through a bottom-sheet form (centered modal on desktop).
- Two-way bound inputs (`{ bind: state }`), income / expense / transfer toggle, category and account
  pickers, date and amount. An expense debits its source account, income credits its target, and a
  transfer moves money between two accounts.
- Live search plus filters by type, category, account and month; the month list is derived from the data.
- Export the rows currently in view to CSV from the toolbar; a short note confirms how many were written.
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

### Accounts and save money

Money lives in accounts rather than in a single implicit balance.

- Five kinds — **cash, bank, digital wallet, deposit, custom** — each with an auto-picked icon and
  colour, a name, and an opening balance. `#/accounts` lists them with their derived balance and the
  number of records using each.
- Balances are never stored. `src/state/accounts.js` replays every transaction over the openings:
  income credits, expense debits, a transfer debits one account and credits another. Net worth is the
  sum of all balances; **total saved** is the sum of the `deposit`-kind ones.
- A `transfer` is a third transaction type that is excluded from every income/expense aggregate —
  moving money is not earning or spending — but it still appears in the ledger and the CSV export.
- The **save plan** sets a suggested amount, a schedule (daily or monthly), a deposit account and a
  source account. The monthly start day is picked from a 1–31 grid, not typed. Logging a deposit from
  the prompt writes an ordinary transfer, so it flows into the balances, the ledger and the streak.
- The prompt sheet follows the schedule: **daily** it appears once per day on the first open, and
  "remind later" defers it to tomorrow; **monthly** it returns on every open from the plan's start day
  (a short month pulls it back to its last day) until something lands in the deposit account that
  month, and "remind later" defers to the next open.
  Dismissing the sheet always resolves to either *remind later* or *skip today / skip this month*, so
  a skipped period is recorded and stops re-asking.
- Quick chips offer the plan target split into steps (¼, ½, full). Account pickers disable invalid
  options — a deposit account can never be a source, and vice versa.
- **Device notifications.** When the reminder opens, the same nudge is mirrored into the notification
  shade so it outlives closing the app; tapping it focuses an open window or launches the app at the
  save page. Permission is asked for on **Settings → Device notifications**, never on load.
- Deleting an account re-homes the transactions that referenced it and repoints the plan at a valid
  deposit/source pair; the last remaining account cannot be deleted.

### Settings

- Theme (light/dark), currency, and language.
- Save-money reminders: a switch, daily or monthly schedule, the monthly start day, target amount,
  the deposit/source account pair, and the device-notification permission.
- Export the full snapshot to JSON, import a snapshot file (validated; malformed records dropped).
- Export every transaction as CSV — no filters applied, so nothing is left behind.
- Load demo data, clear all transactions.

---

## Architecture

### Data flow

```text
UI event
   │  dispatcher.dispatch(Actions.TX_ADD, payload)
   ▼
Dispatcher ──► "store"     mutates ListState / prefs (single source of truth)
          ├─► "persist"    waitFor("store"), then writes IndexedDB
          ├─► "derived"    waitFor("store"), rebuilds the transaction read-model
          └─► "accounts"   waitFor("store"), rebuilds balances + save-plan state
   ▼
Jetz reactive state (stateOf / listOf)
   ▼
computed() + loop()        fine-grained DOM updates, no re-render pass
```

Components never mutate domain data directly — they dispatch actions. Subscription ordering is
explicit through `dispatcher.waitFor(...)` rather than module import order: persistence waits for
`"store"`, and chart components wait for `"derived"` so they always read settled data.

### Persistence

| Key | Contents |
|---|---|
| `fintracker.transactions` | Array of transaction records |
| `fintracker.categories` | Array of category records (name, color, icon, type, budget) |
| `fintracker.accounts` | Array of account records (name, kind, color, icon, opening) |
| `fintracker.savings` | Save plan + prompt state: `{ enabled, schedule, target, startDay, depositAccountId, sourceAccountId, lastPromptDay, skippedMonth, skippedDays }` |
| `fintracker.prefs` | `{ theme, currency, language, demoAsk, … }` |

Each stored key gets its own `switch` in the persistence subscriber: one action can touch several
files (`DATA_DEMO` rewrites transactions, categories, accounts and prefs), and a single shared
`switch` would `break` after the first matching group and silently skip the rest.

`src/services/storage.js` owns the keys plus `loadJSON`, `saveJSON`, `clearAll`, `exportSnapshot`
and `importSnapshot`, and the CSV primitives: `toCSV` (UTF-8 BOM, `\r\n`, quotes only where needed) and
`downloadFile` (blob → anchor click → revoke). `src/services/exportLedger.js` maps records to rows,
localizing headers and picking `;` when the locale writes decimals with `,`. Import is defensive: a
snapshot must contain `transactions` and `categories` arrays, and records are shape-filtered before they
reach the store. The ledger columns are date, description, category, account, type, amount and note; a
transfer's account cell reads `from → to` and its category is an em dash, since it belongs to neither.

Snapshots are version 2 and carry `accounts`. A v1 file (or stored data from before accounts existed)
imports with `accounts: null`, which makes the store seed the default account set and back-fill
`accountId` on the old records, so no ledger is orphaned.

### Derived state

`src/state/transactions.js` is the read-model layer. `refreshDerived()` runs on every store change
and rebuilds the filtered list, recent list, month options, per-category spending, budget rows,
over-budget rows, the cash-flow trend series, and the monthly net series.

`src/state/accounts.js` is the second read-model: `refreshDerivedAccounts()` replays the ledger over
the account openings to produce balances, net worth, per-account usage counts, the deposit streak and
the saved-this-period figure, then decides whether the save-money prompt should be visible. Counts
that the UI needs to react to are mirrored into `stateOf` primitives (`accCount`, `skippedRecent`,
`txCount`) because reading `ListState.values` inside a `computed()` or `effect()` is not tracked.

Reactivity rules that matter here:

- `computed()` returns primitives only; collections are written into dedicated `listOf()` instances.
- Each `ListState` renders at exactly one `loop()` site. Keyed loops (`loop(list, r => r.id, …)`)
  recycle rows and dispose their effects and subscriptions automatically.
- Mutable content inside a row goes through `computed()` or an attribute callback — a bare value is
  read once at render and never updates.

### Device reminders

The Push API is out of scope: it needs a server holding VAPID keys to wake a closed app, and FinTrack
has no backend. The reminder instead uses the **Notifications API** from `src/services/notify.js`,
raised by the app at the moment the prompt opens and then left in the notification shade — the nudge
survives closing the app, it just cannot appear before the app is next opened.

- It is shown through `registration.showNotification()`, never `new Notification()`: only
  worker-shown notifications deliver their `notificationclick` event to `public/sw.js`, which is what
  lets a tap focus an already-open window or launch the app.
- A `tag` per period (`save-2026-10-19`) means re-opening replaces the old card instead of stacking a
  list of the same nudge.
- Permission is requested only from a click on **Settings → Device notifications**. The app never
  prompts on load, and if the state is `denied` the row explains how to unblock it at browser level.
- On iOS and iPadOS `Notification` exists only inside an installed PWA (16.4+), so the row hides
  itself when the API is missing rather than showing a control that cannot work.

### Internationalization

`src/state/i18n.js` holds ~220 keys in English and Indonesian. `t(key)` / `tt(key)` return reactive
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
| Persistence | Browser `IndexedDB` (one `kv` store; localStorage only mirrors the theme pre-paint) |
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
    ├── data/                  # seed categories, accounts and transactions (JSON)
    ├── services/
    │   ├── storage.js         # IndexedDB kv store, snapshot export/import, CSV + download helpers
    │   ├── exportLedger.js    # ledger → locale-aware CSV rows for Excel/Sheets
    │   ├── notify.js          # device reminders through the worker registration
    │   └── mockData.js        # demo data generator
    ├── state/
    │   ├── store.js           # actions, lists, prefs, dispatcher, persistence
    │   ├── transactions.js    # derived read-model: filters, totals, trends, budgets
    │   ├── accounts.js        # derived read-model: balances, plan, save-money prompt
    │   ├── preferences.js     # theme effect, currency formatting
    │   ├── i18n.js            # en/id dictionaries
    │   └── ui.js              # drawer state, scroll lock
    ├── components/
    │   ├── AppLayout.js       Sidebar.js          StatCard.js
    │   ├── TrendChart.js      NetTrendChart.js    CategoryChart.js
    │   ├── TransactionTable.js      TransactionForm.js
    │   ├── SaveMoneyPrompt.js QuickActions.js     BudgetAlert.js
    │   └── DemoNotice.js      icons.js
    └── pages/
        ├── Dashboard.js   Transactions.js   Budgets.js   Categories.js
        └── Accounts.js    Settings.js
```

Routes are hash-based: `#/`, `#/transactions`, `#/budgets`, `#/categories`, `#/accounts`,
`#/settings`.

---

## Development Notes

- `pnpm start` runs `rspack serve` with `hot: false` and `historyApiFallback: true`; `pnpm build`
  emits `dist/` and copies `public/` into it via `CopyRspackPlugin`.
- The service worker is network-first, so development reloads are never stale. To reset a stuck
  registration: DevTools → Application → Service Workers → Unregister, then clear the
  `fintrack-v*` cache. Bumping `CACHE` in `public/sw.js` also drops the previous cache on activate.
- Tailwind's scanner cannot see dynamically interpolated class names, so every class used inside a
  `class: () => …` callback must also appear literally somewhere in the source.
- A `loop()` must be the only child of its parent element: Jetz's keyed reconciler moves rebuilt
  views with `parent.prepend(...)`, so any sibling (page heading, table header row, static
  `<option>`, empty-state message) sinks below the rows on the first list update. Lists are
  therefore wrapped in their own container, and entries like "All time" live inside the looped data.
- Jetz element children cannot be `null` — `append()` throws on it. Render "nothing" as `[]` (or an
  array spread for a conditional group of children) and hide optional blocks with a `hidden` class
  instead of leaving them out.
- `stateOf(object)` turns its own properties into States but leaves an Array value untouched, so a
  list stored on such an object has no `.value` and `toObject()` drops it. Keep collections in their
  own `listOf()` and merge them back by hand when writing the JSON.
- `src/playground.js` and the Monaco plugin are leftover framework scaffolding — the app entry does
  not import them.
- `pnpm test` is a placeholder; there is no test suite yet.

---

## License

ISC.
