import type { EditorState, Transaction } from "prosemirror-state";

import { serializeDocument, serializeValue } from "../serialize";
import type {
  AppliedTransactionRecord,
  DevtoolsMarker,
  DispatchPhaseTiming,
  PluginTiming,
  SerializedValue,
  TransactionRecord,
} from "../types";

type TransactionRecordDetails = Pick<
  TransactionRecord,
  "transactions" | "selectionBefore" | "selectionAfter" | "docBefore" | "docAfter"
>;

function formatError(error: unknown): string | null {
  if (error == null) return null;
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function readMeta(transaction: Transaction): Record<string, SerializedValue> {
  const output: Record<string, SerializedValue> = {};
  const meta = (transaction as unknown as { meta?: Record<string, unknown> }).meta;
  if (!meta) return output;
  for (const [key, value] of Object.entries(meta)) output[key] = serializeValue(value);
  return output;
}

function readTransaction(transaction: Transaction, index: number): AppliedTransactionRecord {
  return {
    index,
    appended: index > 0,
    docChanged: transaction.docChanged,
    selectionSet: transaction.selectionSet,
    storedMarksSet: transaction.storedMarksSet,
    steps: transaction.steps.map((step) => serializeValue(step.toJSON())),
    meta: readMeta(transaction),
  };
}

export function createTransactionRecord({
  id,
  instanceId,
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
  let details: TransactionRecordDetails | undefined;

  const readDetails = (): TransactionRecordDetails => {
    if (details) return details;
    const docBefore = serializeDocument(beforeState.doc);
    details = {
      transactions: observedTransactions.map(readTransaction),
      selectionBefore: serializeValue(beforeState.selection.toJSON()),
      selectionAfter: serializeValue(stateAfter.selection.toJSON()),
      docBefore,
      docAfter: beforeState.doc === stateAfter.doc ? docBefore : serializeDocument(stateAfter.doc),
    };
    return details;
  };

  return {
    id,
    instanceId,
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
    get transactions() {
      return readDetails().transactions;
    },
    get selectionBefore() {
      return readDetails().selectionBefore;
    },
    get selectionAfter() {
      return readDetails().selectionAfter;
    },
    get docBefore() {
      return readDetails().docBefore;
    },
    get docAfter() {
      return readDetails().docAfter;
    },
    timings,
    markers,
    measureName,
    error: formatError(error),
  };
}
