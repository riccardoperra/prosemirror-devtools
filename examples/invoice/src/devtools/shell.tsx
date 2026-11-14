import { createProseMirrorWebMcpInspector } from "prosemirror-inspector";
import {
  installProseMirrorChromeBridge,
  installProseMirrorWebMCPBridge,
} from "prosemirror-inspector/agent";
import { createProseMirrorInspectionClient } from "prosemirror-inspector/core";
// The shell only loads when diagnostics are on, including the production Pages showcase.
import { createProseMirrorDevtoolsPlugin } from "prosemirror-inspector/react/production";
import { TanStackDevtools } from "@tanstack/react-devtools";

import type { CollabSession } from "../collab/session";
import { devtoolsActions } from "./actions";
import { createInvoiceDevtools } from "./extension";
import { createInvoiceDevtoolsExtension } from "./InvoicePanel";
import { RecordingDialog } from "./RecordingDialog";
import { store } from "./session";

export async function createDevtoolsShell(collab: CollabSession | null) {
  const client = createProseMirrorInspectionClient({ store });
  const webMcp = createProseMirrorWebMcpInspector();
  const disposeChromeBridge = installProseMirrorChromeBridge(client, { inspector: webMcp });
  const disposeWebMcpBridge = await installProseMirrorWebMCPBridge(client, webMcp);
  const inspectorPlugin = createProseMirrorDevtoolsPlugin({
    store,
    defaultPanel: "history",
    extensions: [createInvoiceDevtoolsExtension(collab), webMcp.extension],
  });
  return {
    actions: devtoolsActions,
    editorExtension: createInvoiceDevtools(collab),
    Shell() {
      return (
        <>
          <TanStackDevtools
            config={{ position: "bottom-right", openHotkey: ["CtrlOrMeta", "Shift", "D"] }}
            plugins={[inspectorPlugin]}
          />
          <RecordingDialog />
        </>
      );
    },
    dispose() {
      disposeChromeBridge();
      disposeWebMcpBridge?.();
      webMcp.dispose();
    },
  };
}
