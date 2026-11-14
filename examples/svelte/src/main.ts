import { mount } from "svelte";
import App from "./App.svelte";
import "@prosemirror-devtools/demo-kit/styles.css";
const target = document.getElementById("app");
if (!target) throw new Error("Unable to find the demo root element");
mount(App, { target });
