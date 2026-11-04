import { isHistoryTransaction, redoDepth, undoDepth } from "prosemirror-history";
import type { EditorState, Plugin, Transaction } from "prosemirror-state";

import type { InspectionEvidence, ProseMirrorInspector } from "../inspection/types";

export interface HistoryDepths {
  readonly undoDepth: number;
  readonly redoDepth: number;
}

export interface HistoryTransactionMetadata {
  readonly historyTransaction: boolean;
  readonly addToHistory: "excluded" | "included" | "unspecified";
}

export type HistoryInspection =
  | { readonly kind: "state"; readonly depths: HistoryDepths }
  | {
      readonly kind: "dispatch";
      readonly before: HistoryDepths;
      readonly after: HistoryDepths;
      readonly root: HistoryTransactionMetadata;
      readonly applied: readonly HistoryTransactionMetadata[] | null;
    };

export interface HistoryInspectorOptions {
  /** The actual history() plugin installed in this editor, including an instrumented copy. */
  readonly plugin: Plugin;
}

function depths(state: EditorState): HistoryDepths {
  return { undoDepth: undoDepth(state), redoDepth: redoDepth(state) };
}

function metadata(transaction: Transaction): HistoryTransactionMetadata {
  const addToHistory: unknown = transaction.getMeta("addToHistory");
  return {
    historyTransaction: isHistoryTransaction(transaction),
    addToHistory:
      addToHistory === false ? "excluded" : addToHistory === undefined ? "unspecified" : "included",
  };
}

/** Uses public history APIs. It does not inspect or retain private undo branches. */
export function createHistoryInspector({
  plugin,
}: HistoryInspectorOptions): ProseMirrorInspector<HistoryInspection> {
  const unavailable: InspectionEvidence<never> = {
    kind: "unsupported",
    reason: "The supplied prosemirror-history plugin is not installed in this state.",
  };
  return {
    descriptor: {
      id: "prosemirror-history",
      version: "1",
      label: "Undo history",
      description:
        "Public undo and redo depths, history transaction classification, and observed addToHistory metadata. Dispatches and undo events are distinct.",
      prerequisites: [
        "prosemirror-history",
        "An explicit history() plugin instance installed in the editor",
      ],
    },
    read({ state }) {
      if (plugin.getState(state) === undefined) return unavailable;
      return { kind: "available", value: { kind: "state", depths: depths(state) } };
    },
    capture({ beforeState, stateAfter, transaction, appliedTransactions }) {
      if (plugin.getState(beforeState) === undefined || plugin.getState(stateAfter) === undefined)
        return unavailable;
      return {
        kind: "available",
        value: {
          kind: "dispatch",
          before: depths(beforeState),
          after: depths(stateAfter),
          root: metadata(transaction),
          applied: appliedTransactions === undefined ? null : appliedTransactions.map(metadata),
        },
      };
    },
  };
}
