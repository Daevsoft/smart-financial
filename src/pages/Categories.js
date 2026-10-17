import { stateOf, computed, batch, onMount, onDestroy, loop } from "@daevsoft/jetz";
import { div, p, span, button, label, inputText, inputNumber, select, option, input } from "@daevsoft/jetz/ui";
import { css } from "@daevsoft/jetz/ui";
import { dispatcher, Actions, categories } from "../state/store.js";
import { catCount, catUsage } from "../state/transactions.js";
import { fmt } from "../state/preferences.js";
import { scrollLock } from "../state/ui.js";
import { t, tt } from "../state/i18n.js";
import { Icon, UI, CategoryIcon, CATEGORY_ICONS } from "../components/icons.js";

// Human labels for the Tabler icon keys in src/data/categories.json.
const ICON_LABELS = {
  briefcase: "Briefcase",
  "tools-kitchen-2": "Food",
  "shopping-cart": "Cart",
  car: "Car",
  movie: "Movie",
  "receipt-2": "Receipt",
  pill: "Health",
  package: "Package",
};

const SWATCHES = ["#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444", "#ec4899", "#a855f7", "#3b82f6", "#06b6d4", "#94a3b8"];

// Slug used for new category ids; keeps ids unique so lookups stay stable.
function uniqueId(name) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "category";
  let id = base;
  for (let n = 2; categories.values.some(c => c.id === id); n++) id = `${base}-${n}`;
  return id;
}

// Same-type category a deleted category's transactions move to (mirrors the
// fallback logic in store.js CAT_DELETE) — used only for the confirm text.
function deleteFallback(cat) {
  const rest = categories.values.filter(c => c.id !== cat.id && c.type === cat.type);
  return rest.find(c => c.id === "other") || rest[0] || null;
}

// Modal form for create/edit, same pattern as TransactionForm: the page owns
// `open`/`editing`, the form fills itself from `editing` on every open.
function CategoryForm({ open, editing, onClose }) {
  const name = stateOf("");
  const type = stateOf("expense");
  const color = stateOf("#22c55e");
  const icon = stateOf("package");
  const budget = stateOf("");
  const error = stateOf("");

  const fill = () => {
    const c = editing.value;
    batch(() => {
      name.value = c ? c.name : "";
      type.value = c ? c.type : "expense";
      color.value = c ? c.color : "#22c55e";
      icon.value = c ? c.icon : "package";
      budget.value = c && c.budget ? String(c.budget) : "";
      error.value = "";
    });
  };

  const close = () => {
    error.value = "";
    onClose();
  };

  const submit = () => {
    const nm = name.value.trim();
    if (!nm) return (error.value = t("nameRequired"));
    const dupe = categories.values.some(
      c => c.id !== editing.value?.id && c.name.toLowerCase() === nm.toLowerCase()
    );
    if (dupe) return (error.value = t("nameTaken"));
    const amt = parseFloat(budget.value);
    const base = {
      name: nm,
      type: type.value,
      color: color.value,
      icon: icon.value,
      // Budgets only make sense for expense categories; income keeps 0.
      budget: type.value === "expense" && Number.isFinite(amt) ? Math.max(Math.round(amt * 100) / 100, 0) : 0,
    };
    const existing = editing.value;
    if (existing) dispatcher.dispatch(Actions.CAT_UPDATE, { id: existing.id, ...base });
    else dispatcher.dispatch(Actions.CAT_ADD, { id: uniqueId(nm), ...base });
    close();
  };

  const iconSelect = select(
    { class: "input", onchange: e => (icon.value = e.target.value) },
    Object.entries(ICON_LABELS).map(([key, lbl]) => option({ value: key }, lbl))
  );
  const colorInput = input({
    type: "color",
    class: "h-10 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900",
    oninput: e => (color.value = e.target.value),
  });

  // Fill on open; sync the two non-bound controls via targeted subscriptions
  // (listen() would loop because fill() writes states).
  open.subscribe(() => {
    if (open.value) fill();
    scrollLock(open.value);
  });
  onDestroy(() => {
    if (open.value) scrollLock(false);
  });
  const syncControls = () => {
    if (iconSelect.o) iconSelect.o.value = icon.value;
    if (colorInput.o) colorInput.o.value = color.value;
  };
  icon.subscribe(syncControls);
  color.subscribe(syncControls);
  onMount(syncControls);

  return div(
    { class: () => `fixed inset-0 z-50 flex items-end justify-center transition-all duration-200 sm:items-center sm:p-4 ${open.value ? "visible" : "invisible pointer-events-none"}` },
    div({ class: () => `absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200 ${open.value ? "opacity-100" : "opacity-0"}`, onclick: close }),
    div(
      { class: () => `card sheet relative max-h-[92dvh] w-full space-y-4 overflow-y-auto rounded-b-none transition-all duration-200 sm:max-w-lg sm:rounded-2xl ${open.value ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0 sm:translate-y-3 sm:scale-95"}` },
      div(
        css`flex items-center justify-between`,
        div(css`text-base font-bold text-slate-900 dark:text-white`,
          computed(() => (editing.value ? t("editCategory") : t("newCategory")))),
        button({ class: "btn btn-ghost px-2 py-2", "aria-label": () => t("close"), onclick: close }, Icon(UI.close, "h-5 w-5"))
      ),
      div(
        label(css`label`, tt("categoryName")),
        inputText({ class: "input", placeholder: () => t("categoryNamePlaceholder"), bind: name })
      ),
      div(
        label(css`label`, tt("type")),
        div(
          css`grid grid-cols-2 gap-2`,
          button({ class: () => `btn ${type.value === "expense" ? "bg-red-500/10 text-red-600 dark:text-red-400" : "btn-ghost"}`, onclick: () => (type.value = "expense") }, Icon(UI.minus, "h-4 w-4"), " ", tt("expense")),
          button({ class: () => `btn ${type.value === "income" ? "bg-brand-500/15 text-brand-700 dark:text-brand-400" : "btn-ghost"}`, onclick: () => (type.value = "income") }, Icon(UI.plus, "h-4 w-4"), " ", tt("income"))
        )
      ),
      div(
        css`grid grid-cols-1 gap-3 sm:grid-cols-2`,
        div(
          label(css`label`, tt("color")),
          div(css`flex flex-wrap items-center gap-2`,
            colorInput,
            SWATCHES.map(hex =>
              button({
                class: () => `h-6 w-6 rounded-full transition-transform hover:scale-110 ${color.value === hex ? "ring-2 ring-brand-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900" : ""}`,
                style: { backgroundColor: hex },
                onclick: () => (color.value = hex),
              })
            )
          )
        ),
        div(
          label(css`label`, tt("icon")),
          iconSelect
        )
      ),
      div(
        { style: { display: () => (type.value === "expense" ? "block" : "none") } },
        label(css`label`, tt("monthlyBudget")),
        inputNumber({ class: "input", min: "0", step: "10", placeholder: "0", bind: budget })
      ),
      div(
        { style: { display: () => (error.value ? "block" : "none") } },
        div(css`rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400`, error)
      ),
      div(
        css`flex justify-end gap-2 pt-1`,
        button({ class: "btn btn-ghost", onclick: close }, tt("cancel")),
        button({ class: "btn btn-primary", onclick: submit },
          span(computed(() => (editing.value ? t("saveChanges") : t("addCategory")))))
      )
    )
  );
}

function categoryRow(c, { onEdit, onDelete }) {
  const usage = computed(() => catUsage.value[c.id] || 0);
  return div(
    css`card flex flex-wrap items-center gap-4`,
    div(
      css`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl`,
      { style: { backgroundColor: `${c.color}1f`, color: c.color } },
      CategoryIcon(c, "h-5 w-5")
    ),
    div(
      css`min-w-40 flex-1`,
      div(css`flex flex-wrap items-center gap-2`,
        span(css`text-sm font-bold text-slate-900 dark:text-white`, c.name),
        span(
          { class: () => `rounded-full px-2 py-0.5 text-[11px] font-bold ${c.type === "income" ? "bg-brand-500/15 text-brand-700 dark:text-brand-400" : "bg-red-500/15 text-red-600 dark:text-red-400"}` },
          computed(() => (c.type === "income" ? t("income") : t("expense")))
        ),
        span(css`h-3 w-3 shrink-0 rounded-full ring-1 ring-slate-200 dark:ring-slate-700`, { style: { backgroundColor: c.color } })
      ),
      div(css`mt-0.5 text-xs text-slate-500 dark:text-slate-400`,
        span(computed(() => t("usedBy", { n: usage.value }))))
    ),
    div(
      css`ml-auto text-right`,
      div(css`text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500`, tt("monthlyBudget")),
      div(css`text-sm font-bold text-slate-900 dark:text-white`,
        computed(() => (c.type === "expense" ? fmt(c.budget || 0) : "—")))
    ),
    div(
      css`flex gap-2`,
      button({ class: "btn btn-ghost px-2 py-1", title: () => t("editCategory"), onclick: () => onEdit(c) }, Icon(UI.pencil, "h-4 w-4")),
      button({ class: "btn btn-ghost px-2 py-1 text-red-500 hover:text-red-600", title: () => t("deleteCategory"), onclick: () => onDelete(c) }, Icon(UI.trash, "h-4 w-4"))
    )
  );
}

export function Categories() {
  const formOpen = stateOf(false);
  const editing = stateOf(null);

  const openAdd = () => {
    editing.value = null;
    formOpen.value = true;
  };
  const openEdit = c => {
    editing.value = c;
    formOpen.value = true;
  };
  const remove = c => {
    const fb = deleteFallback(c);
    const msg = fb ? t("deleteCatConfirm", { name: c.name, fallback: fb.name }) : t("deleteCatLast", { name: c.name });
    if (confirm(msg)) dispatcher.dispatch(Actions.CAT_DELETE, c.id);
  };

  return div(
    css`space-y-6`,
    div(
      css`flex flex-wrap items-end justify-between gap-4`,
      div(
        p(css`text-2xl font-bold tracking-tight text-slate-900 dark:text-white`, tt("categoriesPage")),
        p(css`mt-1 text-sm text-slate-500 dark:text-slate-400`,
          span(computed(() => t("categoriesSub", { n: catCount.value }))))
      ),
      button({ class: "btn btn-primary", onclick: openAdd }, Icon(UI.plus, "h-4 w-4"), " ", tt("addCategory"))
    ),
    div(
      { style: { display: () => (catCount.value === 0 ? "block" : "none") } },
      div(css`card text-center text-sm text-slate-500 dark:text-slate-400`, tt("noCategories"))
    ),
    CategoryForm({ open: formOpen, editing, onClose: () => (formOpen.value = false) }),
    loop(categories, c => c.id, c => categoryRow(c, { onEdit: openEdit, onDelete: remove })),
  );
}


