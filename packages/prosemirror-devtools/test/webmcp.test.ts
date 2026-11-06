import { afterEach, describe, expect, it, vi } from "vitest";
import { createProseMirrorAgentTools, installProseMirrorWebMCPBridge } from "../src/agent";
import {
  createProseMirrorDevtoolsSession,
  createProseMirrorDevtoolsStore,
  createProseMirrorInspectionClient,
} from "../src/core";
import { createTestState, createTestView } from "./helpers";

type Tool = ReturnType<typeof createProseMirrorAgentTools>["tools"][number] & {
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean; debugging: boolean };
};
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanups.splice(0).reverse()) dispose();
  Reflect.deleteProperty(document, "modelContext");
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

function setup() {
  const store = createProseMirrorDevtoolsStore();
  const session = createProseMirrorDevtoolsSession({ id: "webmcp-editor", store });
  const view = createTestView(createTestState("hello"));
  session.attach(view);
  cleanups.push(
    () => view.destroy(),
    () => session.dispose(),
  );
  const client = createProseMirrorInspectionClient({ store });
  const target = client.listEditors()[0]?.target;
  if (!target) throw new Error("The real editor must be registered.");
  return { client, target, view };
}

function currentContext(failAt?: string) {
  const tools = new Map<string, Tool>();
  const registerTool = vi.fn(async (tool: Tool, { signal }: { signal: AbortSignal }) => {
    if (tool.name === failAt || tools.has(tool.name)) throw new Error("Registration rejected");
    tools.set(tool.name, tool);
    signal.addEventListener("abort", () => tools.delete(tool.name), { once: true });
  });
  const context = { registerTool };
  Object.defineProperty(document, "modelContext", { value: context, configurable: true });
  return { tools, registerTool };
}

describe("native WebMCP bridge", () => {
  it("does nothing when the browser has no supported model context", async () => {
    const { client } = setup();
    expect(await installProseMirrorWebMCPBridge(client)).toBeNull();
    Object.defineProperty(document, "modelContext", { value: {}, configurable: true });
    expect(await installProseMirrorWebMCPBridge(client)).toBeNull();
  });

  it("registers the common schemas and reads real editor evidence without mutations", async () => {
    const { client, target, view } = setup();
    const native = currentContext();
    const dispose = await installProseMirrorWebMCPBridge(client);
    if (!dispose) throw new Error("WebMCP must be supported.");
    cleanups.push(dispose);
    const shared = createProseMirrorAgentTools(client).tools;
    expect([...native.tools.keys()]).toEqual(shared.map(({ name }) => name));
    for (const tool of shared) {
      expect(native.tools.get(tool.name)).toMatchObject({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { readOnlyHint: true, untrustedContentHint: true, debugging: true },
      });
    }
    const inspect = native.tools.get("prosemirror_inspect");
    expect(await inspect?.execute({ target, query: { kind: "document" } })).toEqual(
      client.query({ target, query: { kind: "document" } }),
    );
    expect(
      await inspect?.execute({ target, query: { kind: "document" }, script: "forbidden" }),
    ).toMatchObject({ kind: "error" });
    expect(view.state.doc.textContent).toBe("hello");
    dispose();
    dispose();
    expect(native.tools.size).toBe(0);
    await expect(inspect?.execute({ target, query: { kind: "document" } })).rejects.toThrow(
      "disposed",
    );
  });

  it("rolls back partial registration without removing another owner's tools", async () => {
    const { client } = setup();
    const native = currentContext("prosemirror_inspect");
    const foreign = {
      name: "application_tool",
      description: "Owned by the application",
      inputSchema: {},
      execute: () => null,
      annotations: { readOnlyHint: true, untrustedContentHint: false, debugging: false },
    };
    native.tools.set(foreign.name, foreign);
    await expect(installProseMirrorWebMCPBridge(client)).rejects.toThrow("Registration rejected");
    expect([...native.tools.values()]).toEqual([foreign]);
    expect(native.registerTool).toHaveBeenCalledTimes(3);
  });

  it("cleans up the earlier navigator registration API once", async () => {
    const { client } = setup();
    const registered = new Map<string, Tool>();
    const unregisterTool = vi.fn((name: string) => registered.delete(name));
    vi.stubGlobal("navigator", {
      modelContext: {
        registerTool: (tool: Tool) => registered.set(tool.name, tool),
        unregisterTool,
      },
    });
    const dispose = await installProseMirrorWebMCPBridge(client);
    expect(registered.size).toBe(5);
    dispose?.();
    dispose?.();
    expect(registered.size).toBe(0);
    expect(unregisterTool).toHaveBeenCalledTimes(5);
  });
});
