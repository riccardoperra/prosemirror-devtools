import { createProseMirrorWebMcpInspector, prosemirrorDevtoolsStore } from "prosemirror-inspector";
import {
  installProseMirrorChromeBridge,
  installProseMirrorWebMCPBridge,
} from "prosemirror-inspector/agent";
import { createProseMirrorInspectionClient } from "prosemirror-inspector/core";
import { devtoolsEnabled } from "./env";

const inspectionClient = devtoolsEnabled
  ? createProseMirrorInspectionClient({ store: prosemirrorDevtoolsStore })
  : null;

/** Records WebMCP and Chrome DevTools MCP tool calls for the devtools WebMCP tab. Dev only. */
export const webMcp = inspectionClient ? createProseMirrorWebMcpInspector() : null;

const disposeBridge =
  inspectionClient && webMcp
    ? installProseMirrorChromeBridge(inspectionClient, { inspector: webMcp })
    : null;
const disposeWebMCP =
  inspectionClient && webMcp
    ? await installProseMirrorWebMCPBridge(inspectionClient, webMcp)
    : null;

function dispose(): void {
  window.removeEventListener("pagehide", dispose);
  disposeBridge?.();
  disposeWebMCP?.();
  webMcp?.dispose();
}
window.addEventListener("pagehide", dispose, { once: true });
import.meta.hot?.dispose(dispose);
