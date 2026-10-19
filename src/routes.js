import { Router, route } from "@daevsoft/jetz/router";
import { activeRoute } from "./state/store.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Transactions } from "./pages/Transactions.js";
import { Budgets } from "./pages/Budgets.js";
import { Categories } from "./pages/Categories.js";
import { Accounts } from "./pages/Accounts.js";
import { Settings } from "./pages/Settings.js";

function readPath() {
  const hash = location.hash;
  if (hash.length > 1) return hash.slice(1);
  const path = location.pathname;
  return path === "/index.html" ? "/" : path || "/";
}

export function createRouter() {
  const sync = () => (activeRoute.value = readPath());
  window.addEventListener("hashchange", sync);
  window.addEventListener("popstate", sync);
  sync();
  return new Router(
    route("/", Dashboard),
    route("/transactions", Transactions),
    route("/budgets", Budgets),
    route("/categories", Categories),
    route("/accounts", Accounts),
    route("/settings", Settings)
  );
}
