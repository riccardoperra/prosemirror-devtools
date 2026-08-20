import { render } from "preact";
import { App } from "./App";
import "@prosemirror-devtools/demo-kit/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Unable to find the demo root element");
render(<App />, root);
