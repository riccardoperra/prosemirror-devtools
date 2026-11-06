import type { EditorState, Plugin } from "prosemirror-state";

import {
  resolveInspectionLimits,
  serializeInspectorEvidence,
  serializeInspectionValue,
} from "./serialization";
import type { InspectionEvidence, InspectionLimits, ProseMirrorInspector } from "./types";

export interface PluginStateInspectorOptions<T> {
  readonly id: string;
  readonly label?: string;
  readonly plugin: Plugin<T>;
  readonly serialize: (value: T, state: EditorState) => unknown;
  readonly limits?: Partial<InspectionLimits>;
}

export function createPluginStateInspector<T>(
  options: PluginStateInspectorOptions<T>,
): ProseMirrorInspector {
  const limits = resolveInspectionLimits(options.limits);
  const read = (state: EditorState): InspectionEvidence =>
    serializeInspectorEvidence(() => {
      const value = options.plugin.getState(state);
      return value === undefined
        ? { kind: "unobserved", reason: "The selected plugin has no state in this editor." }
        : serializeInspectionValue(options.serialize(value, state), limits);
    }, limits);

  return {
    descriptor: {
      id: options.id,
      version: "1",
      label: options.label ?? options.id,
      description: "Selected plugin state serialized at the dispatch boundaries.",
      prerequisites: ["Register the selected plugin and provide its semantic serializer."],
    },
    read: ({ state }) => read(state),
    captureBefore: ({ state }) => read(state),
    capture(context) {
      const before = context.beforeProjection ?? {
        kind: "unobserved",
        reason: "No before projection was captured.",
      };
      if (before.kind !== "available") {
        return { kind: before.kind, reason: `Before projection: ${before.reason}` };
      }
      const after = read(context.stateAfter);
      if (after.kind !== "available") {
        return { kind: after.kind, reason: `After projection: ${after.reason}` };
      }
      return {
        kind: "available",
        value: {
          before: { kind: "available", value: before.value },
          after: { kind: "available", value: after.value },
          changed: JSON.stringify(before.value) !== JSON.stringify(after.value),
          scope: "synchronous-dispatch",
          externalMutations: "unobserved",
        },
      };
    },
  };
}
