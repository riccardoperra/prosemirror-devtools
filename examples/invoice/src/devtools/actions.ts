import {
  createProseMirrorInspectionClient,
  createSnapshot,
  loadSnapshots,
  persistSnapshots,
  type InspectionTarget,
} from "prosemirror-inspector/core";
import {
  exportProseMirrorRecording,
  parseProseMirrorRecording,
  type ProseMirrorRecording,
} from "prosemirror-inspector/recordings";

import type { DevtoolsActions } from "./context";
import { sessionId, store } from "./session";

const client = createProseMirrorInspectionClient({ store });

interface DiscoveredTool {
  readonly name: string;
  execute(input: unknown): unknown;
}

/**
 * Chrome DevTools MCP finds page tools by dispatching this event. Dispatching it here runs the same
 * traced tools, so the WebMCP tab records the calls without a connected agent.
 */
function discoverTools(): readonly DiscoveredTool[] {
  let tools: readonly DiscoveredTool[] = [];
  const event = new Event("devtoolstooldiscovery");
  Object.defineProperty(event, "respondWith", {
    value(group: { readonly tools: readonly DiscoveredTool[] }) {
      tools = group.tools;
    },
  });
  window.dispatchEvent(event);
  return tools;
}

async function call(tools: readonly DiscoveredTool[], name: string, input: unknown) {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`The inspection bridge has no ${name} tool.`);
  return (await tool.execute(input)) as Record<string, unknown>;
}

function invoiceTarget(): InspectionTarget | null {
  return (
    client.listEditors().find((editor) => editor.target.editorId === sessionId)?.target ?? null
  );
}

let viewed: ProseMirrorRecording | null = null;
const viewedListeners = new Set<() => void>();

/** The recording shown in the viewer dialog, as an external store for React. */
export const viewedRecording = {
  get: (): ProseMirrorRecording | null => viewed,
  set(next: ProseMirrorRecording | null): void {
    viewed = next;
    for (const listener of viewedListeners) listener();
  },
  subscribe(listener: () => void): () => void {
    viewedListeners.add(listener);
    return () => viewedListeners.delete(listener);
  },
};

function exportInvoice(): ProseMirrorRecording | null {
  const target = invoiceTarget();
  if (!target) return null;
  return exportProseMirrorRecording({
    client,
    target,
    label: "Invoice workbench",
    versions: { app: "invoice-workbench" },
  });
}

function download(recording: ProseMirrorRecording): void {
  const blob = new Blob([JSON.stringify(recording)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `invoice-recording-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export const devtoolsActions: DevtoolsActions = {
  async askAgent() {
    const tools = discoverTools();
    if (tools.length === 0) return false;
    const listing = await call(tools, "prosemirror_editors", {});
    const editors = listing.editors as readonly { target: InspectionTarget }[];
    const target = editors.find((editor) => editor.target.editorId === sessionId)?.target;
    if (!target) return false;
    await call(tools, "prosemirror_inspect", { target, query: { kind: "selection" } });
    const check = await call(tools, "prosemirror_check", {
      request: { target, query: { kind: "selection" } },
      assertion: { path: ["from"], predicate: { kind: "exists" }, completeness: "value" },
    });
    return check.kind === "passed";
  },
  takeSnapshot(editor, name) {
    const snapshot = createSnapshot(sessionId, editor.view, name);
    persistSnapshots(sessionId, [...loadSnapshots(sessionId), snapshot]);
  },
  exportRecording() {
    const recording = exportInvoice();
    if (recording) download(recording);
    return recording !== null;
  },
  async openRecording(file) {
    viewedRecording.set(parseProseMirrorRecording(JSON.parse(await file.text())));
  },
  previewRecording() {
    const recording = exportInvoice();
    if (recording) viewedRecording.set(recording);
    return recording !== null;
  },
};
