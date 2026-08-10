import type { Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import {
  createProseMirrorDispatchRecorder,
  recordDefaultDispatch,
} from "./dispatch/record-dispatch";
import { prosemirrorDevtoolsStore } from "./store/create-devtools-store";
import type {
  AttachedProseMirrorDevtools,
  AttachProseMirrorDevtoolsOptions,
  DevtoolsStore,
} from "./types";

type InternalAttachment = {
  id: string;
  store: DevtoolsStore;
  handle: AttachedProseMirrorDevtools;
};

const attachments = new WeakMap<EditorView, InternalAttachment>();

export { createProseMirrorDispatchRecorder } from "./dispatch/record-dispatch";

/** Registers an EditorView and restores its original dispatcher on detach. */
export function attachProseMirrorDevtools(
  options: AttachProseMirrorDevtoolsOptions,
): AttachedProseMirrorDevtools {
  const store = options.store ?? prosemirrorDevtoolsStore;
  const previousAttachment = attachments.get(options.view);
  if (previousAttachment) {
    if (previousAttachment.id !== options.id) {
      throw new Error(`This EditorView is already attached as "${previousAttachment.id}".`);
    }
    if (previousAttachment.store !== store) {
      throw new Error("This EditorView is already attached to a different devtools store.");
    }
    return previousAttachment.handle;
  }

  const unregister = store.register(options);
  const originalDispatch = options.view.props.dispatchTransaction;
  const view = options.view;
  const customDispatchRecorder = originalDispatch
    ? createProseMirrorDispatchRecorder(options)
    : null;
  let detached = false;

  function dispatchTransaction(this: EditorView, transaction: Transaction): void {
    const activeView = this ?? view;
    if (originalDispatch && customDispatchRecorder) {
      customDispatchRecorder.record(transaction, () =>
        originalDispatch.call(activeView, transaction),
      );
      return;
    }
    recordDefaultDispatch({ options, store, view: activeView, transaction });
  }

  view.setProps({ dispatchTransaction });

  const handle: AttachedProseMirrorDevtools = {
    id: options.id,
    view,
    detach() {
      if (detached) return;
      detached = true;
      if (view.props.dispatchTransaction === dispatchTransaction) {
        view.setProps({ dispatchTransaction: originalDispatch } as unknown as Parameters<
          EditorView["setProps"]
        >[0]);
      }
      unregister();
      attachments.delete(view);
    },
  };
  attachments.set(view, { id: options.id, store, handle });
  return handle;
}
