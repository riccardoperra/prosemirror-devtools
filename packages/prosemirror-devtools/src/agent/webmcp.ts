import type { ProseMirrorInspectionClient } from "../inspection/types";
import { createProseMirrorAgentTools } from "./tools";

type AgentTool = ReturnType<typeof createProseMirrorAgentTools>["tools"][number];
type WebMCPTool = Omit<AgentTool, "execute"> & {
  readonly annotations: {
    readonly readOnlyHint: true;
    readonly untrustedContentHint: true;
    readonly debugging: true;
  };
  execute(input: unknown): Promise<unknown>;
};

type ModelContext = {
  registerTool(tool: WebMCPTool, options: { signal: AbortSignal }): Promise<unknown>;
  unregisterTool?: (name: string) => void;
};

function readModelContext(host: unknown): ModelContext | undefined {
  if (host === null || typeof host !== "object" || !("modelContext" in host)) return;
  const context = host.modelContext;
  if (context === null || typeof context !== "object" || !("registerTool" in context)) return;
  const register = context.registerTool;
  if (typeof register !== "function") return;
  const unregister = "unregisterTool" in context ? context.unregisterTool : undefined;
  return {
    registerTool: (tool, options) => Promise.resolve(register.call(context, tool, options)),
    ...(typeof unregister === "function"
      ? { unregisterTool: (name: string) => unregister.call(context, name) }
      : {}),
  };
}

export async function installProseMirrorWebMCPBridge(
  client: ProseMirrorInspectionClient,
): Promise<(() => void) | null> {
  const context = readModelContext(globalThis.document) ?? readModelContext(globalThis.navigator);
  if (!context) return null;
  const controller = new AbortController();
  const registered: string[] = [];
  const dispose = (): void => {
    if (controller.signal.aborted) return;
    controller.abort();
    for (const name of registered) context.unregisterTool?.(name);
  };
  try {
    for (const tool of createProseMirrorAgentTools(client).tools) {
      await context.registerTool(
        {
          ...tool,
          annotations: { readOnlyHint: true, untrustedContentHint: true, debugging: true },
          execute: async (input) => {
            if (controller.signal.aborted) throw new Error("This inspection bridge was disposed.");
            return tool.execute(input);
          },
        },
        { signal: controller.signal },
      );
      registered.push(tool.name);
    }
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}
