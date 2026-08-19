import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { EditorState, Transaction } from "prosemirror-state";

import { serializeDocument } from "../serialize";
import type {
  AppliedTransactionRecord,
  DevtoolsMarker,
  DispatchPhaseTiming,
  PluginTiming,
  TransactionRecord,
} from "../types";

type SerializedDocuments = Pick<TransactionRecord, "docBefore" | "docAfter">;

function formatError(error: unknown): string | null {
  if (error == null) return null;
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function readMeta(transaction: Transaction): Record<string, unknown> {
  const meta = (transaction as unknown as { meta?: Record<string, unknown> }).meta;
  return meta ? { ...meta } : {};
}

function readTransaction(transaction: Transaction, index: number): AppliedTransactionRecord {
  return {
    index,
    appended: index > 0,
    docChanged: transaction.docChanged,
    selectionSet: transaction.selectionSet,
    storedMarksSet: transaction.storedMarksSet,
    steps: transaction.steps.map((step) => step.toJSON()),
    meta: readMeta(transaction),
  };
}

export function createTransactionRecord({
  id,
  instanceId,
  sessionId,
  timestamp,
  totalDuration,
  beforeState,
  stateAfter,
  rootTransaction,
  appliedTransactions,
  phases,
  phaseTimings,
  timings,
  markers,
  measureName,
  error,
}: {
  id: number;
  instanceId: string;
  sessionId: string;
  timestamp: number;
  totalDuration: number;
  beforeState: EditorState;
  stateAfter: EditorState;
  rootTransaction: Transaction;
  appliedTransactions: readonly Transaction[] | undefined;
  phases: {
    apply: number | null;
    viewUpdate: number | null;
    customDispatch: number | null;
  };
  phaseTimings: readonly DispatchPhaseTiming[];
  timings: readonly PluginTiming[];
  markers: readonly DevtoolsMarker[];
  measureName: string | null;
  error: unknown;
}): TransactionRecord {
  const applicationKnown = appliedTransactions !== undefined;
  const applied = appliedTransactions ? Array.from(appliedTransactions) : [];
  const observedTransactions = applicationKnown ? applied : [rootTransaction];
  // Capture the small ProseMirror JSON payloads now; only full documents stay lazy.
  const transactionDetails = observedTransactions.map(readTransaction);
  const selectionBefore = beforeState.selection.toJSON();
  const selectionAfter = stateAfter.selection.toJSON();
  let beforeDoc: ProseMirrorNode | null = beforeState.doc;
  let afterDoc: ProseMirrorNode | null = stateAfter.doc;
  let documents: SerializedDocuments | null = null;

  const readDocuments = (): SerializedDocuments => {
    if (documents) return documents;
    const docBefore = serializeDocument(beforeDoc as ProseMirrorNode);
    documents = {
      docBefore,
      docAfter: beforeDoc === afterDoc ? docBefore : serializeDocument(afterDoc as ProseMirrorNode),
    };
    // The serialized values replace the raw document roots after the first read.
    beforeDoc = null;
    afterDoc = null;
    return documents;
  };

  return {
    id,
    instanceId,
    sessionId,
    timestamp,
    totalDuration,
    applyDuration: phases.apply,
    viewUpdateDuration: phases.viewUpdate,
    customDispatchDuration: phases.customDispatch,
    phaseTimings,
    applicationStatus: applicationKnown
      ? applied.length === 0
        ? "filtered"
        : "applied"
      : "unknown",
    appliedTransactionCount: applicationKnown ? applied.length : null,
    appendedTransactionCount: applicationKnown ? Math.max(0, applied.length - 1) : null,
    filtered: applicationKnown ? applied.length === 0 : null,
    docChanged: observedTransactions.some((transaction) => transaction.docChanged),
    selectionSet: observedTransactions.some((transaction) => transaction.selectionSet),
    storedMarksSet: observedTransactions.some((transaction) => transaction.storedMarksSet),
    stepCount: observedTransactions.reduce(
      (count, transaction) => count + transaction.steps.length,
      0,
    ),
    transactions: transactionDetails,
    selectionBefore,
    selectionAfter,
    get docBefore() {
      return readDocuments().docBefore;
    },
    get docAfter() {
      return readDocuments().docAfter;
    },
    timings,
    markers,
    measureName,
    error: formatError(error),
  };
}
