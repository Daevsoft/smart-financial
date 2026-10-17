# Jetz Core Concepts

Detailed patterns for element composition, components, reactivity, lists, conditionals, lifecycle, binding, and DOM utilities. Imports are from `@daevsoft/jetz` (core) and `@daevsoft/jetz/ui` (elements, `css`, `style`, `find`).

## 1. Elements & UI Composition

Every HTML5 element is exported as a composable function from `@daevsoft/jetz/ui`:

```javascript
import { div, h1, p, span, button, a, img, css } from "@daevsoft/jetz/ui";

const Banner = div(
  h1("Fast, Declarative UI"),
  p("Composable JavaScript functions represent elements:"),
  span("No templates. No JSX."),
  button("Get Started", { onclick: () => alert("Welcome!") })
);
```

Arguments in any natural order:

- **Strings & Numbers:** rendered as child text nodes.
- **Child Elements:** appended directly into the parent.
- **Objects:** attributes, properties, or event handlers.
- **CSS helpers:** `` css`class-name` ``, reactive `css(() => …)`, style objects, or a css block via `` style`…` ``.
- **Reactive States:** automatically bind their text content.

```javascript
div(
  css`card active`,               // classes
  { id: "hero", role: "banner" }, // attributes
  h2("Title"),                    // child element
  "Text content"                  // text node
)
```

### Reactive tag templates

Every element factory doubles as a tagged template. Interpolated **functions** are evaluated as reactive text and re-render whenever a state they read changes:

```javascript
const stateOnline = stateOf(true);

div`Is Online : ${() => stateOnline.value ? "Yes" : "No"}`;
span`Hello ${username}!`; // states can be interpolated directly
```

Components and static values work as children too: ``div`Status: ${Badge}``` renders the badge element.

> The same code written as a plain (untagged) template literal cannot work: JavaScript flattens the interpolated function to its source text before Jetz sees it. With `Jetz.devtools = true`, Jetz warns when a text child looks like a stringified function and points at the tagged form. The `text` tag behaves the same way: `div(text`Count : ${() => count.value}`)`.

## 2. Components (Functions & Classes)

### A. Function components (recommended)

```javascript
import { div, h3, p, css } from "@daevsoft/jetz/ui";

export function UserCard(name, role) {
  return div(css`user-card`, h3(name), p(role));
}

// Direct call: ordinary JavaScript, no lifecycle:
const Page = div(
  UserCard("Alice", "Frontend Engineer"),
  UserCard("Bob", "Product Designer")
);
```

Calling `UserCard(...)` is an ordinary JavaScript call — fine for simple element builders, but the call gets no lifecycle. To let Jetz invoke a child component, pass the function reference: `div(UserCard)`. That form takes no arguments, so use a small wrapper when the child needs values:

```javascript
import { stateOf } from "@daevsoft/jetz";
import { div, inputText, p } from "@daevsoft/jetz/ui";

function Greeting({ name }) {
  return p("Hello, ", name);
}

const name = stateOf("Ada");
const GreetingForUser = () => Greeting({ name });

const Page = div(
  inputText({ bind: name }),
  GreetingForUser
);
```

Jetz invokes `GreetingForUser` as the child component; because `name` is a State, the greeting updates when the input changes. Put lifecycle hooks in the function Jetz invokes (here `GreetingForUser`). Do not write `div(Greeting(name.value))` if you need a child lifecycle. Routed function components are different: the router passes route parameters to the function directly.

### B. Class components

```javascript
import { Component, stateOf } from "@daevsoft/jetz";
import { div, button } from "@daevsoft/jetz/ui";

export class CounterComponent extends Component {
  count = stateOf(0);

  increment() {
    this.count.value++;
  }

  render() {
    return div(
      button("Clicked: ", this.count, {
        onclick: () => this.increment() // arrow function preserves `this`
      })
    );
  }
}

// Instantiate with `new` or `.new()`:
const App = div(new CounterComponent(), CounterComponent.new());
```

## 3. Reactive State (`stateOf`, `rememberOf`)

```javascript
import { stateOf } from "@daevsoft/jetz";

const counter = stateOf(0);

counter.value;          // 0 — read
counter.value = 10;     // write; updates bound UI
counter.setState(20);   // same as counter.value = 20

const unsubscribe = counter.subscribe((newValue, oldValue) => {
  console.log(`Changed from ${oldValue} to ${newValue}`);
});
```

Object properties are reactive states too:

```javascript
const profile = stateOf({ name: "Ada" });
profile.name.value = "Grace";
```

### Batching

Use `batch(fn)` when one action updates multiple related states. Values are readable immediately inside the callback; computeds, effects, subscribers, and bound DOM update when the outermost batch finishes. Keep the callback synchronous.

```javascript
import { batch, computed, effect, stateOf } from "@daevsoft/jetz";

const firstName = stateOf("Ada");
const lastName = stateOf("Lovelace");
const fullName = computed(() => `${firstName.value} ${lastName.value}`);

effect(() => console.log(`Profile name: ${fullName.value}`));

// Without batch() the effect would emit "Augusta Lovelace" then "Augusta King".
batch(() => {
  firstName.value = "Augusta";
  lastName.value = "King";
});
// The effect emits only "Augusta King".
```

### Persisting with `rememberOf`

`rememberOf(key, initialValue)` works like `stateOf` but synchronizes supported updates to `localStorage` and restores them on refresh. Keys should stay stable between visits; values are scoped to the current page path.

```javascript
import { rememberOf } from "@daevsoft/jetz";

const theme = rememberOf("theme", "light");
theme.value = "dark"; // automatically saved

const recentSearches = rememberOf("searches", []);
recentSearches.push("JavaScript"); // persisted
```

For remembered arrays, `push()`, `set()`, and `clear()` save automatically. Other mutations update the UI but do not write to storage — persist a removal or transform with `set()`:

```javascript
recentSearches.set(recentSearches.values.filter(item => item !== "JavaScript"));
```

Store JSON-serializable data; save plain data and recreate reactive item states when loading.

## 4. Computed State (`computed`)

`computed(fn)` auto-tracks its dependencies and re-evaluates when any of them change:

```javascript
import { stateOf, computed } from "@daevsoft/jetz";
import { div, span, inputText } from "@daevsoft/jetz/ui";

const firstName = stateOf("Ada");
const lastName = stateOf("Lovelace");

const fullName = computed(() => `${firstName.value} ${lastName.value}`);

const UserProfile = div(
  span("Full Name: ", fullName),
  inputText({ bind: firstName, placeholder: "First name" }),
  inputText({ bind: lastName, placeholder: "Last name" })
);
```

Computed states chain like normal states:

```javascript
const price = stateOf(100);
const qty = stateOf(2);

const subtotal = computed(() => price.value * qty.value);
const tax = computed(() => subtotal.value * 0.1);
const grandTotal = computed(() => subtotal.value + tax.value);
```

`computed()` should return a primitive. `stateOf()` walks array/object arguments and would rewrite the values handed to it — derive a scalar with `computed()` and push lists through `list.set()`.

### Reactive classes with `css`

Use a callback interpolation when part of a class depends on state; the callback must read `.value`:

```javascript
import { listOf, loop, stateOf } from "@daevsoft/jetz";
import { css, li, ul } from "@daevsoft/jetz/ui";

const tasks = listOf(
  stateOf({ id: 201, done: true, title: "Sketch the onboarding flow" }),
  stateOf({ id: 202, done: false, title: "Review the component API" })
);

const TaskList = ul(loop(tasks, task => li(
  css`task-number ${() => task.done.value ? "completed" : ""}`,
  task.title
)));
```

A plain ternary such as `${task.done ? "completed" : ""}` is evaluated before `css` receives it (the State object is truthy) and is not reactive. Equivalent alternative: interpolate `computed(() => task.done.value ? "completed" : "")` — create the computed inside the `loop()` renderer so each row closes over its own task. Static classes remain ordinary tagged templates: `` css`task-number completed` ``.

### Reactive styles with `style`

`style` accepts three forms: an object of properties, a tagged template holding a css declaration block, or a callback/State producing either. Interpolations stay reactive per-property.

```javascript
import { stateOf } from "@daevsoft/jetz";
import { div, style } from "@daevsoft/jetz/ui";

div(style({ color: "crimson", "max-width": "400px" }));

div(
  style`
    max-width: 400px;
    margin: 30px auto;
    padding: 20px;
    border: 1px solid #e2e8f0;
  `,
  "Card content"
);

const accent = stateOf("#334155");
const Panel = div(style`color: ${() => accent.value}; padding: 20px;`, "Panel");
accent.value = "#dc2626"; // only the color declaration updates

const theme = stateOf("background: #fff; color: #111;");
div(style(theme)); // a State holding the whole block works too
```

Malformed declarations are skipped; `null`/`false` interpolations contribute nothing.

### Reactive attributes

Attribute helpers keep `State` values instead of converting to strings early. Callbacks passed to attributes or style properties are tracked via their `.value` reads:

```javascript
import { stateOf } from "@daevsoft/jetz";
import { a, aria_, data_, button, href, style } from "@daevsoft/jetz/ui";

const destination = stateOf("/tasks");
const saving = stateOf(false);
const color = stateOf("crimson");

const Link = a(href(destination), "Tasks");
const SaveButton = button({ disabled: saving }, "Save");
const Status = a(
  aria_({ busy: saving }),
  data_({ destination }),
  { title: () => `Open ${destination.value}` },
  "Status"
);
const Swatch = a(style({ color: () => color.value }), "Preview");
```

HTML boolean attributes like `disabled` are added for `true` and removed for `false`. `aria-*` and `data-*` values stay strings, so `false` becomes `"false"` rather than removing the attribute.

## 5. Side-Effects (`effect`)

`effect(fn)` runs immediately, auto-discovers dependencies by intercepting `.value` reads, re-executes on change, and returns a `dispose` function. Tracking is dynamic — only states read during the current run are tracked:

```javascript
import { stateOf, effect } from "@daevsoft/jetz";

const counter = stateOf(0);
const dispose = effect(() => {
  document.title = `Count: ${counter.value}`;
});

const loggingEnabled = stateOf(true);
const status = stateOf("idle");

effect(() => {
  if (loggingEnabled.value) {
    console.log("Current status:", status.value); // tracked only when enabled
  }
});

dispose(); // clean up when no longer needed
```

An `effect()` created inside a `loop()` item is disposed automatically when that row leaves the DOM (see `references/scaling.md`).

## 6. Reactive Collections (`listOf`, `sequenceOf`)

```javascript
import { listOf, loop } from "@daevsoft/jetz";
import { ul, li } from "@daevsoft/jetz/ui";

const todos = listOf("Learn Jetz", "Build an App");
const TodoList = ul(loop(todos, todo => li(todo)));

todos.push("Test the app");
todos.remove("Build an App");
todos.set(["Ship the feature"]);
```

Use `push()` to append, `insertAt()` at a position, `remove()`/`removeAt()` to delete, `set()` to replace all items (after filtering or loading). Use `sequenceOf()` when duplicate primitive values must remain distinct, or call `asUnique()` on an existing list.

`asRemember(key)` marks an existing `ListState` as restored from and saved to `localStorage` (use a stable key); `rememberOf(key, initial)` creates a remembered value directly:

```javascript
const selectedTags = listOf("news", "news").asUnique();
const recentSearches = listOf().asRemember("recent-searches");
recentSearches.push("Jetz"); // saved to localStorage
```

### Complete `ListState` API

| Method / Property | Description |
|---|---|
| `list.push(...items)` | Append one or more items and update rendered lists |
| `list.set(newArray)` | Replace all items; chainable |
| `list.replaceAt(index, item)` | Replace one item; chainable |
| `list.updateAt(index, updater)` | Replace one item using its current value; chainable |
| `list.map(fn)` | Return a new array of mapped values without changing the list |
| `list.transform(fn)` | Replace each item with the callback result and update views |
| `list.insertAt(index, ...items)` | Insert items at an index |
| `list.remove(item)` | Remove the first matching item |
| `list.removeAt(index)` | Remove the item at an index |
| `list.sort((a, b) => ...)` | Sort in place; chainable |
| `list.filter(predicate)` | Return a plain array without changing the list |
| `list.clear()` | Empty the collection |
| `list.asUnique()` | Make duplicate string/number values distinct entries; chainable |
| `list.asRemember(key?)` | Restore and persist the list with an optional stable key; chainable |
| `list.size` | Item count |
| `list.values` | Direct reference to underlying array |
| `list.first()` / `list.last()` | Boundary accessors |

`map()` follows standard array behavior (returns a new array); use `transform()` to replace items and update views. Avoid editing `list.values` directly — rendered lists and array slots fall out of sync. Remembered lists persist changes made through mutation methods and reactive child states; direct `values` edits bypass that synchronization.

## 7. Keyed List Reconciliation (`loop`)

The 3-argument form recycles DOM elements per key — one modified item re-renders only that item:

```javascript
import { listOf, loop } from "@daevsoft/jetz";
import { ul, li } from "@daevsoft/jetz/ui";

const users = listOf(
  { id: 101, name: "Alice" },
  { id: 102, name: "Bob" }
);

const UserList = ul(
  loop(
    users,
    user => user.id,        // key selector: unique identifier
    user => li(user.name)   // render function
  )
);
```

The classic 2-argument `loop(list, renderFn)` remains available. `loop()` also owns each item's lifecycle: every `effect()`, `computed()`, subscription and listener created while an item renders is released when the reconciler drops that view.

## 8. Conditional Rendering

### Multi-branch (`_if`, `_elseif`, `_else`)

```javascript
import { stateOf, _if, _elseif, _else } from "@daevsoft/jetz";
import { div, button } from "@daevsoft/jetz/ui";

const tab = stateOf("home");

const Content = div(
  div(_if(() => tab.value === "home"), "Welcome to the Homepage"),
  div(_elseif(() => tab.value === "profile"), "Your Profile Details"),
  div(_else, "Page Not Found"),

  button("Switch", {
    onclick: () => tab.setState(tab.value === "home" ? "profile" : "home")
  })
);
```

### Inline two-branch (`ifElse`)

```javascript
import { stateOf, ifElse } from "@daevsoft/jetz";
import { div, span, button } from "@daevsoft/jetz/ui";

const isLoggedIn = stateOf(false);

const Nav = div(
  ifElse(
    () => isLoggedIn.value,
    () => span("Welcome back!"),
    () => button("Log In", { onclick: () => isLoggedIn.setState(true) })
  )
);
```

## 9. Component Lifecycle

```text
onCreate   ──►   onMount   ──►   onUpdate   ──►   onDestroy
(before DOM)     (in DOM)        (state delta)    (removed)
```

| Hook | Timing & Purpose |
|---|---|
| `onCreate` | Once before rendering. Initialize local variables, prepare state. |
| `onMount` | Once after DOM attachment. Safe to touch DOM, start timers, fetch. |
| `onUpdate` | Whenever a bound state changes while the component is active. |
| `onDestroy` | On DOM removal (route change, conditional removal, list delete, `unmount`). Clear timers and subscriptions. |

Every component Jetz invokes has its own lifecycle context, including nested and routed components. Lifecycle **methods** are only called on class components; function components use the imported hook functions.

### Function component

```javascript
import { onCreate, onMount, onUpdate, onDestroy, stateOf } from "@daevsoft/jetz";
import { div } from "@daevsoft/jetz/ui";

export function LiveClock() {
  const time = stateOf(new Date().toLocaleTimeString());
  let intervalId;

  onCreate(() => console.log("Clock initializing..."));

  onMount(() => {
    intervalId = setInterval(() => {
      time.setState(new Date().toLocaleTimeString());
    }, 1000);
  });

  onUpdate(() => console.log("Clock updated to:", time.value));

  onDestroy(() => {
    clearInterval(intervalId);
    console.log("Clock cleaned up.");
  });

  return div("Current Time: ", time);
}
```

### Class component

```javascript
import { Component, stateOf } from "@daevsoft/jetz";
import { div } from "@daevsoft/jetz/ui";

export class LiveClockClass extends Component {
  time = stateOf("");
  intervalId = null;

  onMount() {
    this.intervalId = setInterval(() => {
      this.time.value = new Date().toLocaleTimeString();
    }, 1000);
  }

  onDestroy() {
    clearInterval(this.intervalId);
  }

  render() {
    return div("Time: ", this.time);
  }
}
```

## 10. Two-Way Data Binding (`bind`)

```javascript
import { stateOf } from "@daevsoft/jetz";
import { div, inputText, p } from "@daevsoft/jetz/ui";

const query = stateOf("");

const SearchBox = div(
  inputText({
    bind: query, // updates query.value on user input
    placeholder: "Search documentation..."
  }),
  p("Searching for: ", query)
);
```

Typing updates `query.value` immediately; setting `query.value` updates the input display.

### When a binding fails

A `bind` target must be a reactive state. When it is not — often because a list item is missing the field its template binds — Jetz throws a `JetzBindingError` naming the element, what it received, and the item/template to fix, instead of `Cannot read properties of undefined (reading 'value')`:

```text
Jetz: `bind` on <input type="checkbox"> expected a state but received undefined.

A `bind` target has to come from stateOf(), computed() or rememberOf().

`undefined` usually means the state object is missing that field, e.g.
    stateOf({ id, title })                // then `bind: task.done` reads undefined
    stateOf({ id, done: false, title })   // give every bound field a value

While rendering the list item at index 0 (key 201).
The item template binds:
    task => li(input(type`checkbox`, { bind: task.done }))
```

The error stays a `TypeError`, so existing `try/catch` blocks keep working. Outside a `loop()` there is no item template to quote; set `Jetz.devtools = true` to also include the stack frame that built the element (off by default — it captures a stack per element, measurable on large lists).

## 11. Reactive Listeners (`listen`)

`listen(callback)` registers an inline reactive effect tied to an element — renders nothing itself, runs once on mount and on every state change:

```javascript
import { stateOf, listen } from "@daevsoft/jetz";
import { div, button } from "@daevsoft/jetz/ui";

const count = stateOf(0);

const Box = div(
  "Current count: ", count,
  // Updates the parent div's CSS class as state changes:
  listen(parent => {
    parent.replaceClass(/count-\d+/, `count-${count.value}`);
  }),
  button("+1", { onclick: () => count.value++ })
);
```

## 12. DOM Utilities & Helper Methods

Every `JetzElement` wraps an `HTMLElement` with a fluent chainable API, before and after mounting:

```javascript
import { div, find, findAll } from "@daevsoft/jetz/ui";

const box = div("Hello World", { "data-role": "card" });

// Attributes & Data
box.attr("data-role");              // read attribute
box.addAttr("title", "Greetings");  // set attribute
box.removeAttr("title");            // remove attribute
box.data("role");                   // read data-* property

// Styling & Classes
box.setStyle({ color: "blue" });    // inline styles
box.getStyle("color");
box.addClass("active");
box.removeClass("active");
box.toggleClass("active");
box.replaceClass("active", "idle");

// DOM Tree & State
box.text("Updated Text");           // replace text content
box.disable(); box.enable();
box.focus(); box.blur();
box.empty();                        // remove all children
box.remove();                       // remove from DOM

// Global finders
const header = find("#main-header");   // HTMLElement
const items = findAll(".list-item");   // Array<HTMLElement>
```
