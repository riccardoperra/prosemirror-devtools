import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { readCollabConfig } from "./collab/config";
import { CollabContext } from "./collab/context";
import { DevtoolsContext } from "./devtools/context";
import { InvoiceEditor } from "./ui/InvoiceEditor";
import "./style.css";

const collabConfig = readCollabConfig(location.search);
// Dynamic imports keep Yjs out of single-user tabs and the devtools shell, its panel styles, and
// its fonts out of production bundles.
const collab = collabConfig
  ? (await import("./collab/session")).createCollabSession(collabConfig)
  : null;
const devtools = import.meta.env.DEV
  ? await (await import("./devtools/shell")).createDevtoolsShell(collab)
  : null;

function App() {
  return (
    <CollabContext.Provider value={collab}>
      <DevtoolsContext.Provider value={devtools?.actions ?? null}>
        <main className="workbench">
          <InvoiceEditor devtools={devtools?.editorExtension ?? null} />
        </main>
      </DevtoolsContext.Provider>
      {devtools ? <devtools.Shell /> : null}
    </CollabContext.Provider>
  );
}

const container = document.querySelector("#app");
if (!container) throw new Error("Missing application container");
const root = createRoot(container);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
function dispose(): void {
  window.removeEventListener("pagehide", dispose);
  root.unmount();
  devtools?.dispose();
  collab?.dispose();
}
window.addEventListener("pagehide", dispose, { once: true });
import.meta.hot?.dispose(dispose);
