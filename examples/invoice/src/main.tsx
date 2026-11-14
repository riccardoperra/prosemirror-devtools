import { getSchema } from "@tiptap/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { readCollabConfig } from "./collab/config";
import { CollabContext } from "./collab/context";
import { DevtoolsContext } from "./devtools/context";
import { loadDevtoolsShell } from "./env";
import { createInvoiceExtensions } from "./invoice/extensions";
import { initialInvoice } from "./invoice/fixture";
import { InvoiceEditor } from "./ui/InvoiceEditor";
import "./style.css";

function tabStorage(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

const collabConfig = readCollabConfig(location.search, tabStorage());
// Yjs stays out of the `?solo` path. The devtools shell, its panel styles, and its fonts load only
// when diagnostics are on.
const collab =
  collabConfig.mode === "room"
    ? (await import("./collab/session")).createCollabSession(collabConfig, {
        schema: getSchema(createInvoiceExtensions({ history: false })),
        content: initialInvoice,
      })
    : null;
const devtools = loadDevtoolsShell
  ? await (await loadDevtoolsShell()).createDevtoolsShell(collab)
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
// Leaving removes this tab's awareness state, so its avatar disappears from the other tabs.
window.addEventListener("pagehide", dispose, { once: true });
// A page restored from the back/forward cache comes back with a closed session. Rejoin instead.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
import.meta.hot?.dispose(dispose);
