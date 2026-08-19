import type { EditorState, Transaction } from "prosemirror-state";
import type { DirectEditorProps, EditorView } from "prosemirror-view";

import { monotonicNow } from "../store/transaction-measurement";

export type PhaseInvocation = Readonly<{
  startedAt: number;
  duration: number;
}>;

export type CustomDispatchObservation = Readonly<{
  applyTimings: readonly PhaseInvocation[];
  viewUpdateTimings: readonly PhaseInvocation[];
  appliedTransactions: readonly Transaction[] | undefined;
}>;

type CustomDispatchContext = {
  rootTransaction: Transaction;
  beforeState: EditorState;
  applyDepth: number;
  applyTimings: PhaseInvocation[];
  viewUpdateDepth: number;
  viewUpdateTimings: PhaseInvocation[];
  rootResult: ReturnType<EditorState["applyTransaction"]> | null;
  successfulUpdates: WeakSet<EditorState>;
  finished: boolean;
  observation: CustomDispatchObservation | null;
};

type RestoreMethod = () => void;

function shadowMethod(target: object, property: PropertyKey, value: unknown): RestoreMethod | null {
  const originalDescriptor = Object.getOwnPropertyDescriptor(target, property);
  if (
    originalDescriptor &&
    (originalDescriptor.configurable === false || !("value" in originalDescriptor))
  ) {
    return null;
  }
  const replacementDescriptor: PropertyDescriptor = originalDescriptor
    ? { ...originalDescriptor, value }
    : { configurable: true, enumerable: false, writable: true, value };

  try {
    Object.defineProperty(target, property, replacementDescriptor);
  } catch {
    return null;
  }

  return () => {
    const currentDescriptor = Object.getOwnPropertyDescriptor(target, property);
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
        Reflect.deleteProperty(target, property);
      }
    } catch (error) {
      console.error(`[prosemirror-devtools] Could not restore ${String(property)}`, error);
    }
  };
}

/** Observes the public state/view methods used by synchronous custom dispatchers. */
export function createCustomDispatchObserver(view: EditorView): Readonly<{
  begin: (
    rootTransaction: Transaction,
    beforeState: EditorState,
  ) => Readonly<{ finish: () => CustomDispatchObservation }>;
}> {
  // Nested custom dispatches temporarily become the context observed by patched methods.
  const activeDispatches: CustomDispatchContext[] = [];
  let attemptedStates = new WeakSet<EditorState>();
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
        patchState(result.state);
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
        if (succeeded) dispatch.successfulUpdates.add(state);
      }
    }
  };

  const patchView = (): void => {
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
      if (outermost) patchView();
      patchState(beforeState);

      return {
        finish() {
          if (dispatch.finished) return dispatch.observation as CustomDispatchObservation;
          dispatch.finished = true;
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
