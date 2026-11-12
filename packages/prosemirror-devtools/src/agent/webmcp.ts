import { createNativeWebMcpRegistrar, type WebMcpRegistrar } from "../core/webmcp-registration";
import type { ProseMirrorInspectionClient } from "../inspection/types";
import { createProseMirrorAgentTools } from "./tools";

export async function installProseMirrorWebMCPBridge(
  client: ProseMirrorInspectionClient,
  registrar: WebMcpRegistrar = createNativeWebMcpRegistrar(),
): Promise<(() => void) | null> {
  if (!registrar.isSupported) return null;
  let disposed = false;
  const cleanups: (() => void)[] = [];
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  };
  try {
    for (const tool of createProseMirrorAgentTools(client).tools) {
      const cleanup = await registrar.registerTool({
        ...tool,
        annotations: { readOnlyHint: true, untrustedContentHint: true, debugging: true },
        execute: async (input: object) => {
          if (disposed) throw new Error("This inspection bridge was disposed.");
          return tool.execute(input);
        },
      });
      cleanups.push(cleanup);
    }
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}
