import type { Node as ProseMirrorNode, Schema } from "prosemirror-model";
import type { EditorState, Plugin } from "prosemirror-state";

import type { PluginInspection, SchemaInspection, SerializedValue, StateInspection } from "./types";

export interface SerializeOptions {
  maxDepth?: number;
  maxEntries?: number;
  maxStringLength?: number;
}

const DEFAULT_OPTIONS: Required<SerializeOptions> = {
  maxDepth: 7,
  maxEntries: 100,
  maxStringLength: 20_000,
};

function constructorName(value: object): string {
  return value.constructor?.name || "Object";
}

export function serializeValue(value: unknown, options: SerializeOptions = {}): SerializedValue {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const seen = new WeakSet<object>();

  const visit = (current: unknown, depth: number): SerializedValue => {
    if (current == null) return null;
    if (typeof current === "boolean") return current;
    if (typeof current === "number") return Number.isFinite(current) ? current : String(current);
    if (typeof current === "string") {
      return current.length > config.maxStringLength
        ? `${current.slice(0, config.maxStringLength)}…`
        : current;
    }
    if (typeof current === "bigint") return `${current}n`;
    if (typeof current === "function") {
      return `[Function ${current.name || "anonymous"}]`;
    }
    if (typeof current === "symbol") return String(current);
    if (typeof current !== "object") return String(current);
    if (depth >= config.maxDepth) return `[${constructorName(current)}]`;
    if (seen.has(current)) return `[Circular ${constructorName(current)}]`;

    seen.add(current);
    try {
      if (current instanceof Date) return current.toISOString();
      if (current instanceof RegExp) return String(current);
      if (current instanceof Error) {
        return {
          name: current.name,
          message: current.message,
          stack: current.stack ?? null,
        };
      }
      if (typeof Element !== "undefined" && current instanceof Element) {
        return `<${current.tagName.toLowerCase()}>`;
      }
      if (current instanceof Map) {
        return Array.from(current.entries())
          .slice(0, config.maxEntries)
          .map(([key, entry]) => [visit(key, depth + 1), visit(entry, depth + 1)]);
      }
      if (current instanceof Set) {
        return Array.from(current.values())
          .slice(0, config.maxEntries)
          .map((entry) => visit(entry, depth + 1));
      }
      if (Array.isArray(current)) {
        const result = current.slice(0, config.maxEntries).map((entry) => visit(entry, depth + 1));
        if (current.length > config.maxEntries) {
          result.push(`[+${current.length - config.maxEntries} more]`);
        }
        return result;
      }

      const maybeToJSON = current as { toJSON?: () => unknown };
      if (typeof maybeToJSON.toJSON === "function") {
        try {
          const json = maybeToJSON.toJSON();
          if (json !== current) return visit(json, depth + 1);
        } catch {
          // Some third-party plugin values expose a context-sensitive toJSON.
        }
      }

      const result: Record<string, SerializedValue> = {};
      const entries = Object.entries(current).slice(0, config.maxEntries);
      for (const [key, entry] of entries) result[key] = visit(entry, depth + 1);
      const extra = Object.keys(current).length - entries.length;
      if (extra > 0) result["…"] = `[+${extra} more]`;
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `[Unserializable ${constructorName(current)}: ${message}]`;
    } finally {
      seen.delete(current);
    }
  };

  return visit(value, 0);
}

export function inspectState(state: EditorState): StateInspection {
  const { $from } = state.selection;
  const activeMarks = state.storedMarks ?? $from.marks();
  let serializedDocument: SerializedValue | undefined;
  return {
    get doc() {
      serializedDocument ??= serializeValue(state.doc.toJSON(), { maxDepth: 20 });
      return serializedDocument;
    },
    selection: serializeValue({
      ...state.selection.toJSON(),
      from: state.selection.from,
      to: state.selection.to,
      anchor: state.selection.anchor,
      head: state.selection.head,
      empty: state.selection.empty,
    }),
    storedMarks: serializeValue(state.storedMarks?.map((mark) => mark.toJSON()) ?? []),
    activeMarks: serializeValue(activeMarks.map((mark) => mark.toJSON())),
    stats: {
      nodeSize: state.doc.nodeSize,
      childCount: state.doc.childCount,
      textSize: state.doc.textBetween(0, state.doc.content.size).length,
    },
  };
}

export function inspectPlugins(state: EditorState): PluginInspection[] {
  return state.plugins.map((plugin: Plugin, index) => {
    let pluginState: unknown;
    let hasState: boolean;
    try {
      pluginState = plugin.getState(state);
      hasState = pluginState !== undefined;
    } catch (error) {
      pluginState = error;
      hasState = true;
    }
    return {
      key: (plugin as unknown as { key: string }).key,
      index,
      hasState,
      state: serializeValue(pluginState),
      props: Object.keys(plugin.props).sort(),
    };
  });
}

function inspectSpecMap(schema: Schema, kind: "nodes" | "marks"): SerializedValue {
  const map = schema.spec[kind];
  const output: Record<string, SerializedValue> = {};
  map.forEach((name, spec) => {
    output[name] = serializeValue(spec, {
      maxDepth: 5,
      maxEntries: 50,
      maxStringLength: 2_000,
    });
  });
  return output;
}

export function inspectSchema(schema: Schema): SchemaInspection {
  return {
    nodes: inspectSpecMap(schema, "nodes"),
    marks: inspectSpecMap(schema, "marks"),
    topNodeType: schema.topNodeType.name,
  };
}

export function serializeDocument(node: ProseMirrorNode): SerializedValue {
  // ProseMirror's document JSON is already acyclic and JSON-safe. Keep the
  // complete value because transaction time-travel and snapshots must remain
  // restorable even for deeply nested or very large documents.
  return node.toJSON() as SerializedValue;
}
