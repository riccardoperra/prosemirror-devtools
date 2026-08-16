import type { EditorState, Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { prosemirrorDevtoolsStore } from "../store/create-devtools-store";
import { monotonicNow } from "../store/transaction-measurement";
import type {
  AttachProseMirrorDevtoolsOptions,
  DevtoolsStore,
  TransactionMeasurement,
} from "../types";
import { createCustomDispatchObserver } from "./observe-custom-dispatch";

type CaptureAppliedTransactions = (transactions: readonly Transaction[] | undefined) => void;

export function recordSynchronousDispatch({
  store,
  options,
  transaction,
  beforeState,
  getState,
  run,
}: {
  store: DevtoolsStore;
  options: AttachProseMirrorDevtoolsOptions;
  transaction: Transaction;
  beforeState: EditorState;
  getState: () => EditorState;
  run: (
    measurement: TransactionMeasurement,
    captureAppliedTransactions: CaptureAppliedTransactions,
  ) => void;
}): void {
  const measurement = store.beginTransaction(
    options.id,
    transaction,
    beforeState,
    options.performanceMarks ?? true,
    options.performanceExtension,
    options.sessionId,
  );
  let appliedTransactions: readonly Transaction[] | undefined;
  let error: unknown;
  let didThrow = false;

  try {
    run(measurement, (transactions) => {
      appliedTransactions = transactions;
    });
  } catch (caught) {
    error = caught;
    didThrow = true;
    throw caught;
  } finally {
    store.finishTransaction(measurement, {
      stateAfter: getState(),
      ...(appliedTransactions === undefined ? {} : { appliedTransactions }),
      ...(didThrow ? { error } : {}),
    });
  }
}

export type ProseMirrorDispatchRecorder = Readonly<{
  record: (transaction: Transaction, dispatch: () => void) => void;
}>;

/** Records native framework dispatch middleware without replacing its dispatcher. */
export function createProseMirrorDispatchRecorder(
  options: AttachProseMirrorDevtoolsOptions,
): ProseMirrorDispatchRecorder {
  const store = options.store ?? prosemirrorDevtoolsStore;
  const view = options.view;
  const observer = createCustomDispatchObserver(view);

  return {
    record(transaction, dispatch) {
      recordSynchronousDispatch({
        store,
        options,
        transaction,
        beforeState: view.state,
        getState: () => view.state,
        run(measurement, captureAppliedTransactions) {
          const session = observer.begin(transaction, view.state);
          const startedAt = monotonicNow();
          try {
            dispatch();
          } finally {
            store.recordPhase(measurement, "customDispatch", monotonicNow() - startedAt, startedAt);
            const observation = session.finish();
            for (const timing of observation.applyTimings) {
              store.recordPhase(measurement, "apply", timing.duration, timing.startedAt);
            }
            for (const timing of observation.viewUpdateTimings) {
              store.recordPhase(measurement, "viewUpdate", timing.duration, timing.startedAt);
            }
            captureAppliedTransactions(observation.appliedTransactions);
          }
        },
      });
    },
  };
}

export function recordDefaultDispatch({
  options,
  store,
  view,
  transaction,
}: {
  options: AttachProseMirrorDevtoolsOptions;
  store: DevtoolsStore;
  view: EditorView;
  transaction: Transaction;
}): void {
  recordSynchronousDispatch({
    store,
    options,
    transaction,
    beforeState: view.state,
    getState: () => view.state,
    run(measurement, captureAppliedTransactions) {
      const applyStartedAt = monotonicNow();
      const applied = view.state.applyTransaction(transaction);
      store.recordPhase(measurement, "apply", monotonicNow() - applyStartedAt, applyStartedAt);
      captureAppliedTransactions(applied.transactions);

      const updateStartedAt = monotonicNow();
      try {
        view.updateState(applied.state);
      } finally {
        store.recordPhase(
          measurement,
          "viewUpdate",
          monotonicNow() - updateStartedAt,
          updateStartedAt,
        );
      }
    },
  });
}
