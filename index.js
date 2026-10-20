import { Jetz } from "@daevsoft/jetz";
import "./src/styles/app.css";
import { initStorage } from "./src/services/storage.js";

// The store boots synchronously at import time, but IndexedDB opens
// asynchronously — the app graph is imported only once storage is ready.
initStorage().then(async () => {
  const { createRouter } = await import("./src/routes.js");
  const { App } = await import("./src/app.js");
  Jetz.use(createRouter());
  Jetz.mount(App, "#app");
});

// Service worker: the app is fully local (IndexedDB), so the worker only has
// to make the shell itself work offline. It is network-first, so a dev-server
// rebuild is always picked up on the next load. localhost counts as a secure
// context, so installing can be tested without a build.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(err => {
      console.warn("FinTrack: service worker registration failed", err);
    });
  });
}
