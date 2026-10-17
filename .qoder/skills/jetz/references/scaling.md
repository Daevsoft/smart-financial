# Jetz: Scaling Large Data Sets

A grid holding tens of thousands of rows stresses the reactive engine two ways: how much memory each record costs, and who releases a row once it leaves the screen. Imports from `@daevsoft/jetz` and `@daevsoft/jetz/ui`.

## Shallow Row State (`rowOf`, `shallowStateOf`)

`stateOf(object)` walks the object and turns **every property** into its own reactive `State` — a 12-column row costs 12 `State` instances, for all 50,000 rows including the 49,500 off-screen.

`rowOf(object)` (alias `shallowStateOf()`) keeps the record a plain object with **one** version signal:

```javascript
import { computed, listOf, loop, rowOf } from "@daevsoft/jetz";
import { table, tbody, tr, td, button } from "@daevsoft/jetz/ui";

// One signal per row, not one per cell
const employees = listOf(
  rowOf({ id: 1, name: "Alice", dept: "Engineering", score: 92 }),
  rowOf({ id: 2, name: "Bob", dept: "Design", score: 78 })
);

const grid = table(
  tbody(loop(employees, emp => emp.id, emp => tr(
    td(emp.name),                          // immutable column: read once, free
    td({ class: () => emp.dept }),         // reactive: re-reads on every bump
    td(computed(() => emp.score)),         // reactive: recomputes on every bump
    td(button("+1", {
      onclick: () => { emp.score = emp.score + 1; } // one write, one row refresh
    }))
  )))
);
```

Clicking **+1** bumps that row's version signal; only that one `<tr>` re-renders. Memory: `rowOf` carries ~7x less heap than `stateOf` + `computed()` columns for 50,000 rows.

### Which forms re-read the row

A row bump only refreshes bindings that *tracked* the row:

| Form | Re-reads on row bump? | Use for |
|---|---|---|
| `td(emp.score)` | no | columns that never change |
| `td(() => emp.score)` | **no** — a bare function child is called once | function components |
| `td(computed(() => emp.score))` | yes | mutable text cells |
| `td({ "data-x": () => emp.score })` | yes | reactive attributes |
| `` td(css`cell ${() => emp.dept}`) `` | yes | reactive classes |
| `td({ style: { width: () => emp.score + "px" } })` | yes | reactive styles |

The one rule: **a bare value or bare function child is evaluated once.** Wrap mutable cell text in `computed()` — or move it into an attribute, `class` or `style` — for the row bump to reach it. Keep immutable columns plain; that is where shallow rows save the most.

### Row helpers

| Member | Description |
|---|---|
| `row.touch()` | Bump the row version (row-level refresh) |
| `row.set({ patch })` | Merge a patch and bump once |
| `row.peek(key)` | Read a property untracked, like `rawOf()` |
| `row.toObject()` | Plain, non-reactive copy of the record |

`rowOf()` falls back to plain `stateOf()` for primitives, arrays and `JetzElement`s, so it maps safely over mixed data.

## Untracked Pipeline Reads (`rawOf`)

A tracked read inside a `computed()` or `effect()` subscribes it — desired while rendering a cell, wrong in a filter/sort pass that walks all 50,000 rows (one subscription per row pins the pipeline to the dataset). `rawOf(row)` returns the underlying plain object so reads stay untracked (no-op on non-rows):

```javascript
import { computed, listOf, rawOf, rowOf, stateOf } from "@daevsoft/jetz";
import { table, tbody, tr, td } from "@daevsoft/jetz/ui";

const all = listOf(...fetchEmployees().map(rowOf)); // full dataset
const query = stateOf("");

// Untracked reads: re-runs from scratch per keystroke, but the reactive
// graph never gains a dependency per row.
function visibleRows() {
  return all
    .filter(emp => rawOf(emp).name.toLowerCase().includes(query.value.toLowerCase()))
    .sort((a, b) => rawOf(a).score - rawOf(b).score);
}

const matchCount = computed(() => visibleRows().length); // primitive is fine

// For the rows themselves, drive the rendered list:
const employees = listOf(...visibleRows());
query.subscribe(() => employees.set(visibleRows()));

const grid = table(tbody(loop(employees, emp => emp.id, emp => tr(
  td(emp.name),                             // immutable column
  td(computed(() => emp.score))             // mutable column
))));
```

The reactive graph holds only two subscriptions (`query` and the rendered page), not one per row per column.

For a bulk edit, write plain data first, then bump once per row (coalesced by `batch()`):

```javascript
import { batch, rawOf, touchRow } from "@daevsoft/jetz";

batch(() => {
  for (const emp of employees.values) {
    rawOf(emp).score += 1;   // untracked write target
  }
  for (const emp of employees.values) {
    touchRow(emp);           // one refresh per row
  }
});
```

## Automatic Cleanup Lifecycle

A rendered view is not just DOM: it also owns `effect()` runs, `computed()` subscriptions, state subscriptions, style containers and event listeners. If a row is removed while those stay subscribed, the state keeps the whole detached subtree reachable — the classic "the grid scrolls for ten minutes and the heap keeps climbing" leak.

Jetz gives every `loop()` item its own **disposal scope**. Everything created while that item renders registers its teardown there:

```javascript
import { effect, listOf, loop, rowOf } from "@daevsoft/jetz";
import { table, tbody, tr, td } from "@daevsoft/jetz/ui";

const employees = listOf(...fetchEmployees().map(rowOf));

const grid = table(tbody(loop(employees, emp => emp.id, emp => {
  // created inside the item scope - disposed automatically with the row
  effect(() => { trackRowInAnalytics(emp.name); });

  return tr(
    td({ class: () => emp.dept }),
    td(computed(() => emp.score))
  );
})));

// pagination / filter change -> rows are dropped
employees.set(nextPage);
```

For every removed row, `employees.set(nextPage)` releases:

| Released | How |
|---|---|
| `effect()` runs | the effect's own `dispose()` is called |
| `computed()` values | unsubscribed from all dependencies |
| state subscriptions | attribute, `class`, `bind`, style and text bindings |
| event listeners | `removeEventListener` for every `on*` handler |
| state containers | text/element nodes and `StyleState` containers detached |

The scope is opened by `loop()` itself — keyed removal, item swap under the same key, classic refresh, and `removeAt()` all need no extra code. State created outside a `loop()` is never registered in a scope. The same teardown runs wherever a subtree is genuinely dropped: `empty()`, `ifElse()` branch swaps, and `Jetz.unmount(container)`.

Measured on the bundled stress test (80 page swaps x 500 rows): heap growth dropped from 302.68 MB to 15.10 MB; row states still pinning a DOM node dropped from 40,500 to 500.

> Teardown is deliberately **not** wired into `element.remove()`: `_if`/`_else` remove a node only to re-insert the same node later, so releasing bindings there would break them. The reconciler knows which views are really gone.

## Manual Cleanup (`disposeBindings`)

For cases the reconciler cannot see — a dialog you close yourself, a widget you re-create, a subtree you move elsewhere:

```javascript
import { Jetz, div, span, button } from "@daevsoft/jetz";

const panel = div(span("Live region"), button("Close", {
  onclick: () => {
    panel.disposeBindings(); // subscriptions, computed, listeners, containers
    panel.remove();          // then detach the node
  }
}));

// Or let unmount do both for a whole container:
Jetz.unmount("#app");
```

After `disposeBindings()` the state no longer writes into the detached nodes, and a later `setState()` cannot resurrect them:

```javascript
const label = stateOf("before");
const box = div(span(label));
Jetz.mount(box, "#app");

box.o.querySelector("span").textContent; // "before"

box.disposeBindings();
label.setState("after");
box.o.querySelector("span").textContent; // still "before" - no live binding left
```

`disposeBindings()` is idempotent.
