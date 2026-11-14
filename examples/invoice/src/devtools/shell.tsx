import {
  installProseMirrorChromeBridge,
  installProseMirrorWebMCPBridge,
} from "prosemirror-inspector/agent";
import { createProseMirrorInspectionClient } from "prosemirror-inspector/core";
import { createProseMirrorDevtoolsPlugin } from "prosemirror-inspector/react";
import { TanStackDevtools } from "@tanstack/react-devtools";

export { InvoiceDevtools } from "./extension";
import { invoiceDevtoolsExtension } from "./InvoicePanel";
import { store } from "./session";

const disposeBridge = installProseMirrorChromeBridge(createProseMirrorInspectionClient({ store }));
const disposeWebMCP = await installProseMirrorWebMCPBridge(
  createProseMirrorInspectionClient({ store }),
);

const inspectorPlugin = createProseMirrorDevtoolsPlugin({
  store,
  defaultPanel: "history",
  extensions: [invoiceDevtoolsExtension],
});

export function DevtoolsShell() {
  return (
    <TanStackDevtools
      config={{ position: "bottom-right", openHotkey: ["CtrlOrMeta", "Shift", "D"] }}
      plugins={[inspectorPlugin]}
    />
  );
}

export function disposeDevtools(): void {
  disposeBridge();
  disposeWebMCP?.();
}
