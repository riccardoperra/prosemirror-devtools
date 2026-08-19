import type { Node as ProseMirrorNode, Schema } from "prosemirror-model";
import type { EditorState, Plugin } from "prosemirror-state";

import type { PluginInspection, SchemaInspection, SerializedValue, StateInspection } from "./types";

export function inspectState(state: EditorState): StateInspection {
  const { $from } = state.selection;
  const activeMarks = state.storedMarks ?? $from.marks();
  let serializedDocument: SerializedValue | undefined;
  return {
    get doc() {
      serializedDocument ??= serializeDocument(state.doc);
      return serializedDocument;
    },
    selection: {
      ...state.selection.toJSON(),
      from: state.selection.from,
      to: state.selection.to,
      anchor: state.selection.anchor,
      head: state.selection.head,
      empty: state.selection.empty,
    },
    storedMarks: state.storedMarks?.map((mark) => mark.toJSON()) ?? [],
    activeMarks: activeMarks.map((mark) => mark.toJSON()),
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
      state: pluginState,
      props: Object.keys(plugin.props).sort(),
    };
  });
}

function inspectSpecMap(schema: Schema, kind: "nodes" | "marks"): Record<string, unknown> {
  const map = schema.spec[kind];
  const output: Record<string, unknown> = {};
  map.forEach((name, spec) => {
    output[name] = spec;
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
