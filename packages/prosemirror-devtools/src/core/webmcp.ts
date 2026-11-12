import { createNativeWebMcpRegistrar, type WebMcpTool } from "./webmcp-registration";
import { createSignalScheduler, createStoreSignal } from "./store/signal";
import { monotonicNow } from "./store/transaction-measurement";

export interface WebMcpInspectorOptions {
  document?: Document;
  /** Maximum number of calls in memory. Defaults to 100. */
  limit?: number;
}

interface ToolMetadata {
  name: string;
  description: string;
}

interface Registration {
  controller: AbortController;
  tool: ToolMetadata;
  registered: boolean;
}

type CallOutcome =
  | { status: "canceled" }
  | { status: "succeeded"; output: string }
  | { status: "failed"; error: string };

type CallSource = "webmcp" | "chrome-devtools-mcp";

export type WebMcpCall = {
  id: number;
  name: string;
  source: CallSource;
  timestamp: number;
  input: string;
} & ({ status: "pending" } | (CallOutcome & { duration: number }));

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function preview(value: unknown): string {
  let remaining = 64;

  function copy(current: unknown, depth: number): unknown {
    remaining -= 1;
    if (typeof current === "string") return truncate(current, 500);
    if (typeof current === "bigint") return truncate(`${current}n`, 500);
    if (typeof current === "symbol" || typeof current === "function") return `[${typeof current}]`;
    if (current === undefined) return "[undefined]";
    if (current === null || typeof current !== "object") return current;
    if (depth === 4) return "…";

    const array = Array.isArray(current);
    const entries = Object.keys(current);
    const copied: Array<[string, unknown]> = [];
    for (const key of entries) {
      if (remaining <= 0) break;
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      const field = descriptor && "value" in descriptor ? descriptor.value : "[accessor]";
      copied.push([truncate(key, 120), copy(field, depth + 1)]);
    }
    if (copied.length < entries.length) copied.push(["…", "…"]);
    return array ? copied.map(([, field]) => field) : Object.fromEntries(copied);
  }

  try {
    if (typeof value === "string") return truncate(value, 4_000);
    return truncate(JSON.stringify(copy(value, 0), null, 2), 4_000);
  } catch {
    return "[Unavailable preview]";
  }
}

function errorPreview(error: unknown): string {
  try {
    if (error instanceof Error) return truncate(`${error.name}: ${error.message}`, 4_000);
  } catch {
    return "[Unavailable error preview]";
  }
  return preview(error);
}

export function createWebMcpRecorder(options: WebMcpInspectorOptions) {
  const ownerDocument = options.document ?? globalThis.document;
  const native = createNativeWebMcpRegistrar(ownerDocument);
  const limit = Math.max(1, Math.min(1_000, Math.floor(options.limit ?? 100))) || 100;
  const scheduler = createSignalScheduler();
  const tools = createStoreSignal<readonly ToolMetadata[]>([], scheduler);
  const calls = createStoreSignal<ReadonlyMap<number, WebMcpCall>>(new Map(), scheduler);
  const registrations = new Map<string, Registration>();
  let nextCallId = 0;
  let disposed = false;

  function publishTools(): void {
    tools.set(
      Array.from(registrations.values())
        .filter((registration) => registration.registered)
        .map((registration) => registration.tool),
    );
  }

  function startCall(source: CallSource, name: string, input: unknown) {
    if (disposed) return undefined;
    const inputPreview = preview(input);
    if (disposed) return undefined;
    const call: WebMcpCall = {
      id: ++nextCallId,
      name,
      source,
      input: inputPreview,
      timestamp: Date.now(),
      status: "pending",
    };
    const next = new Map(calls());
    next.set(call.id, call);
    if (next.size > limit) next.delete(next.keys().next().value!);
    calls.set(next);
    const startedAt = monotonicNow();

    function finish(getOutcome: () => CallOutcome): void {
      if (calls().get(call.id) !== call) return;
      const duration = Math.max(0, monotonicNow() - startedAt);
      const outcome = getOutcome();
      if (calls().get(call.id) === call) {
        calls.set(new Map(calls()).set(call.id, { ...call, ...outcome, duration }));
      }
    }

    return {
      cancel: () => finish(() => ({ status: "canceled" })),
      succeed: (output: unknown) =>
        finish(() => ({ status: "succeeded", output: preview(output) })),
      fail: (error: unknown) => finish(() => ({ status: "failed", error: errorPreview(error) })),
    };
  }

  return {
    isSupported: native.isSupported,
    tools,
    calls,
    clearCalls: () => calls.set(new Map()),
    traceChromeToolCall<T>(name: string, input: unknown, execute: () => T): T {
      const call = startCall("chrome-devtools-mcp", name, input);
      try {
        const output = execute();
        call?.succeed(output);
        return output;
      } catch (error) {
        call?.fail(error);
        throw error;
      }
    },
    async registerTool<TInput extends object = Record<string, unknown>>(
      tool: WebMcpTool<TInput>,
    ): Promise<() => void> {
      if (disposed) throw new Error("The WebMCP inspector has been disposed.");
      if (!native.isSupported) {
        throw new Error("WebMCP is unavailable in this document.");
      }

      const { name, title, description, inputSchema, annotations, execute } = tool;
      if (registrations.has(name)) throw new Error(`WebMCP tool "${name}" is already registered.`);
      const Controller = ownerDocument?.defaultView?.AbortController ?? AbortController;
      const registration: Registration = {
        controller: new Controller(),
        tool: { name, description },
        registered: false,
      };
      registrations.set(name, registration);

      function unregister(): void {
        if (registrations.get(name) !== registration) return;
        registrations.delete(name);
        registration.controller.abort();
        if (registration.registered) publishTools();
      }

      try {
        await native.registerTool(
          {
            name,
            title,
            description,
            inputSchema,
            annotations,
            async execute(this: unknown, ...args: Parameters<typeof execute>) {
              const call = startCall("webmcp", name, args[0]);
              if (!call) return execute.apply(this, args);
              const signal = args[1]?.signal;
              if (signal?.aborted) call.cancel();
              else signal?.addEventListener("abort", call.cancel, { once: true });
              try {
                const output = await execute.apply(this, args);
                call.succeed(output);
                return output;
              } catch (error) {
                call.fail(error);
                throw error;
              } finally {
                signal?.removeEventListener("abort", call.cancel);
              }
            },
          },
          registration.controller,
        );
      } catch (error) {
        unregister();
        throw error;
      }
      registration.registered = true;
      publishTools();
      return unregister;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      const controllers = Array.from(registrations.values(), ({ controller }) => controller);
      registrations.clear();
      for (const controller of controllers) controller.abort();
      scheduler.batch(() => {
        publishTools();
        calls.set(new Map());
      });
    },
  };
}
