---
name: fintrack
description: Work on FinTrack, the offline personal-finance SPA at C:\Labs\ai\mini-app (Jetz + Rspack + Tailwind v4, LocalStorage as the only database). Use when adding or changing features, state, pages, storage keys, translations, exports, or the PWA shell, and when the task needs the project's own architecture rules, build commands, and browser-verification workflow.
---

# FinTrack Project Guide

## Overview

FinTrack is an installable, fully offline single-page finance tracker: dashboards, ledger, budgets,
accounts and a save-money nudge, with LocalStorage as the only database. Plain JavaScript +
`@daevsoft/jetz` (no JSX, no virtual DOM), a Flux `Dispatcher` as the single mutation path, Tailwind
v4, Chart.js, hash routing, Rspack, deployed to Vercel as static `dist/`.

Framework-level Jetz rules live in the separate `jetz` skill. This skill covers what is specific to
*this* repository.

## Commands

```bash
pnpm install
pnpm start           # rspack serve → http://localhost:8080
pnpm build           # rspack build → dist/ (bundle + copied public/)
```

pnpm is enforced through `devEngines`; an npm install fails. `pnpm test` is a placeholder — there is
no test suite, so verification means exercising the running app (see Verification).

## Layout

```text
index.js              router install, Jetz.mount, service worker registration
index.html            inline theme pre-paint script
rspack.config.mjs     html / monaco / copy plugins
public/sw.js          network-first worker, precaches index.html's src/href assets
src/app.js            layout root
src/routes.js         route table — add new pages here
src/data/*.json       seed categories, accounts, transactions
src/services/         storage.js (keys, snapshot, CSV), exportLedger.js, notify.js, mockData.js
src/state/            store.js (actions/lists/prefs/dispatcher/persist), transactions.js,
                      accounts.js, preferences.js, i18n.js, ui.js
src/components/       AppLayout, Sidebar, StatCard, charts, forms, SaveMoneyPrompt, icons
src/pages/            Dashboard, Transactions, Budgets, Categories, Accounts, Settings
```

Routes are hash-based: `#/`, `#/transactions`, `#/budgets`, `#/categories`, `#/accounts`, `#/settings`.
A new route needs three edits: `src/routes.js`, an entry in `src/components/Sidebar.js` (it also
drives the mobile top-bar title), and its i18n keys.

## Non-negotiable rules

1. **Components never mutate domain data.** They call `dispatcher.dispatch(Actions.X, payload)`.
   Only `src/state/store.js` writes the `ListState`s and `prefs`.
2. **Subscription order is explicit.** Every downstream subscriber calls
   `dispatcher.waitFor("store")` first; charts wait for `"derived"`. Never rely on module import
   order or on `state.subscribe()` firing after an `effect()`.
3. **One `switch` per stored key** in the persist subscriber. An action like `DATA_DEMO` touches
   transactions, categories, accounts and prefs; a shared switch would `break` after the first group
   and silently skip the rest.
4. **Nothing about a balance is stored.** `src/state/accounts.js` replays the ledger over each
   account's `opening`. Add a new stored money field only if it genuinely cannot be derived.
5. **`transfer` is invisible to income/expense.** Any new aggregate must skip `type === "transfer"`
   or the totals drift. It still appears in the ledger, the CSV and the account balances.
6. **Chrome is translated, data is not.** Every new label goes in both `en` and `id` blocks of
   `src/state/i18n.js`. User-entered names and descriptions stay as written.
7. **Icons are Lucide / Tabler SVGs** from `src/components/icons.js`. Never emoji glyphs.
8. **Charts are Chart.js** (the donut is the one exception: a CSS conic gradient).
9. **Device reminders go through `src/services/notify.js`.** Show them with
   `registration.showNotification()` — a bare `new Notification()` never reaches the worker, so its
   click cannot focus or open the app. Ask for permission on a user gesture only, never on load, and
   give each nudge a `tag` so a period replaces its own card instead of stacking.

## LocalStorage keys

`src/services/storage.js` owns them: `fintracker.transactions`, `.categories`, `.accounts`,
`.savings`, `.prefs`. Snapshots are version 2 and carry `accounts`; a v1 file imports with
`accounts: null`, which makes the store seed defaults and back-fill `accountId`. Any new key must be
added to `KEYS` so `clearAll()` covers it, and to the JSON snapshot if it belongs in an export.

## Reactivity traps hit in this repo

These each caused a real bug here; re-read them before debugging a "stale UI" report.

- Reading `ListState.values` or `.length` inside `computed()`/`effect()` is **not tracked**. Mirror
  the count into a `stateOf` primitive (`txCount`, `accCount`, `skippedRecent`) and read that.
- `stateOf(object)` wraps its own properties into States but leaves an **Array** value alone, so
  `state.someList.value` is `undefined` and `toObject()` drops the key. Keep collections in their own
  `listOf()` and merge them back by hand when writing JSON (see `saveSavings()`).
- Element children **cannot be `null`** — `append()` throws. Render "nothing" as `[]`, use an array
  spread for a conditional group of children, or hide with a `hidden` class.
- A rebuilt list that keeps its `loop()` key **reuses the DOM node without re-running the renderer**,
  so plain string children go stale. Make them `computed()` children or fold the value into the key.
- A `loop()` must be the only child of its parent: the keyed reconciler uses `parent.prepend(...)`, so
  any sibling sinks below the rows on the first update.
- Tailwind's scanner cannot see interpolated class names, so every class used inside
  `class: () => …` must also appear literally somewhere in the source.

## Verification

There is no test suite, so a change is done only when it has been driven in a browser at
`http://localhost:8123` (or the `pnpm start` port). The full recipe — cache-busting URLs, the module
probe that surfaces boot-time errors, the 360px iframe harness, and the behavioural matrix to walk
for state/persistence work — is in `references/verification.md`.

Minimum bar for any feature: first run, reload, persisted state, mobile width, and a clean console.

## Style

- One-line `//` comments only, and only where the *why* is non-obvious (a constraint, an ordering
  guarantee, a workaround). No docblocks, no narration of what the code does.
- Small focused modules: a read-model file exports its derived `stateOf`/`listOf` and a refresh
  function; pages stay declarative and read those.
- Match the existing commit-message voice: a sentence-case subject describing the behaviour change,
  then a body explaining why.

## Resources

- `references/verification.md` — browser check workflow and the behavioural matrix.
- `references/data-model.md` — dispatcher actions, storage shapes, migration rules, CSV columns.
