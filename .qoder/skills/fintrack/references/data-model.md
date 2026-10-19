# FinTrack Data Model

## Records

```js
// transaction — income / expense
{ id, date: "YYYY-MM-DD", description, categoryId, type: "income" | "expense",
  amount: number, accountId, note }

// transaction — transfer (no categoryId)
{ id, date, description, categoryId: null, type: "transfer", amount,
  fromAccountId, toAccountId, note }

// category
{ id, name, color, icon, type: "income" | "expense", budget: number }

// account
{ id, name, kind: "cash" | "bank" | "digital" | "deposit" | "custom",
  color, icon, opening: number }
```

`ACCOUNT_KINDS` and `kindLabel()` live in `src/state/accounts.js`; the seed set is
`src/data/accounts.json` (cash, bank, digital, deposit).

## Storage keys (`src/services/storage.js` → `KEYS`)

| Key | Shape |
|---|---|
| `fintracker.transactions` | array of transaction records |
| `fintracker.categories` | array of category records |
| `fintracker.accounts` | array of account records |
| `fintracker.savings` | flat object: `enabled`, `schedule`, `target`, `startDay` (1–31, monthly reminder opens on it), `depositAccountId`, `sourceAccountId`, `lastPromptDay`, `skippedMonth`, plus `skippedDays: string[]` |
| `fintracker.prefs` | `{ theme, currency, language, demoAsk }` |

`fintracker.savings` is deliberately separate from prefs: clearing preferences (theme, currency,
language) must not erase savings history or the streak. Because `stateOf()` leaves an array
un-wrapped, `skippedDays` lives in its own `listOf()` in `store.js` and is merged back by
`saveSavings()`. A new scalar plan field needs only a default in the `savings` `stateOf` literal
(placed before `...savingsSeed`), which older stored plans pick up automatically.

## Dispatcher actions

`TX_ADD`, `TX_UPDATE`, `TX_DELETE`, `CAT_ADD`, `CAT_UPDATE`, `CAT_DELETE`, `ACC_ADD`, `ACC_UPDATE`,
`ACC_DELETE`, `BUDGET_SET`, `PREFS_SET`, `SAVE_PLAN_SET`, `SAVE_PROMPT`, `SAVE_SKIP`,
`DATA_IMPORT`, `DATA_DEMO`, `DATA_CLEAR`, `TREND_RANGE`.

Subscribers: `"store"` (mutates), `"persist"` (writes keys), `"derived"` (transaction read-model),
`"accounts"` (balance read-model), plus per-chart components. Everything downstream of `"store"`
calls `dispatcher.waitFor("store")` first.

`DATA_*` actions appear in **every** persist switch because a demo load or import rewrites all five
keys. When adding a key, add a case to all the relevant switches — one switch per key, never one
combined switch.

## Boot and migration (`boot()` in `store.js`)

1. No stored transactions or categories → generate demo data, write all three data keys, set
   `prefs.demoAsk = true` so the first-visit sheet asks whether to keep the sample data.
2. Otherwise run `migrateIcons()` (stored icon names that are not in the seed get reset) and back-fill
   `accountId` on any pre-accounts record using the first non-deposit account.
3. `bootAccounts()` fills defaults per record (`color`, `icon`, `kind: "custom"`, `opening: 0`) so
   partial stored rows stay readable.
4. `repointPlan()` runs at boot and after any import or account delete: the savings target must point
   at a `kind === "deposit"` account and the source at a different, non-deposit one.

Deleting an account calls `rehomeRecords()` — every `accountId`, `fromAccountId` and `toAccountId`
pointing at the gone account moves to a survivor, then `repointPlan()` runs. The last account cannot
be deleted.

## Snapshot import/export

`exportSnapshot()` writes `{ app, version: 2, exportedAt, transactions, categories, accounts,
preferences }`. `importSnapshot()` shape-filters every array and returns `accounts: null` when the
file predates accounts, which makes the store seed defaults instead of wiping them. A snapshot must
contain `transactions` and `categories` arrays or it is rejected.

## CSV ledger (`src/services/exportLedger.js`)

Columns: date, description, category, account, type, amount, note — header labels come from i18n, so
the export follows the current UI language. Separator is `;` when the active locale renders `1.5` with
a comma (id-ID) and `,` otherwise; `toCSV()` adds a UTF-8 BOM and uses `\r\n`. Amounts are bare
numbers, never formatted currency. A transfer's account cell is `from → to` and its category is an em
dash.

## Derived read-models

`src/state/transactions.js` — filtered list, recent list, month options, per-category spending,
budget rows, over-budget rows, cash-flow trend series, monthly net series. Every aggregate except the
account ones excludes `type === "transfer"`.

`src/state/accounts.js` — `accountBalances`, `accCount`, `netWorth`, `totalSaved`,
`savedThisPeriod`, `savedThisMonth`, `savedDaysThisMonth`, `depositStreak`, `accountUsage`,
`promptVisible`, `currentPeriod`, plus the writers `setPlan()`, `markPromptShown()`, `skipPeriod()`,
`logDeposit()` and the helper `quickAmountList()`.

"Saved" means money landing in a `deposit`-kind account, through either a transfer in or income booked
straight to it. The streak counts consecutive deposit days and tolerates today being untouched so far.

`promptVisible` is false while `prefs.demoAsk` is true, so the first-visit sheet and the save-money
sheet never stack.

## i18n API (`src/state/i18n.js`)

`t(key, params)` reads the value now; `tt(key)` returns a reactive value safe as a child or in a
callback; `localeTag()` gives the BCP-47 tag for `Intl`. Locales: `en`, `id` (default). Only chrome is
translated — user-entered names and descriptions pass through untouched.
