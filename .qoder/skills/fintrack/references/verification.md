# FinTrack Browser Verification

There is no test suite, so a change is only done once it has been driven in a browser. Use the
`browser-use` MCP tools against the dev server.

## Setup

```bash
pnpm build                                   # must be clean before checking anything
pnpm exec rspack serve --port 8123           # or `pnpm start` for the default 8080
```

`pnpm build` warnings about `html.worker.js` / `ts.worker.js` / `css.worker.js` sizes are the leftover
Monaco scaffolding and expected. Anything else is yours.

## Four things that will otherwise mislead you

1. **The dev server caches `main.js`.** A plain reload can run yesterday's bundle. Always navigate to
   a fresh query string: `http://localhost:8123/?fresh=12#/transactions`, and bump the number after
   every rebuild.
2. **Boot-time errors never reach the console list.** A throw during module evaluation kills the app
   silently and `list_console_messages` stays empty. Probe it explicitly:

   ```js
   async () => { const errs = []; try { await import('/main.js?cb=' + Date.now()); } catch (e) { errs.push(String(e)); } return errs; }
   ```

3. **Hash routes need the leading slash.** `#accounts` renders the dashboard; `#/accounts` renders the
   page. This bites hardest when setting an iframe `src`.
4. **`/tmp` is not the same directory** for Git Bash and Node. Write capture artifacts inside the repo
   (and delete them afterwards) rather than guessing at a temp path.

## Mobile width harness

Replace the page with a phone-sized iframe, then drive the app inside it:

```js
() => { document.body.innerHTML = '';
  const f = document.createElement('iframe');
  f.id = 'h'; f.src = '/?fresh=31#/accounts';
  f.style.cssText = 'width:360px;height:740px;border:0;display:block;background:#fff';
  document.body.appendChild(f); return 'ok'; }
```

Navigate inside it with `f.contentWindow.location.href = '/?fresh=32#/settings'` and scroll with
`f.contentWindow.document.scrollingElement.scrollTop = 700`. Screenshot the page as usual. Check
every new surface at 360px: no horizontal overflow, bottom sheets instead of centered modals, touch
targets, and the drawer top bar.

## Driving a scenario

LocalStorage is same-origin, so seed or reset state from the parent frame and then reload the app:

```js
() => { const s = JSON.parse(localStorage.getItem('fintracker.savings'));
  s.lastPromptDay = ''; s.skippedMonth = '';
  localStorage.setItem('fintracker.savings', JSON.stringify(s)); return s; }
```

For downloads, patch `URL.createObjectURL` before clicking the export button and stash the blob text:

```js
() => { window.__cap = null; const orig = URL.createObjectURL.bind(URL);
  URL.createObjectURL = b => { b.text().then(t => { window.__cap = t; }); return orig(b); }; return 'armed'; }
```

Clearing `fintracker.*` entirely reproduces a first-ever visit, including the demo seed and the
first-visit sheet.

## Device notifications

The automated Chrome that `browser-use` drives denies the notifications permission up front, on every
origin — check `Notification.permission` before planning a test, because the Allow button never appears
and no banner will show. What is still verifiable:

- The Settings row renders the state the browser reports (blocked hint, no Enable button).
- `curl -s http://localhost:8123/sw.js | grep -n notificationclick` proves the *served* worker carries
  the click handler — an edited `public/sw.js` is only live after the worker updates.
- The prompt opening with permission denied must leave the console clean; the call fails quietly.

Claiming an actual banner appeared, or that tapping it focused the app, requires a real browser profile
where the permission can be granted. Say so instead of guessing.

## Behavioural matrix

Walk the rows that apply to the change, screenshotting each one:

- **First run** — blank storage: demo seeds, first-visit sheet appears, no console errors.
- **Reload** — the same data comes back; the sheet does not reappear.
- **Persistence** — after each write, read the storage key and confirm the shape *and* that a
  multi-key action (`Load demo data`, `Import JSON`, `Clear all transactions`) updated every key it
  should. A stale key is the signature of a merged persist switch.
- **Derived totals** — the number on screen must match a manual sum of the stored records, and
  transfers must be absent from income/expense while present in balances.
- **Cross-view** — a change made on one page shows up on every other page that reads it (dashboard
  card, accounts list, settings plan, CSV export) without a reload.
- **Recycling** — edit or re-derive a list that keeps its key and confirm the row text actually
  changed; a frozen row means a plain child where a `computed()` was needed.
- **Language** — repeat the key screens in both `en` and `id`; nothing may be half-translated and no
  user-entered name may change.
- **Theme** — light and dark, especially for any new colour tone on a card or chip.
- **Export** — open the CSV/JSON and read the captured text: separator, BOM, header language, the
  transfer row.
- **Console** — clean apart from the rspack info line.

Only report the work as done when every applicable row has been observed.
