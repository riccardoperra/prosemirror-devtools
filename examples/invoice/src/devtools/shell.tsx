import { createProseMirrorWebMcpInspector } from "prosemirror-inspector";
import {
  installProseMirrorChromeBridge,
  installProseMirrorWebMCPBridge,
} from "prosemirror-inspector/agent";
import { createProseMirrorInspectionClient } from "prosemirror-inspector/core";
// The shell only loads when diagnostics are on, including the production Pages showcase.
import { createProseMirrorDevtoolsPlugin } from "prosemirror-inspector/react/production";
import { TanStackDevtools } from "@tanstack/react-devtools";

import { invoiceDevtoolsExtension } from "./InvoicePanel";
import { RecordingDialog } from "./RecordingDialog";
import { store } from "./session";

export { devtoolsActions } from "./actions";
export { InvoiceDevtools } from "./extension";

const client = createProseMirrorInspectionClient({ store });
const webMcp = createProseMirrorWebMcpInspector();
const disposeChromeBridge = installProseMirrorChromeBridge(client, { inspector: webMcp });
const disposeWebMcpBridge = await installProseMirrorWebMCPBridge(client, webMcp);

const inspectorPlugin = createProseMirrorDevtoolsPlugin({
  store,
  defaultPanel: "history",
  extensions: [invoiceDevtoolsExtension, webMcp.extension],
});

export function DevtoolsShell() {
  return (
    <>
      <TanStackDevtools
        config={{ position: "bottom-right", openHotkey: ["CtrlOrMeta", "Shift", "D"] }}
        plugins={[inspectorPlugin]}
      />
      <RecordingDialog />
    </>
  );
}

export function disposeDevtools(): void {
  disposeChromeBridge();
  disposeWebMcpBridge?.();
  webMcp.dispose();
}
