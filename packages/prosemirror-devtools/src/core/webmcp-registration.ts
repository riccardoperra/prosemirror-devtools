export interface WebMcpTool<TInput extends object = Record<string, unknown>> {
  name: string;
  title?: string | undefined;
  description: string;
  inputSchema?: object | undefined;
  annotations?:
    | {
        readOnlyHint?: boolean;
        untrustedContentHint?: boolean;
        consequentialHint?: boolean;
        debugging?: boolean;
      }
    | undefined;
  execute(input: TInput, context: { signal: AbortSignal }): unknown;
}

export interface WebMcpRegistrar {
  readonly isSupported: boolean;
  registerTool<TInput extends object>(tool: WebMcpTool<TInput>): Promise<() => void>;
}

type ModelContext = {
  registerTool<TInput extends object>(
    tool: WebMcpTool<TInput>,
    options: { signal: AbortSignal },
  ): unknown;
  unregisterTool?: (name: string) => void;
};

function readModelContext(host: unknown): ModelContext | undefined {
  if (host === null || typeof host !== "object" || !("modelContext" in host)) return;
  const context = host.modelContext;
  if (
    context !== null &&
    typeof context === "object" &&
    "registerTool" in context &&
    typeof context.registerTool === "function"
  ) {
    return context as ModelContext;
  }
  return undefined;
}

export function createNativeWebMcpRegistrar(ownerDocument = globalThis.document) {
  const ownerNavigator =
    ownerDocument === globalThis.document
      ? globalThis.navigator
      : ownerDocument?.defaultView?.navigator;
  const context = readModelContext(ownerDocument) ?? readModelContext(ownerNavigator);
  const Controller = ownerDocument?.defaultView?.AbortController ?? AbortController;
  return {
    isSupported: context !== undefined,
    async registerTool<TInput extends object>(
      tool: WebMcpTool<TInput>,
      controller = new Controller(),
    ): Promise<() => void> {
      if (!context) throw new Error("WebMCP is unavailable in this document.");
      const { signal } = controller;
      signal.throwIfAborted();
      await context.registerTool(tool, { signal });
      const unregister = context.unregisterTool;
      if (typeof unregister === "function") {
        const removeTool = () => unregister.call(context, tool.name);
        if (signal.aborted) removeTool();
        else signal.addEventListener("abort", removeTool, { once: true });
      }
      signal.throwIfAborted();
      return () => controller.abort();
    },
  };
}
