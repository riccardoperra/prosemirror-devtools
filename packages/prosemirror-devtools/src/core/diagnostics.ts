import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { Decoration, DecorationSource } from "prosemirror-view";

import { monotonicNow } from "./store/transaction-measurement";

type SafeMetadata = Readonly<Record<string, string | number | boolean | null>>;

export interface DevtoolsDiagnosticsOptions {
  /** Maximum retained events, NodeViews, decoration sources, and ranges per source. Defaults to 200. */
  limit?: number;
}

export interface DevtoolsDiagnosticEvent {
  id: number;
  parentId: number | null;
  kind: "prop" | "dom-event" | "command";
  name: string;
  pluginKey: string | null;
  pluginLabel: string | null;
  timestamp: number;
  duration: number;
  handled: boolean | null;
  error: string | null;
  metadata: SafeMetadata;
  dispatches: readonly { instanceId: string; id: number }[];
}

export interface DevtoolsDecorationRange {
  from: number;
  to: number;
  kind: "inline" | "node" | "widget";
  spec: SafeMetadata;
}

export interface DevtoolsDecorationSource {
  id: string;
  pluginKey: string;
  pluginLabel: string;
  observedAt: number;
  stale: boolean;
  ranges: readonly DevtoolsDecorationRange[];
}

export interface DevtoolsNodeViewRecord {
  id: number;
  pluginKey: string;
  pluginLabel: string;
  nodeType: string;
  position: number | null;
  createdAt: number;
  updatedAt: number;
  destroyed: boolean;
  updates: number;
  destroys: number;
  totalDuration: number;
  lastDuration: number;
  error: string | null;
}

export interface DevtoolsDiagnosticsSnapshot {
  version: number;
  events: readonly DevtoolsDiagnosticEvent[];
  decorations: readonly DevtoolsDecorationSource[];
  nodeViews: readonly DevtoolsNodeViewRecord[];
}

export interface DevtoolsDiagnosticsController {
  getSnapshot(): DevtoolsDiagnosticsSnapshot;
  subscribe(listener: () => void): () => void;
  clearEvents(): void;
  /** Remove destroyed records and reset live counters without disabling their tracking. */
  clearNodeViews(): void;
  /** Trace one synchronous command invocation. Deferred work is outside this trace. */
  traceCommand<T>(name: string, run: () => T): T;
  dispose(): void;
}

type EventSource = Pick<DevtoolsDiagnosticEvent, "kind" | "name" | "pluginKey" | "pluginLabel">;
export interface DevtoolsNodeViewTracker {
  run<T>(operation: string, run: () => T): T;
}

export interface DevtoolsDiagnosticsRecorder {
  traceEvent<T>(source: EventSource, args: readonly unknown[], run: () => T): T;
  observeDecorations(
    pluginKey: string,
    pluginLabel: string,
    doc: ProseMirrorNode,
    source: DecorationSource | null | undefined,
  ): void;
  nodeView(
    pluginKey: string,
    pluginLabel: string,
    nodeType: string,
    getPos: unknown,
  ): DevtoolsNodeViewTracker;
  recordDispatch(instanceId: string, id: number): void;
  observeDocument(doc: ProseMirrorNode): void;
}

const recorders = new WeakMap<DevtoolsDiagnosticsController, DevtoolsDiagnosticsRecorder>();

export function getDiagnosticsRecorder(
  diagnostics: DevtoolsDiagnosticsController | undefined,
): DevtoolsDiagnosticsRecorder | undefined {
  return diagnostics ? recorders.get(diagnostics) : undefined;
}

function describeError(error: unknown): string {
  try {
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  } catch {
    return "Unprintable thrown value";
  }
}

/** Copy shallow scalar fields only; never retain functions, DOM nodes, events, or arbitrary graphs. */
function scalarMetadata(value: unknown, keys?: readonly string[]): SafeMetadata {
  const result: Record<string, string | number | boolean | null> = {};
  if (!value || typeof value !== "object") return result;
  let fields: readonly string[];
  try {
    fields = keys ?? Object.keys(value);
  } catch {
    return result;
  }
  for (const key of fields.slice(0, 24)) {
    try {
      // Decoration specs are application data: inspect data descriptors without running getters.
      const descriptor = keys ? undefined : Object.getOwnPropertyDescriptor(value, key);
      if (!keys && (!descriptor || !("value" in descriptor))) continue;
      const field = keys ? (value as Record<string, unknown>)[key] : descriptor?.value;
      if (
        field === null ||
        typeof field === "boolean" ||
        (typeof field === "number" && Number.isFinite(field))
      ) {
        result[key] = field;
      } else if (typeof field === "string") {
        result[key] = field.slice(0, 120);
      }
    } catch {
      // A diagnostic read must not affect an application's accessor or handler.
    }
  }
  return result;
}

function eventMetadata(args: readonly unknown[]): SafeMetadata {
  // Event text, key characters, clipboard contents, targets, and transfer payloads are excluded.
  const event = args.find((value) => {
    try {
      return (
        value && typeof value === "object" && typeof (value as { type?: unknown }).type === "string"
      );
    } catch {
      return false;
    }
  });
  return scalarMetadata(event, [
    "type",
    "code",
    "altKey",
    "ctrlKey",
    "metaKey",
    "shiftKey",
    "repeat",
    "button",
    "buttons",
    "isComposing",
    "inputType",
    "defaultPrevented",
  ]);
}

/** Opt-in bounded capture independent of transaction history and panel rendering. */
export function createProseMirrorDevtoolsDiagnostics(
  options: DevtoolsDiagnosticsOptions = {},
): DevtoolsDiagnosticsController {
  const limit = Number.isFinite(options.limit)
    ? Math.max(1, Math.min(10_000, Math.floor(options.limit!)))
    : 200;
  let disposed = false;
  let version = 0;
  let nextEventId = 0;
  let nextNodeViewId = 0;
  let events: DevtoolsDiagnosticEvent[] = [];
  const activeEvents: DevtoolsDiagnosticEvent[] = [];
  const decorations = new Map<
    string,
    { value: DevtoolsDecorationSource; doc: WeakRef<ProseMirrorNode> }
  >();
  const nodeViews = new Map<
    number,
    {
      value: DevtoolsNodeViewRecord;
      published?: DevtoolsNodeViewRecord;
      getPos?: WeakRef<() => unknown>;
    }
  >();
  const listeners = new Set<() => void>();
  let currentDocument: WeakRef<ProseMirrorNode> | undefined;
  let snapshot: DevtoolsDiagnosticsSnapshot = {
    version,
    events: [],
    decorations: [],
    nodeViews: [],
  };

  const publish = (): void => {
    if (disposed) return;
    const doc = currentDocument?.deref();
    snapshot = {
      version: ++version,
      events,
      decorations: Array.from(decorations.values(), (entry) => {
        const stale = entry.doc.deref() !== doc;
        if (entry.value.stale !== stale) entry.value = { ...entry.value, stale };
        return entry.value;
      }),
      nodeViews: Array.from(nodeViews.values(), (entry) => {
        const { value, getPos } = entry;
        let position: number | null = null;
        if (!value.destroyed) {
          try {
            const current = getPos?.deref()?.();
            if (typeof current === "number" && Number.isFinite(current)) position = current;
          } catch {
            // A removed view can stop resolving before its destroy hook finishes.
          }
        }
        if (!entry.published || entry.published.position !== position)
          entry.published = { ...value, position };
        return entry.published;
      }),
    };
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        console.error("[prosemirror-inspector] Diagnostics subscriber failed", error);
      }
    }
  };

  const traceEvent = <T>(source: EventSource, args: readonly unknown[], run: () => T): T => {
    if (disposed) return run();
    const startedAt = monotonicNow();
    const event: DevtoolsDiagnosticEvent = {
      ...source,
      id: ++nextEventId,
      parentId: activeEvents.at(-1)?.id ?? null,
      timestamp: Date.now(),
      duration: 0,
      handled: null,
      error: null,
      metadata: eventMetadata(args),
      dispatches: [],
    };
    activeEvents.push(event);
    try {
      const result = run();
      event.handled = typeof result === "boolean" ? result : null;
      return result;
    } catch (error) {
      event.error = describeError(error);
      throw error;
    } finally {
      const index = activeEvents.lastIndexOf(event);
      if (index >= 0) activeEvents.splice(index, 1);
      if (!disposed) {
        event.duration = Math.max(0, monotonicNow() - startedAt);
        events = [...events, event].sort((a, b) => a.id - b.id).slice(-limit);
        publish();
      }
    }
  };

  const recorder: DevtoolsDiagnosticsRecorder = {
    traceEvent,
    recordDispatch(instanceId, id) {
      if (disposed) return;
      for (const event of activeEvents)
        event.dispatches = [...event.dispatches, { instanceId, id }].slice(-limit);
    },
    observeDocument(doc) {
      if (disposed) return;
      currentDocument = new WeakRef(doc);
      publish();
    },
    observeDecorations(pluginKey, pluginLabel, doc, source) {
      if (disposed) return;
      try {
        const ranges: DevtoolsDecorationRange[] = [];
        const appendSet = (set: {
          find(start?: number, end?: number, predicate?: (spec: unknown) => boolean): Decoration[];
        }): void => {
          if (ranges.length >= limit) return;
          let remaining = limit - ranges.length;
          // The predicate bounds the temporary result array as well as retained ranges.
          for (const decoration of set
            .find(undefined, undefined, () => remaining-- > 0)
            .slice(0, limit - ranges.length)) {
            // ProseMirror exposes these variant flags at runtime, though not in its public typings.
            const flags = decoration as Decoration & { inline?: boolean; widget?: boolean };
            ranges.push({
              from: decoration.from,
              to: decoration.to,
              kind:
                flags.widget || decoration.from === decoration.to
                  ? "widget"
                  : flags.inline
                    ? "inline"
                    : "node",
              spec: scalarMetadata(decoration.spec),
            });
          }
        };
        if (source) {
          if (typeof source.forEachSet === "function") source.forEachSet(appendSet);
          else if ("find" in source && typeof source.find === "function")
            appendSet(source as unknown as { find(): Decoration[] });
        }
        currentDocument = new WeakRef(doc);
        decorations.delete(pluginKey);
        decorations.set(pluginKey, {
          doc: new WeakRef(doc),
          value: {
            id: pluginKey,
            pluginKey,
            pluginLabel,
            observedAt: Date.now(),
            stale: false,
            ranges,
          },
        });
        while (decorations.size > limit) decorations.delete(decorations.keys().next().value!);
        publish();
      } catch {
        // Custom DecorationSource implementations remain usable even if they cannot be inspected.
      }
    },
    nodeView(pluginKey, pluginLabel, nodeType, getPos) {
      const id = ++nextNodeViewId;
      let positionReader = typeof getPos === "function" ? (getPos as () => unknown) : undefined;
      if (!disposed) {
        const now = Date.now();
        nodeViews.set(id, {
          value: {
            id,
            pluginKey,
            pluginLabel,
            nodeType,
            position: null,
            createdAt: now,
            updatedAt: now,
            destroyed: false,
            updates: 0,
            destroys: 0,
            totalDuration: 0,
            lastDuration: 0,
            error: null,
          },
          ...(positionReader ? { getPos: new WeakRef(positionReader) } : {}),
        });
        while (nodeViews.size > limit) nodeViews.delete(nodeViews.keys().next().value!);
      }
      return {
        run<T>(operation: string, run: () => T): T {
          const entry = nodeViews.get(id);
          if (disposed || !entry) return run();
          const startedAt = monotonicNow();
          delete entry.published;
          if (operation === "update") entry.value.updates += 1;
          if (operation === "destroy") {
            positionReader = undefined;
            entry.value.destroys += 1;
            entry.value.destroyed = true;
            delete entry.getPos;
          }
          try {
            return run();
          } catch (error) {
            entry.value.error = describeError(error);
            if (operation === "create") {
              entry.value.destroyed = true;
              delete entry.getPos;
            }
            throw error;
          } finally {
            entry.value.lastDuration = Math.max(0, monotonicNow() - startedAt);
            entry.value.totalDuration += entry.value.lastDuration;
            entry.value.updatedAt = Date.now();
            publish();
          }
        },
      };
    },
  };

  const controller: DevtoolsDiagnosticsController = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clearEvents() {
      events = [];
      publish();
    },
    clearNodeViews() {
      for (const [id, entry] of nodeViews) {
        if (entry.value.destroyed) {
          nodeViews.delete(id);
        } else {
          entry.value = {
            ...entry.value,
            updates: 0,
            destroys: 0,
            totalDuration: 0,
            lastDuration: 0,
            error: null,
          };
          delete entry.published;
        }
      }
      publish();
    },
    traceCommand: (name, run) =>
      traceEvent({ kind: "command", name, pluginKey: null, pluginLabel: null }, [], run),
    dispose() {
      if (disposed) return;
      disposed = true;
      events = [];
      activeEvents.length = 0;
      decorations.clear();
      nodeViews.clear();
      currentDocument = undefined;
      snapshot = { version: ++version, events: [], decorations: [], nodeViews: [] };
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch (error) {
          console.error("[prosemirror-inspector] Diagnostics subscriber failed", error);
        }
      }
      listeners.clear();
      recorders.delete(controller);
    },
  };
  recorders.set(controller, recorder);
  return controller;
}
