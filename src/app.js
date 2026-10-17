import { Jetz } from "@daevsoft/jetz";
import { main } from "@daevsoft/jetz/ui";
import { AppLayout } from "./components/AppLayout.js";

export const App = () => main(AppLayout(Jetz.$route.browser()));
