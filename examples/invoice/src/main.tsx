import {
  installProseMirrorChromeBridge,
  installProseMirrorWebMCPBridge,
} from "prosemirror-inspector/agent";
import { createProseMirrorInspectionClient } from "prosemirror-inspector/core";
import { createProseMirrorDevtoolsPlugin } from "prosemirror-inspector/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { invoiceDevtoolsExtension } from "./devtools/InvoicePanel";
import { store } from "./devtools/session";
import { InvoiceEditor } from "./ui/InvoiceEditor";
import "./style.css";

const disposeBridge = import.meta.env.DEV
  ? installProseMirrorChromeBridge(createProseMirrorInspectionClient({ store }))
  : null;
const disposeWebMCP = import.meta.env.DEV
  ? await installProseMirrorWebMCPBridge(createProseMirrorInspectionClient({ store }))
  : null;

const inspectorPlugin = import.meta.env.DEV
  ? createProseMirrorDevtoolsPlugin({
      store,
      defaultPanel: "history",
      extensions: [invoiceDevtoolsExtension],
    })
  : null;

function App() {
  return (
    <>
      <main className="workbench">
        <InvoiceEditor />
      </main>
      {inspectorPlugin ? (
        <TanStackDevtools
          config={{ position: "bottom-right", openHotkey: ["CtrlOrMeta", "Shift", "D"] }}
          plugins={[inspectorPlugin]}
        />
      ) : null}
    </>
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
  disposeBridge?.();
  disposeWebMCP?.();
  root.unmount();
}
window.addEventListener("pagehide", dispose, { once: true });
import.meta.hot?.dispose(dispose);
