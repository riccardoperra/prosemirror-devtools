import { history, isHistoryTransaction, redoDepth, undoDepth } from "prosemirror-history";
import type { EditorState, Plugin, PluginKey, Transaction } from "prosemirror-state";

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
  /**
   * The history() plugin installed in this editor, including an instrumented copy. When omitted,
   * the inspector finds the installed history plugin in each state it reads.
   */
  readonly plugin?: Plugin;
}

// prosemirror-history does not export its PluginKey, but every history() plugin carries it in its
// public spec. It is the key undoDepth and redoDepth read, so a state where it resolves is a state
// those functions describe.
const historyKey = history().spec.key as PluginKey;

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
}: HistoryInspectorOptions = {}): ProseMirrorInspector<HistoryInspection> {
  const installed = plugin ?? historyKey;
  const unavailable: InspectionEvidence<never> = {
    kind: "unsupported",
    reason:
      plugin === undefined
        ? "No prosemirror-history plugin is installed in this state."
        : "The supplied prosemirror-history plugin is not installed in this state.",
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
        "A history() plugin installed in the editor, such as Tiptap's UndoRedo extension",
      ],
    },
    read({ state }) {
      if (installed.getState(state) === undefined) return unavailable;
      return { kind: "available", value: { kind: "state", depths: depths(state) } };
    },
    capture({ beforeState, stateAfter, transaction, appliedTransactions }) {
      if (
        installed.getState(beforeState) === undefined ||
        installed.getState(stateAfter) === undefined
      )
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
