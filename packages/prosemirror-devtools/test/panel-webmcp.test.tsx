import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createProseMirrorDevtoolsSession,
  createProseMirrorDevtoolsStore,
  createProseMirrorInspectionClient,
  createProseMirrorWebMcpInspector,
  ProseMirrorDevtoolsPanel,
  type WebMcpTool,
} from "../src";
import {
  type createProseMirrorAgentTools,
  installProseMirrorChromeBridge,
  installProseMirrorWebMCPBridge,
} from "../src/agent";
import { createTestState, createTestView } from "./helpers";

function defer<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function installModelContext() {
  const registered = new Map<string, WebMcpTool>();
  const registerTool = vi.fn(async (tool: WebMcpTool, { signal }: { signal: AbortSignal }) => {
    registered.set(tool.name, tool);
    signal.addEventListener("abort", () => registered.delete(tool.name), { once: true });
  });
  Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool } });
  return { registered, registerTool };
}

function mountPanel(inspector: ReturnType<typeof createProseMirrorWebMcpInspector>) {
  const host = document.createElement("div");
  const store = createProseMirrorDevtoolsStore();
  document.body.append(host);
  const unmount = render(
    () => (
      <ProseMirrorDevtoolsPanel
        defaultPanel="webmcp"
        extensions={[inspector.extension]}
        store={store}
      />
    ),
    host,
  );
  return {
    tools: () => host.querySelector('[aria-label="Registered WebMCP tools"]')?.textContent,
    calls: () => Array.from(host.querySelectorAll<HTMLDetailsElement>("details")),
    clear: () =>
      host.querySelector<HTMLButtonElement>('[aria-label="Clear WebMCP call history"]')!.click(),
    selectTab: (name: string) =>
      Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
        .find((tab) => tab.textContent === name)!
        .click(),
    dispose() {
      unmount();
      inspector.dispose();
    },
  };
}

afterEach(() => {
  Reflect.deleteProperty(document, "modelContext");
  document.body.replaceChildren();
});

describe("WebMCP panel", () => {
  it("shows calls to the native bridge's registered editor tools", async () => {
    const { registered } = installModelContext();
    const store = createProseMirrorDevtoolsStore();
    const editor = createProseMirrorDevtoolsSession({ id: "bridge-editor", store });
    const view = createTestView(createTestState("hello"));
    editor.attach(view);
    const inspector = createProseMirrorWebMcpInspector();
    const panel = mountPanel(inspector);
    const client = createProseMirrorInspectionClient({ store });

    try {
      const dispose = await installProseMirrorWebMCPBridge(client, inspector);
      expect(panel.tools()).toContain("prosemirror_editors");
      await registered
        .get("prosemirror_editors")!
        .execute({}, { signal: new AbortController().signal });
      expect(panel.calls()[0]?.textContent).toContain("Succeeded");
      expect(panel.calls()[0]?.textContent).toContain("bridge-editor");
      dispose?.();
      expect(panel.tools()).toContain("No WebMCP tools registered");
      expect(panel.calls()).toHaveLength(1);
    } finally {
      panel.dispose();
      editor.dispose();
      view.destroy();
    }
  });

  it("shows Chrome DevTools MCP executions in the same history as native calls", async () => {
    const { registered } = installModelContext();
    const store = createProseMirrorDevtoolsStore();
    const editor = createProseMirrorDevtoolsSession({ id: "bridge-editor", store });
    const view = createTestView(createTestState("hello"));
    editor.attach(view);
    const inspector = createProseMirrorWebMcpInspector();
    const panel = mountPanel(inspector);
    const client = createProseMirrorInspectionClient({ store });
    const target = new EventTarget();
    const disposeChrome = installProseMirrorChromeBridge(client, { target, inspector });

    try {
      await installProseMirrorWebMCPBridge(client, inspector);
      const respondWith = vi.fn<(group: ReturnType<typeof createProseMirrorAgentTools>) => void>();
      const event = new Event("devtoolstooldiscovery");
      Object.defineProperty(event, "respondWith", { value: respondWith });
      target.dispatchEvent(event);
      expect(panel.calls()).toHaveLength(0);

      const tools = respondWith.mock.calls[0]![0].tools;
      const result = tools.find(({ name }) => name === "prosemirror_editors")!.execute({});
      expect(result).toMatchObject({ editors: [{ target: { editorId: "bridge-editor" } }] });
      await registered
        .get("prosemirror_editors")!
        .execute({}, { signal: new AbortController().signal });

      expect(panel.calls()).toHaveLength(2);
      const [nativeCall, chromeCall] = panel.calls();
      expect(nativeCall?.textContent).toContain("Native WebMCP");
      expect(chromeCall?.textContent).toContain("Chrome DevTools MCP");
      expect(chromeCall?.textContent).toContain("prosemirror_editors");
      expect(chromeCall?.textContent).toContain("Succeeded");
      expect(chromeCall?.textContent).toContain("bridge-editor");
    } finally {
      disposeChrome();
      panel.dispose();
      editor.dispose();
      view.destroy();
    }
  });

  it("tracks registered tools and concurrent calls through the browser callbacks", async () => {
    const { registered } = installModelContext();
    const inspector = createProseMirrorWebMcpInspector();
    const panel = mountPanel(inspector);
    const context = { signal: new AbortController().signal };
    const deferred = defer<{ text: string }>();
    const failure = new Error("Editor unavailable");
    const read = vi.fn((_input, _context) => deferred.promise);
    try {
      const definition: WebMcpTool = {
        name: "read_document",
        title: "Read document",
        description: "Read the current ProseMirror document",
        inputSchema: { type: "object", properties: { format: { type: "string" } } },
        annotations: { readOnlyHint: true },
        execute: read,
      };
      const unregister = await inspector.registerTool(Object.create(definition) as WebMcpTool);
      const registeredTool = registered.get("read_document")!;
      expect(registeredTool).toMatchObject({
        title: definition.title,
        inputSchema: definition.inputSchema,
        annotations: definition.annotations,
      });
      await inspector.registerTool({
        name: "read_selection",
        description: "Read the current selection",
        execute: async () => {
          throw failure;
        },
      });
      expect(panel.tools()).toContain("Read the current ProseMirror document");

      const input = { format: "text" };
      const pending = registeredTool.execute(input, context);
      expect(read).toHaveBeenCalledWith(input, context);
      const firstRow = panel.calls()[0]!;
      firstRow.open = true;
      expect(firstRow.textContent).toContain("Pending");
      expect(firstRow.textContent).toContain('"format": "text"');

      await expect(registered.get("read_selection")!.execute({}, context)).rejects.toBe(failure);
      expect(panel.calls()[0]?.textContent).toContain("Failed");
      expect(panel.calls()[0]?.textContent).toContain("Error: Editor unavailable");

      const output = { text: "Hello from ProseMirror" };
      deferred.resolve(output);
      await expect(pending).resolves.toBe(output);
      expect(panel.calls()[1]).toBe(firstRow);
      expect(firstRow.open).toBe(true);
      expect(firstRow.textContent).toContain("Succeeded");
      expect(firstRow.textContent).toContain("Hello from ProseMirror");

      unregister();
      unregister();
      expect(registered.has("read_document")).toBe(false);
      expect(panel.tools()).not.toContain("read_document");
      expect(panel.calls()).toHaveLength(2);
      expect(panel.calls()[1]?.textContent).toContain("read_document");
    } finally {
      panel.dispose();
    }
    expect(registered.size).toBe(0);
  });

  it("captures while the tab is hidden and bounds and clears in-flight history", async () => {
    const { registered } = installModelContext();
    const inspector = createProseMirrorWebMcpInspector({ limit: 1 });
    const panel = mountPanel(inspector);
    const context = { signal: new AbortController().signal };
    const deferred = defer<string>();
    try {
      await inspector.registerTool({
        name: "read_document",
        description: "Read the current ProseMirror document",
        execute: ({ wait }: { wait?: boolean }) => (wait ? deferred.promise : "Ready"),
      });
      const tool = registered.get("read_document")!;
      panel.selectTab("Document");
      await tool.execute({}, context);
      const pending = tool.execute({ wait: true }, context);
      panel.selectTab("WebMCP");

      expect(panel.calls()).toHaveLength(1);
      expect(panel.calls()[0]?.textContent).toContain("#2");
      expect(panel.calls()[0]?.textContent).toContain("Pending");

      panel.clear();
      deferred.resolve("Done");
      await expect(pending).resolves.toBe("Done");
      expect(panel.calls()).toHaveLength(0);
      expect(panel.tools()).toContain("read_document");
    } finally {
      panel.dispose();
    }
  });

  it("marks cancellation immediately and preserves the handler's eventual result", async () => {
    const { registered } = installModelContext();
    const inspector = createProseMirrorWebMcpInspector();
    const panel = mountPanel(inspector);
    const controller = new AbortController();
    const deferred = defer<string>();
    try {
      await inspector.registerTool({
        name: "read_document",
        description: "Read the current ProseMirror document",
        execute: () => deferred.promise,
      });
      const pending = registered.get("read_document")!.execute({}, { signal: controller.signal });
      controller.abort();
      expect(panel.calls()[0]?.textContent).toContain("Canceled");

      deferred.resolve("Late result");
      await expect(pending).resolves.toBe("Late result");
      expect(panel.calls()[0]?.textContent).toContain("Canceled");
      expect(panel.calls()[0]?.textContent).not.toContain("Late result");
    } finally {
      panel.dispose();
    }
  });

  it("keeps failed and interrupted registrations out of the catalog", async () => {
    const { registered, registerTool } = installModelContext();
    const inspector = createProseMirrorWebMcpInspector();
    const panel = mountPanel(inspector);
    const tool = { name: "test_tool", description: "Test tool", execute: () => {} };
    try {
      const failure = new Error("Registration rejected");
      registerTool.mockRejectedValueOnce(failure);
      await expect(inspector.registerTool(tool)).rejects.toBe(failure);
      expect(panel.tools()).toContain("No WebMCP tools registered");

      const pending = inspector.registerTool(tool);
      inspector.dispose();
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
      expect(panel.tools()).toContain("No WebMCP tools registered");
      expect(registered.size).toBe(0);
    } finally {
      panel.dispose();
    }
  });

  it("reports when the browser does not expose WebMCP", async () => {
    const inspector = createProseMirrorWebMcpInspector();
    const panel = mountPanel(inspector);
    try {
      expect(inspector.isSupported).toBe(false);
      expect(panel.tools()).toContain("WebMCP is unavailable in this document");
      await expect(
        inspector.registerTool({ name: "test_tool", description: "Test tool", execute: () => {} }),
      ).rejects.toThrow("WebMCP is unavailable");
    } finally {
      panel.dispose();
    }
  });
});
