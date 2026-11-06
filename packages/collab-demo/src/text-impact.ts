import type { DevtoolsExtension, ProseMirrorInspector } from "prosemirror-inspector/core";

type TextImpactSample =
  | { kind: "current"; characters: number }
  | { kind: "dispatch"; before: number; after: number };

const descriptor = {
  id: "kitchen-sink-text-impact",
  version: "1",
  label: "Text impact",
  description: "Counts the text characters before and after an editor dispatch.",
  prerequisites: [],
};

const characters = (text: string): number => Array.from(text).length;

export const textImpactInspector: ProseMirrorInspector<TextImpactSample> = {
  descriptor,
  read({ state }) {
    return {
      kind: "available",
      value: { kind: "current", characters: characters(state.doc.textContent) },
    };
  },
  capture({ beforeState, stateAfter }) {
    return {
      kind: "available",
      value: {
        kind: "dispatch",
        before: characters(beforeState.doc.textContent),
        after: characters(stateAfter.doc.textContent),
      },
    };
  },
};

export const textImpactExtension: DevtoolsExtension = {
  id: "kitchen-sink-text-impact-ui",
  panels: [],
  dispatchPresenters: [
    {
      inspectorId: descriptor.id,
      version: descriptor.version,
      present({ value }) {
        if (
          !value ||
          typeof value !== "object" ||
          Array.isArray(value) ||
          value.kind !== "dispatch"
        )
          return;
        const { before, after } = value;
        if (typeof before !== "number" || typeof after !== "number" || before === after) return;
        const delta = after - before;
        return {
          badge: "Text impact",
          listLabel: `${delta > 0 ? "+" : ""}${delta} characters`,
          label: delta > 0 ? "Text added" : "Text removed",
          text: `${before} → ${after} characters`,
          note: "Counts Unicode code points in the document text.",
        };
      },
    },
  ],
};
