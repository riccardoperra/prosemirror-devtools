import type { Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import {
  createProseMirrorDispatchRecorder,
  recordDefaultDispatch,
} from "./dispatch/record-dispatch";
import { createDevtoolsSessionId } from "./session-id";
import { prosemirrorDevtoolsStore } from "./store/create-devtools-store";
import type {
  AttachedProseMirrorDevtools,
  AttachProseMirrorDevtoolsOptions,
  DevtoolsStore,
} from "./types";

type InternalAttachment = {
  id: string;
  sessionId: string;
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
    if (options.sessionId && previousAttachment.sessionId !== options.sessionId) {
      throw new Error("This EditorView is already attached to a different devtools session.");
    }
    return previousAttachment.handle;
  }

  const sessionId = options.sessionId ?? createDevtoolsSessionId("attachment");
  const attachmentOptions: AttachProseMirrorDevtoolsOptions = {
    ...options,
    store,
    sessionId,
  };
  const unregister = store.register(attachmentOptions);
  const originalDispatch = options.view.props.dispatchTransaction;
  const view = options.view;
  const customDispatchRecorder = originalDispatch
    ? createProseMirrorDispatchRecorder(attachmentOptions)
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
    recordDefaultDispatch({ options: attachmentOptions, store, view: activeView, transaction });
  }

  try {
    view.setProps({ dispatchTransaction });
  } catch (error) {
    try {
      if (view.props.dispatchTransaction === dispatchTransaction) {
        view.setProps({ dispatchTransaction: originalDispatch } as unknown as Parameters<
          EditorView["setProps"]
        >[0]);
      }
    } catch (restoreError) {
      console.error(
        "[prosemirror-devtools] Could not restore dispatch after attachment failed.",
        restoreError,
      );
    } finally {
      unregister();
      store.closeSession(options.id, sessionId);
    }
    throw error;
  }

  const handle: AttachedProseMirrorDevtools = {
    id: options.id,
    sessionId,
    view,
    detach() {
      if (detached) return;
      detached = true;
      try {
        if (view.props.dispatchTransaction === dispatchTransaction) {
          view.setProps({ dispatchTransaction: originalDispatch } as unknown as Parameters<
            EditorView["setProps"]
          >[0]);
        }
      } finally {
        unregister();
        store.closeSession(options.id, sessionId);
        attachments.delete(view);
      }
    },
  };
  attachments.set(view, { id: options.id, sessionId, store, handle });
  return handle;
}
