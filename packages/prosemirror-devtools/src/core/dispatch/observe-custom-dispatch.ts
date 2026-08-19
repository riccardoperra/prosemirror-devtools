import type { EditorState, Transaction } from "prosemirror-state";
import type { DirectEditorProps, EditorView } from "prosemirror-view";

import { monotonicNow } from "../store/transaction-measurement";

/** Timing for one outermost call to a state-application or view-update method. */
export type PhaseInvocation = Readonly<{
  /** Monotonic timestamp captured immediately before the method call. */
  startedAt: number;
  /** Elapsed time in milliseconds, clamped to zero if the clock moves backwards. */
  duration: number;
}>;

/** Information that could be observed while a synchronous custom dispatcher ran. */
export type CustomDispatchObservation = Readonly<{
  /** Calls that applied transactions to an EditorState. */
  applyTimings: readonly PhaseInvocation[];
  /** Successful or failed attempts to update the EditorView. */
  viewUpdateTimings: readonly PhaseInvocation[];
  /**
   * Transactions produced by the root `applyTransaction` call when its resulting state was
   * successfully committed to the view. `undefined` means that commitment could not be proven.
   */
  appliedTransactions: readonly Transaction[] | undefined;
}>;

/** Mutable bookkeeping for one invocation of the custom dispatcher. */
type CustomDispatchContext = {
  /** The transaction originally passed to this dispatch invocation. */
  rootTransaction: Transaction;
  /** The view state captured before the custom dispatcher started. */
  beforeState: EditorState;
  /** Prevents delegated/recursive apply calls from producing duplicate timings. */
  applyDepth: number;
  /** Completed outermost state-application calls attributed to this dispatch. */
  applyTimings: PhaseInvocation[];
  /** Prevents delegated/recursive view updates from producing duplicate timings. */
  viewUpdateDepth: number;
  /** Completed outermost view-update calls attributed to this dispatch. */
  viewUpdateTimings: PhaseInvocation[];
  /** Result of applying the root transaction to `beforeState`, when observed. */
  rootResult: ReturnType<EditorState["applyTransaction"]> | null;
  /** States passed to view updates that returned without throwing. */
  successfulUpdates: WeakSet<EditorState>;
  /** Makes `finish` idempotent. */
  finished: boolean;
  /** Cached value returned by repeated calls to `finish`. */
  observation: CustomDispatchObservation | null;
};

/** Removes an observer-installed shadow if application code has not replaced it. */
type RestoreMethod = () => void;

/**
 * Temporarily defines an own method on an object, shadowing a method normally inherited from its
 * prototype. The returned function restores the exact previous property shape.
 *
 * This uses descriptors rather than assignment so inherited methods remain inherited after
 * cleanup, existing own descriptors retain their flags, and frozen/non-configurable objects can
 * safely fall back to unobserved behavior. Restoration is conditional: if application code
 * replaces the shadow while dispatching, that newer value is preserved.
 */
function shadowMethod(target: object, property: PropertyKey, value: unknown): RestoreMethod | null {
  const originalDescriptor = Object.getOwnPropertyDescriptor(target, property);
  // Accessors and non-configurable properties cannot be replaced and restored without risk.
  if (
    originalDescriptor &&
    (originalDescriptor.configurable === false || !("value" in originalDescriptor))
  ) {
    return null;
  }
  // Without an own descriptor, use normal method flags for the temporary prototype shadow.
  const replacementDescriptor: PropertyDescriptor = originalDescriptor
    ? { ...originalDescriptor, value }
    : { configurable: true, enumerable: false, writable: true, value };

  try {
    Object.defineProperty(target, property, replacementDescriptor);
  } catch {
    // Frozen or otherwise exotic objects should keep working, only without this measurement.
    return null;
  }

  return () => {
    const currentDescriptor = Object.getOwnPropertyDescriptor(target, property);
    // Do not clobber an assignment made by the application while the observer was active.
    if (
      !currentDescriptor ||
      !("value" in currentDescriptor) ||
      currentDescriptor.value !== value
    ) {
      return;
    }
    try {
      if (originalDescriptor) {
        Object.defineProperty(target, property, originalDescriptor);
      } else {
        // Deleting the shadow exposes the original prototype method again.
        Reflect.deleteProperty(target, property);
      }
    } catch (error) {
      console.error(`[prosemirror-devtools] Could not restore ${String(property)}`, error);
    }
  };
}

/**
 * Observes the public state/view methods used by synchronous custom dispatchers.
 *
 * A custom dispatcher is opaque to the devtools: it may call either `apply` or
 * `applyTransaction`, may update the view through `updateState` or `update`, and may discard the
 * state it computed. The observer temporarily shadows those public methods to measure work and
 * only reports applied transactions when it can prove that the root result reached the view.
 * Deferred work that runs after `finish` is intentionally not observed.
 */
export function createCustomDispatchObserver(view: EditorView): Readonly<{
  begin: (
    rootTransaction: Transaction,
    beforeState: EditorState,
  ) => Readonly<{ finish: () => CustomDispatchObservation }>;
}> {
  // The top entry owns method calls. A nested `view.dispatch` temporarily supersedes its parent.
  const activeDispatches: CustomDispatchContext[] = [];
  // A result state can be seen through both apply and update paths; patch each object at most once.
  let attemptedStates = new WeakSet<EditorState>();
  // Shadows live for the entire outermost dispatch so nested dispatches reuse, rather than stack,
  // the same wrappers.
  let stateRestorers: RestoreMethod[] = [];
  let viewRestorers: RestoreMethod[] = [];

  const currentDispatch = (): CustomDispatchContext | undefined => activeDispatches.at(-1);

  const patchState = (state: EditorState): void => {
    if (attemptedStates.has(state)) return;
    attemptedStates.add(state);

    const originalApplyTransaction = state.applyTransaction;
    const restoreApplyTransaction = shadowMethod(
      state,
      "applyTransaction",
      function observedApplyTransaction(this: EditorState, transaction: Transaction) {
        const dispatch = currentDispatch();
        if (!dispatch) return originalApplyTransaction.call(this, transaction);
        // Custom implementations may delegate through another observed public method. Record only
        // the outer boundary of that call chain.
        const outermost = dispatch.applyDepth === 0;
        const startedAt = monotonicNow();
        dispatch.applyDepth += 1;
        let result: ReturnType<EditorState["applyTransaction"]>;
        try {
          result = originalApplyTransaction.call(this, transaction);
        } finally {
          dispatch.applyDepth -= 1;
          if (outermost) {
            dispatch.applyTimings.push({
              startedAt,
              duration: Math.max(0, monotonicNow() - startedAt),
            });
          }
        }
        // Future transactions may be applied to the newly-created state during this same dispatch.
        patchState(result.state);
        // Identity checks distinguish the root transaction from additional/nested applications.
        if (this === dispatch.beforeState && transaction === dispatch.rootTransaction) {
          dispatch.rootResult = result;
        }
        return result;
      },
    );
    if (!restoreApplyTransaction) return;
    stateRestorers.push(restoreApplyTransaction);

    const originalApply = state.apply;
    const restoreApply = shadowMethod(
      state,
      "apply",
      function observedApply(this: EditorState, transaction: Transaction) {
        // EditorState.apply delegates to this.applyTransaction, whose shadow records the timing and
        // complete transaction list.
        return originalApply.call(this, transaction);
      },
    );
    if (restoreApply) stateRestorers.push(restoreApply);
  };

  const observeViewUpdate = <T>(
    dispatch: CustomDispatchContext,
    state: EditorState,
    update: () => T,
  ): T => {
    const outermost = dispatch.viewUpdateDepth === 0;
    const startedAt = monotonicNow();
    dispatch.viewUpdateDepth += 1;
    let succeeded = false;
    try {
      const result = update();
      succeeded = true;
      return result;
    } finally {
      dispatch.viewUpdateDepth -= 1;
      if (outermost) {
        dispatch.viewUpdateTimings.push({
          startedAt,
          duration: Math.max(0, monotonicNow() - startedAt),
        });
        // A throwing plugin view update is timed, but cannot prove that the state was committed.
        if (succeeded) dispatch.successfulUpdates.add(state);
      }
    }
  };

  const patchView = (): void => {
    // updateState and update call the private updateStateInner directly, so both public entry
    // points must be observed independently.
    const originalUpdateState = view.updateState;
    const restoreUpdateState = shadowMethod(
      view,
      "updateState",
      function observedUpdateState(this: EditorView, state: EditorState) {
        const dispatch = currentDispatch();
        if (!dispatch) return originalUpdateState.call(this, state);
        patchState(state);
        return observeViewUpdate(dispatch, state, () => originalUpdateState.call(this, state));
      },
    );
    if (restoreUpdateState) viewRestorers.push(restoreUpdateState);

    const originalUpdate = view.update;
    const restoreUpdate = shadowMethod(
      view,
      "update",
      function observedUpdate(this: EditorView, props: DirectEditorProps) {
        const dispatch = currentDispatch();
        if (!dispatch) return originalUpdate.call(this, props);
        patchState(props.state);
        return observeViewUpdate(dispatch, props.state, () => originalUpdate.call(this, props));
      },
    );
    if (restoreUpdate) viewRestorers.push(restoreUpdate);
  };

  const restoreMethods = (): void => {
    // Unwind in reverse installation order and release references after the outermost dispatch.
    for (const restore of [...viewRestorers, ...stateRestorers].reverse()) restore();
    attemptedStates = new WeakSet<EditorState>();
    stateRestorers = [];
    viewRestorers = [];
  };

  return {
    begin(rootTransaction, beforeState) {
      const dispatch: CustomDispatchContext = {
        rootTransaction,
        beforeState,
        applyDepth: 0,
        applyTimings: [],
        viewUpdateDepth: 0,
        viewUpdateTimings: [],
        rootResult: null,
        successfulUpdates: new WeakSet(),
        finished: false,
        observation: null,
      };
      const outermost = activeDispatches.length === 0;
      activeDispatches.push(dispatch);
      // Nested dispatches change only the active context; the existing view shadows consult the
      // top of `activeDispatches` dynamically.
      if (outermost) patchView();
      patchState(beforeState);

      return {
        finish() {
          if (dispatch.finished) return dispatch.observation as CustomDispatchObservation;
          dispatch.finished = true;
          // Applying is not enough: the exact result must have reached the view successfully and
          // must still be the current state after the custom dispatcher returns. Otherwise report
          // an unknown outcome rather than incorrectly calling a discarded/failed result applied.
          const rootCommitted = !!(
            dispatch.rootResult &&
            dispatch.successfulUpdates.has(dispatch.rootResult.state) &&
            view.state === dispatch.rootResult.state
          );
          dispatch.observation = {
            applyTimings: dispatch.applyTimings,
            viewUpdateTimings: dispatch.viewUpdateTimings,
            appliedTransactions: rootCommitted
              ? (dispatch.rootResult?.transactions ?? [])
              : undefined,
          };

          const index = activeDispatches.lastIndexOf(dispatch);
          if (index >= 0) activeDispatches.splice(index, 1);
          if (activeDispatches.length === 0) restoreMethods();
          return dispatch.observation;
        },
      };
    },
  };
}
