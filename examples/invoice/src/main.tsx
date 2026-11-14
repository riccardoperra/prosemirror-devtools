import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { DevtoolsContext } from "./devtools/context";
import { InvoiceEditor } from "./ui/InvoiceEditor";
import "./style.css";

// A dynamic import keeps the shell, its panel styles, and its fonts out of production bundles.
const devtools = import.meta.env.DEV ? await import("./devtools/shell") : null;

function App() {
  return (
    <>
      <DevtoolsContext.Provider value={devtools?.devtoolsActions ?? null}>
        <main className="workbench">
          <InvoiceEditor devtools={devtools?.InvoiceDevtools ?? null} />
        </main>
      </DevtoolsContext.Provider>
      {devtools ? <devtools.DevtoolsShell /> : null}
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
  devtools?.disposeDevtools();
  root.unmount();
}
window.addEventListener("pagehide", dispose, { once: true });
import.meta.hot?.dispose(dispose);
