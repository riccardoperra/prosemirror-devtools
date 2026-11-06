import type { EditorState, Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import {
  createProseMirrorDevtoolsSession,
  type CreateProseMirrorDevtoolsSessionOptions,
} from "../../core/session";

export interface ReactProseMirrorDevtoolsOptions extends CreateProseMirrorDevtoolsSessionOptions {
  readonly view: EditorView;
  /** Reads the controlled model synchronously, before React commits the view. */
  readonly getState: () => EditorState;
}

export interface ReactProseMirrorDevtools {
  readonly view: EditorView;
  readonly sessionId: string;
  /** Measures model application. A later React view commit is outside this boundary. */
  record(transaction: Transaction, apply: () => void): void;
  dispose(): void;
}

/** Connect from React ProseMirror's useEditorEffect and return dispose as its cleanup. */
export function createReactProseMirrorDevtools({
  view,
  getState,
  ...options
}: ReactProseMirrorDevtoolsOptions): ReactProseMirrorDevtools {
  const session = createProseMirrorDevtoolsSession(options);
  const recorder = session.createDispatchRecorder(view, { getState });
  return {
    view,
    sessionId: session.sessionId,
    record(transaction, apply) {
      if (session.active) recorder.record(transaction, apply);
      else apply();
    },
    dispose: () => session.dispose(),
  };
}
