import { Jetz } from "@daevsoft/jetz";
import "./src/styles/app.css";
import { createRouter } from "./src/routes.js";
import { App } from "./src/app.js";

Jetz.use(createRouter());
Jetz.mount(App, "#app");
