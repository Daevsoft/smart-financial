import { onDestroy, onMount } from "@daevsoft/jetz";
import { a, button, css, div, footer, header, h1, iframe, img, label, option, p, section, select, span } from "@daevsoft/jetz/ui";
import logoUrl from "../public/img/logo/small.png";
import "./playground.css";

const examples = {
  counter: {
    label: "Reactive counter",
    concept: "stateOf · direct DOM updates",
    source: `import { Jetz, stateOf } from "@daevsoft/jetz";
import { button, css, div, h2, p } from "@daevsoft/jetz/ui";

const count = stateOf(0);

Jetz.mount(
  div(css\`preview-card\`,
    p(css\`preview-eyebrow\`, "REACTIVE STATE"),
    h2("A counter, no re-render loop"),
    p(css\`preview-count\`, "Clicks: ", count),
    button("Increment", {
      onclick: () => count.value++
    })
  ),
  "#app"
);`,
  },
  computed: {
    label: "Computed values",
    concept: "computed · two-way binding",
    source: `import { Jetz, computed, stateOf } from "@daevsoft/jetz";
import { css, div, h2, inputText, p } from "@daevsoft/jetz/ui";

const firstName = stateOf("Ada");
const lastName = stateOf("Lovelace");
const fullName = computed(() =>
  \`\${firstName.value} \${lastName.value}\`
);

Jetz.mount(
  div(css\`preview-card\`,
    p(css\`preview-eyebrow\`, "DERIVED STATE"),
    h2("Update either field"),
    inputText({ bind: firstName, placeholder: "First name" }),
    inputText({ bind: lastName, placeholder: "Last name" }),
    p(css\`preview-result\`, "Hello, ", fullName)
  ),
  "#app"
);`,
  },
  lists: {
    label: "Reactive collections",
    concept: "listOf · collection mutations",
    source: `import { Jetz, listOf } from "@daevsoft/jetz";
import { button, css, div, h2, li, p, ul } from "@daevsoft/jetz/ui";

const tasks = listOf("Read the quick start", "Build a tiny app");

Jetz.mount(
  div(css\`preview-card\`,
    p(css\`preview-eyebrow\`, "REACTIVE COLLECTION"),
    h2("A list that stays in sync"),
    ul(css\`preview-list\`, tasks.map(task => li(task))),
    button("Add a task", {
      onclick: () => tasks.push(\`New task \${tasks.size + 1}\`)
    })
  ),
  "#app"
);`,
  },
  keyed: {
    label: "Keyed list rendering",
    concept: "listOf · loop · stable item identity",
    source: `import { Jetz, listOf, loop } from "@daevsoft/jetz";
import { button, css, div, h2, li, p, ul } from "@daevsoft/jetz/ui";

const users = listOf(
  { id: 101, name: "Ada Lovelace" },
  { id: 102, name: "Grace Hopper" }
);
let nextId = 103;

Jetz.mount(
  div(css\`preview-card\`,
    p(css\`preview-eyebrow\`, "KEYED RECONCILIATION"),
    h2("Stable identity, focused updates"),
    ul(css\`preview-list\`, loop(
      users,
      user => user.id,
      user => li(user.name)
    )),
    button("Add a person", {
      onclick: () => users.push({
        id: nextId++, 
        name: \`New person \${nextId - 1}\`
     })
    })
  ),
  "#app"
);`,
  },
  editableTasks: {
    label: "Editable keyed tasks",
    concept: "listOf · stateOf items · loop · bind",
    source: `import { Jetz, listOf, loop, stateOf } from "@daevsoft/jetz";
import { button, css, div, h2, inputText, li, p, ul, input, type } from "@daevsoft/jetz/ui";

const tasks = listOf(
  stateOf({ id: 201, done: true, title: "Sketch the onboarding flow" }),
  stateOf({ id: 202, done: false, title: "Review the component API" })
);
let nextId = 203;

Jetz.mount(
  div(css\`preview-card\`,
    p(css\`preview-eyebrow\`, "EDITABLE KEYED ITEMS"),
    h2("A tiny project task list"),
    p("Edit each title in place, then add another task."),
    ul(css\`preview-list task-list\`, loop(
      tasks,
      task => task.id.value,
      task => li(css\`task-row\`,
        div(
        input(type\`checkbox\`, { bind: task.done }),
        p(css\`task-number \$\{task.done ? 'completed' : ''\}\`, "TASK ", task.id, ' - ', task.title),
        ),
        inputText({
          bind: task.title,
          placeholder: "Task title"
        })
      )
    )),
    button("Add a task", {
      onclick: () => tasks.push(stateOf({
        id: nextId++,
        title: \`New task \${nextId - 1}\`
      }))
    })
  ),
  "#app"
);`,
  },
  conditional: {
    label: "Conditional UI",
    concept: "stateOf · _if / _else",
    source: `import { Jetz, _else, _if, stateOf } from "@daevsoft/jetz";
import { button, css, div, h2, p } from "@daevsoft/jetz/ui";

const isOnline = stateOf(false);

Jetz.mount(
  div(css\`preview-card\`,
    p(css\`preview-eyebrow\`, "CONDITIONAL RENDERING"),
    h2("Render the active branch"),
    div(_if(() => isOnline.value),
      p(css\`preview-status online\`, "You are online")
    ),
    div(_else,
      p(css\`preview-status offline\`, "You are offline")
    ),
    button("Toggle status", {
      onclick: () => isOnline.value = !isOnline.value
    })
  ),
  "#app"
);`,
  },
  remembered: {
    label: "Persistent state",
    concept: "rememberOf · localStorage",
    source: `import { Jetz, rememberOf } from "@daevsoft/jetz";
import { css, div, h2, inputText, p } from "@daevsoft/jetz/ui";

const name = rememberOf("jetz-playground-name", "Developer");

Jetz.mount(
  div(css\`preview-card\`,
    p(css\`preview-eyebrow\`, "PERSISTED STATE"),
    h2("Your value survives refresh"),
    inputText({ bind: name, placeholder: "Your name" }),
    p(css\`preview-result\`, "Welcome back, ", name)
  ),
  "#app"
);`,
  },
};

const importMap = JSON.stringify({
  imports: {
    "@daevsoft/jetz": "https://esm.sh/@daevsoft/jetz@1.0.1",
    "@daevsoft/jetz/ui": "https://esm.sh/@daevsoft/jetz@1.0.1/ui",
  },
});

function createPreviewDocument(source) {
  const safeSource = JSON.stringify(source).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; color: #16344d; background: #f3f7fa; font: 14px/1.55 system-ui, sans-serif; }
    .preview-card { max-width: 520px; margin: 24px auto; padding: 26px; background: white; border: 1px solid #d7e3eb; border-radius: 7px; box-shadow: 0 14px 36px #16344d12; }
    .preview-eyebrow { margin: 0 0 12px; color: #218bc4; font: 10px ui-monospace, monospace; letter-spacing: .08em; }
    h2 { margin: 0 0 18px; font-size: 21px; line-height: 1.25; }
    .preview-count { margin: 0 0 17px; color: #1d628e; font-size: 30px; font-weight: 700; }
    .preview-result { margin: 16px 0 0; color: #1d628e; font-weight: 700; }
    input { display: block; width: 100%; margin: 9px 0; padding: 10px 11px; border: 1px solid #c6d6e0; border-radius: 4px; font: inherit; }
    button { padding: 10px 14px; border: 0; border-radius: 4px; background: #228bc3; color: white; font: 600 13px system-ui, sans-serif; cursor: pointer; }
    button:hover { background: #176b9a; }
    .preview-list { display: grid; gap: 9px; margin: 0 0 18px; padding-left: 20px; color: #526d80; }
    .preview-status { margin: 0 0 17px; padding: 12px; border-radius: 4px; }
    .online { color: #135f76; background: #e0f4fa; }
    .offline { color: #526d80; background: #edf2f5; }
    #preview-error { color: #9c2f42; font: 12px/1.5 ui-monospace, monospace; white-space: pre-wrap; }
  </style>
  <script type="importmap">${importMap}</script>
</head>
<body>
  <div id="app"></div>
  <p id="preview-error">Loading Jetz preview…</p>
  <script>
    addEventListener("error", event => {
      const output = document.getElementById("preview-error");
      if (output) output.textContent = event.message || "Preview error";
    });
    addEventListener("unhandledrejection", event => {
      const output = document.getElementById("preview-error");
      if (output) output.textContent = event.reason?.message || String(event.reason);
    });
  </script>
  <script type="module">
    const source = ${safeSource};
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    import(url).then(() => {
      document.getElementById("preview-error")?.remove();
    }).catch(error => {
      document.getElementById("preview-error").textContent = error.message;
    });
  </script>
</body>
</html>`;
}

export const Playground = () => {
  let editor;
  let isActive = true;
  let selectedExample = "counter";

  const preview = source => {
    const frame = document.getElementById("playground-preview");
    if (frame) frame.srcdoc = createPreviewDocument(source);
    const status = document.getElementById("playground-status");
    if (status) status.textContent = "Running in an isolated preview";
  };

  const setExample = key => {
    selectedExample = key;
    const example = examples[key];
    if (editor) editor.setValue(example.source);
    preview(example.source);
    const concept = document.getElementById("playground-concept");
    if (concept) concept.textContent = example.concept;
  };

  const MonacoRuntime = () => {
    let resizeFrame = 0;
    const resizeEditor = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => editor?.layout());
    };

    onMount(() => {
    import("monaco-editor").then(monaco => {
      if (!isActive) return;
      const container = document.getElementById("playground-editor");
      if (!container) return;
      container.replaceChildren();
      monaco.editor.defineTheme("jetz-blue", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "keyword", foreground: "71c7f2" },
          { token: "string", foreground: "b8d9a9" },
          { token: "number", foreground: "f4c27a" },
        ],
        colors: {
          "editor.background": "#102f46",
          "editor.foreground": "#d7e7f0",
          "editorLineNumber.foreground": "#607b8d",
          "editorLineNumber.activeForeground": "#a8c3d2",
          "editorCursor.foreground": "#43b4eb",
          "editor.selectionBackground": "#245573",
          "editor.inactiveSelectionBackground": "#1e465f",
          "editorIndentGuide.background": "#25465a",
        },
      });
      editor = monaco.editor.create(container, {
        value: examples[selectedExample].source,
        language: "javascript",
        theme: "jetz-blue",
        automaticLayout: false,
        minimap: { enabled: false },
        fontFamily: "'DM Mono', Consolas, monospace",
        fontSize: 13,
        lineHeight: 22,
        tabSize: 2,
        scrollBeyondLastLine: false,
        wordWrap: "off",
        scrollbar: {
          horizontal: "auto",
          horizontalScrollbarSize: 12,
          vertical: "auto",
        },
        padding: { top: 18, bottom: 20 },
        ariaLabel: "Jetz code playground editor",
      });
      window.addEventListener("resize", resizeEditor, { passive: true });
      resizeEditor();
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => preview(editor.getValue()));
      setExample(selectedExample);
    }).catch(error => {
      const container = document.getElementById("playground-editor");
      if (container) container.textContent = `Editor failed to load: ${error.message}`;
    });
    preview(examples[selectedExample].source);
    });

    onDestroy(() => {
      isActive = false;
      window.removeEventListener("resize", resizeEditor);
      cancelAnimationFrame(resizeFrame);
      editor?.dispose();
    });

    return div({ id: "playground-editor", class: "monaco-host" }, "Loading Monaco Editor…");
  };

  return div(css`playground-shell`,
    header(css`playground-header`,
      a(css`playground-brand`, { href: "/", "aria-label": "Back to Jetz home" },
        img({ src: logoUrl, alt: "Jetz", class: "playground-logo" }),
        span("Playground"),
      ),
      div(css`playground-controls`,
        label({ for: "playground-example" }, "EXAMPLE"),
        select({
          id: "playground-example",
          "aria-label": "Choose a Jetz example",
          value: selectedExample,
          onchange: event => setExample(event.target.value),
        },
          ...Object.entries(examples).map(([key, example]) => option({ value: key }, example.label)),
        ),
      ),
      button(css`run-button`, { onclick: () => preview(editor?.getValue() ?? examples[selectedExample].source) },
        span(css`run-icon`, "▶"), "Run preview",
      ),
      a(css`home-link`, { href: "/" }, "Back to home"),
    ),
    div(css`playground-intro`,
      h1("Learn by changing the code."),
      p("Pick a README feature, edit the example, and run it in an isolated preview."),
    ),
    div(css`playground-workbench`,
      section(css`editor-pane`, { "aria-label": "Code editor" },
        div(css`pane-toolbar`,
          div(css`file-tab`, span(css`file-type`, "JS"), span("main.js")),
          span({ id: "playground-concept" }, examples.counter.concept),
        ),
        MonacoRuntime,
        div(css`editor-footer`,
          span(css`editor-status-dot`),
          span("JavaScript · Jetz 1.0"),
          span("Ctrl / ⌘ + Enter to run"),
        ),
      ),
      section(css`preview-pane`, { "aria-label": "Live preview" },
        div(css`pane-toolbar preview-toolbar`,
          div(css`preview-heading`, span(css`preview-dot`), span("LIVE PREVIEW")),
          span({ id: "playground-status" }, "Ready"),
        ),
        iframe({
          id: "playground-preview",
          title: "Jetz code preview",
          sandbox: "allow-scripts",
          class: "preview-frame",
        }),
        div(css`preview-note`, span("↗"), "Preview runs in a sandboxed frame"),
      ),
    ),
    footer(css`playground-footer`,
      span("Explore more in the README"),
      a({ href: "https://github.com/devarofi/jetz#core-concepts" }, "Core concepts ↗"),
      a({ href: "https://github.com/devarofi/jetz#application-features" }, "Application features ↗"),
    ),
  );
};