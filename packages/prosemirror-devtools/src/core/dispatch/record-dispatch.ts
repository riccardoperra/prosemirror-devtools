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

/**
 * Receives the exact transactions returned by the root `applyTransaction` call. `undefined`
 * represents an unknown outcome; an empty array represents a transaction that was filtered out.
 */
type CaptureAppliedTransactions = (transactions: readonly Transaction[] | undefined) => void;

type RecordSynchronousDispatchOptions = {
  /** Store that owns the transaction measurement and resulting record. */
  store: DevtoolsStore;
  /** Attachment identity and optional performance settings. */
  options: AttachProseMirrorDevtoolsOptions;
  /** Root transaction handed to the dispatcher. */
  transaction: Transaction;
  /** Editor state captured immediately before dispatch begins. */
  beforeState: EditorState;
  /** Reads the editor state again after dispatch succeeds or throws. */
  getState: () => EditorState;
  /** Performs the dispatch and records any phases visible to its implementation. */
  run: (
    measurement: TransactionMeasurement,
    captureAppliedTransactions: CaptureAppliedTransactions,
  ) => void;
};

/**
 * Runs one synchronous dispatch inside the common transaction-recording lifecycle.
 *
 * Both default and custom dispatchers use this boundary so they produce records with identical
 * before/after-state and error semantics. A thrown value is captured for the record and then
 * rethrown unchanged; `finishTransaction` always runs so failed editor work is visible in the
 * devtools as well.
 */
export function recordSynchronousDispatch({
  store,
  options,
  transaction,
  beforeState,
  getState,
  run,
}: RecordSynchronousDispatchOptions): void {
  const measurement = store.beginTransaction(
    options.id,
    transaction,
    beforeState,
    options.performanceMarks ?? true,
    options.performanceExtension,
    options.sessionId,
  );
  // Keep `undefined` distinct from `[]`: only the latter proves that ProseMirror filtered the
  // transaction. Custom dispatchers may not expose enough information to know either way.
  let appliedTransactions: readonly Transaction[] | undefined;
  let error: unknown;
  // A separate flag is required because JavaScript permits `throw undefined`.
  let didThrow = false;

  try {
    run(measurement, (transactions) => {
      appliedTransactions = transactions;
    });
  } catch (caught) {
    error = caught;
    didThrow = true;
    // Instrumentation observes failures but must preserve the dispatcher's control flow.
    throw caught;
  } finally {
    // Read the live state even after an exception: a dispatcher may update the view and then throw.
    store.finishTransaction(measurement, {
      stateAfter: getState(),
      ...(appliedTransactions === undefined ? {} : { appliedTransactions }),
      ...(didThrow ? { error } : {}),
    });
  }
}

/** Records a transaction while allowing the caller's dispatcher to retain control of execution. */
export type ProseMirrorDispatchRecorder = Readonly<{
  /** Runs `dispatch` synchronously and records all state/view work that can be observed. */
  record: (transaction: Transaction, dispatch: () => void) => void;
}>;

/**
 * Creates an adapter for framework dispatch middleware without replacing the framework's own
 * dispatcher. Public EditorState and EditorView methods are observed only for the duration of each
 * synchronous `record` call; deferred work remains unattributed.
 */
export function createProseMirrorDispatchRecorder(
  options: AttachProseMirrorDevtoolsOptions,
): ProseMirrorDispatchRecorder {
  const store = options.store ?? prosemirrorDevtoolsStore;
  const view = options.view;
  const observer = createCustomDispatchObserver(view);

  return {
    record(transaction, dispatch) {
      // Use one state identity throughout the measurement. This is also the state against which the
      // observer recognizes the root applyTransaction call.
      const beforeState = view.state;
      recordSynchronousDispatch({
        store,
        options,
        transaction,
        beforeState,
        getState: () => view.state,
        run(measurement, captureAppliedTransactions) {
          const session = observer.begin(transaction, beforeState);
          const startedAt = monotonicNow();
          try {
            dispatch();
          } finally {
            const duration = monotonicNow() - startedAt;
            // Finish first so temporary method shadows are restored even if recording a phase were
            // ever to fail. `finish` is also safe when the dispatcher itself threw.
            const observation = session.finish();
            store.recordPhase(measurement, "customDispatch", duration, startedAt);
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

/**
 * Implements ProseMirror's default dispatch algorithm while recording its two explicit phases:
 * apply the transaction to the current state, then commit the resulting state to the view.
 */
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
  const beforeState = view.state;
  recordSynchronousDispatch({
    store,
    options,
    transaction,
    beforeState,
    getState: () => view.state,
    run(measurement, captureAppliedTransactions) {
      const applyStartedAt = monotonicNow();
      let applied: ReturnType<EditorState["applyTransaction"]>;
      try {
        applied = beforeState.applyTransaction(transaction);
      } finally {
        // A plugin may throw from filterTransaction or appendTransaction; that work still belongs to
        // the apply phase even though no result is available.
        store.recordPhase(measurement, "apply", monotonicNow() - applyStartedAt, applyStartedAt);
      }
      captureAppliedTransactions(applied.transactions);

      const updateStartedAt = monotonicNow();
      try {
        view.updateState(applied.state);
      } finally {
        // View/plugin update failures are timed and then rethrown through the common boundary.
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
