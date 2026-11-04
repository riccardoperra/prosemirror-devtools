import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { EditorState, Transaction } from "prosemirror-state";

import { serializeDocument } from "../serialize";
import { describeInspectionError } from "../../inspection/serialization";
import { captureStepDetails } from "../transaction-changes";
import type {
  AppliedTransactionRecord,
  DevtoolsMarker,
  DispatchPhaseTiming,
  PluginTiming,
  TransactionRecord,
} from "../types";

type SerializedDocuments = Pick<TransactionRecord, "docBefore" | "docAfter">;
const recordedDocuments = new WeakMap<
  TransactionRecord,
  { before: ProseMirrorNode; after: ProseMirrorNode }
>();

export function getRecordedTransactionDocument(
  record: TransactionRecord,
  phase: "before" | "after",
): ProseMirrorNode | undefined {
  return recordedDocuments.get(record)?.[phase];
}

function readMeta(transaction: Transaction): Record<string, unknown> {
  const descriptor = Object.getOwnPropertyDescriptor(transaction, "meta");
  if (descriptor && !("value" in descriptor))
    throw new TypeError("Transaction metadata is an accessor.");
  const meta: unknown = descriptor?.value;
  const result: Record<string, unknown> = {};
  if (meta === null || typeof meta !== "object") return result;
  for (const key of Object.keys(meta)) {
    const field = Object.getOwnPropertyDescriptor(meta, key);
    if (!field || !("value" in field))
      throw new TypeError("Transaction metadata contains an accessor.");
    Object.defineProperty(result, key, {
      value: field.value,
      enumerable: true,
      configurable: true,
    });
  }
  return result;
}

function readTransaction(transaction: Transaction, index: number): AppliedTransactionRecord {
  const errors: string[] = [];
  const read = <T>(run: () => T, fallback: T): T => {
    try {
      return run();
    } catch (error) {
      errors.push(describeInspectionError(error));
      return fallback;
    }
  };
  const steps = read(() => transaction.steps.map((step) => step.toJSON()), []);
  const stepDetails = read(() => captureStepDetails(transaction), undefined);
  const meta = read(() => readMeta(transaction), {});
  return {
    index,
    appended: index > 0,
    docChanged: transaction.docChanged,
    selectionSet: transaction.selectionSet,
    storedMarksSet: transaction.storedMarksSet,
    steps,
    ...(stepDetails ? { stepDetails } : {}),
    meta,
    ...(errors.length > 0 ? { captureError: errors.join("; ") } : {}),
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
  inspection,
  didThrow = false,
  captureError,
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
  inspection?: TransactionRecord["inspection"];
  didThrow?: boolean;
  captureError?: unknown;
}): TransactionRecord {
  const applicationKnown = appliedTransactions !== undefined;
  const applied = appliedTransactions ? Array.from(appliedTransactions) : [];
  const observedTransactions = applicationKnown ? applied : [rootTransaction];
  // Capture the small ProseMirror JSON payloads now; only full documents stay lazy.
  const transactionDetails = observedTransactions.map(readTransaction);
  const captureErrors = transactionDetails.flatMap((transaction) =>
    transaction.captureError ? [transaction.captureError] : [],
  );
  if (captureError !== undefined) captureErrors.push(describeInspectionError(captureError));
  const readSelection = (state: EditorState): TransactionRecord["selectionAfter"] => {
    try {
      return state.selection.toJSON();
    } catch (error) {
      captureErrors.push(describeInspectionError(error));
      return null;
    }
  };
  const selectionBefore = readSelection(beforeState);
  const selectionAfter = readSelection(stateAfter);
  let documents:
    | { kind: "pending"; before: ProseMirrorNode; after: ProseMirrorNode }
    | { kind: "serialized"; value: SerializedDocuments } = {
    kind: "pending",
    before: beforeState.doc,
    after: stateAfter.doc,
  };

  const readDocuments = (): SerializedDocuments => {
    if (documents.kind === "serialized") return documents.value;
    const docBefore = serializeDocument(documents.before);
    const value = {
      docBefore,
      docAfter:
        documents.before === documents.after ? docBefore : serializeDocument(documents.after),
    };
    documents = { kind: "serialized", value };
    return value;
  };

  const record: TransactionRecord = {
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
    error: didThrow ? describeInspectionError(error) : null,
    ...(captureErrors.length > 0 ? { captureErrors } : {}),
    ...(inspection ? { inspection } : {}),
  };
  recordedDocuments.set(record, { before: beforeState.doc, after: stateAfter.doc });
  return record;
}
