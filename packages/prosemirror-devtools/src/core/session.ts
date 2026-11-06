import type { EditorState, Plugin } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { attachProseMirrorDevtools } from "./attach";
import {
  createProseMirrorDevtoolsDiagnostics,
  type DevtoolsDiagnosticsController,
  type DevtoolsDiagnosticsOptions,
} from "./diagnostics";
import {
  createProseMirrorDispatchRecorder,
  type ProseMirrorDispatchRecorder,
} from "./dispatch/record-dispatch";
import { instrumentProseMirrorPlugins } from "./instrument";
import { createDevtoolsSessionId } from "./session-id";
import { prosemirrorDevtoolsStore } from "./store/create-devtools-store";
import type {
  AttachedProseMirrorDevtools,
  AttachProseMirrorDevtoolsOptions,
  DevtoolsStore,
} from "./types";

export interface CreateProseMirrorDevtoolsSessionOptions extends Omit<
  AttachProseMirrorDevtoolsOptions,
  "sessionId" | "view" | "diagnostics"
> {
  /** Primarily useful for deterministic integration tests and adapter ownership. */
  sessionId?: string;
  getPluginLabel?: (plugin: Plugin, index: number) => string;
  diagnostics?: boolean | DevtoolsDiagnosticsOptions | DevtoolsDiagnosticsController;
}

export interface ProseMirrorDevtoolsSession {
  readonly id: string;
  readonly sessionId: string;
  readonly store: DevtoolsStore;
  readonly active: boolean;
  readonly diagnostics: DevtoolsDiagnosticsController | undefined;
  /** Explicit opt-in to per-plugin lifecycle/hook timings. */
  instrumentPlugins(plugins: readonly Plugin[]): Plugin[];
  /** Registers and patches a regular EditorView dispatcher. */
  attach(view: EditorView): AttachedProseMirrorDevtools;
  /** Registers a view for a framework-owned dispatch middleware. */
  createDispatchRecorder(
    view: EditorView,
    options?: { getState?: () => EditorState },
  ): ProseMirrorDispatchRecorder;
  pauseCapture(): void;
  resumeCapture(): void;
  dispose(): void;
}

/**
 * Owns one editor instrumentation lifecycle. Disposing it atomically disables plugin callbacks,
 * restores dispatch, and unregisters the editor.
 */
export function createProseMirrorDevtoolsSession(
  options: CreateProseMirrorDevtoolsSessionOptions,
): ProseMirrorDevtoolsSession {
  const store = options.store ?? prosemirrorDevtoolsStore;
  const sessionId = options.sessionId ?? createDevtoolsSessionId("session");
  const suppliedDiagnostics =
    options.diagnostics &&
    typeof options.diagnostics === "object" &&
    "getSnapshot" in options.diagnostics
      ? options.diagnostics
      : undefined;
  const diagnostics =
    suppliedDiagnostics ??
    (options.diagnostics
      ? createProseMirrorDevtoolsDiagnostics(
          typeof options.diagnostics === "object" && !("getSnapshot" in options.diagnostics)
            ? options.diagnostics
            : {},
        )
      : undefined);
  let active = true;
  let view: EditorView | null = null;
  let attachment: AttachedProseMirrorDevtools | null = null;
  let underlyingAttachment: AttachedProseMirrorDevtools | null = null;
  let recorder: ProseMirrorDispatchRecorder | null = null;
  let unregister: (() => void) | null = null;

  const attachOptions = (nextView: EditorView): AttachProseMirrorDevtoolsOptions => ({
    id: options.id,
    view: nextView,
    store,
    sessionId,
    ...(diagnostics ? { diagnostics } : {}),
    ...(options.label === undefined ? {} : { label: options.label }),
    ...(options.transactionLimit === undefined
      ? {}
      : { transactionLimit: options.transactionLimit }),
    ...(options.captureProfile === undefined ? {} : { captureProfile: options.captureProfile }),
    ...(options.inspectors === undefined ? {} : { inspectors: options.inspectors }),
    ...(options.getState === undefined ? {} : { getState: options.getState }),
    ...(options.performanceMarks === undefined
      ? {}
      : { performanceMarks: options.performanceMarks }),
    ...(options.performanceExtension === undefined
      ? {}
      : { performanceExtension: options.performanceExtension }),
  });

  const assertActive = (): void => {
    if (!active) throw new Error("This ProseMirror devtools session has been disposed.");
  };
  const isSessionActive = (): boolean => active;
  const claimView = (nextView: EditorView): void => {
    assertActive();
    if (view && view !== nextView) {
      throw new Error("A ProseMirror devtools session can own only one EditorView.");
    }
    view = nextView;
  };

  const session: ProseMirrorDevtoolsSession = {
    id: options.id,
    sessionId,
    store,
    diagnostics,
    get active() {
      return active;
    },
    instrumentPlugins(plugins) {
      assertActive();
      return instrumentProseMirrorPlugins(plugins, {
        instanceId: options.id,
        store,
        sessionId,
        isActive: isSessionActive,
        ...(diagnostics ? { diagnostics } : {}),
        ...(options.getPluginLabel ? { getPluginLabel: options.getPluginLabel } : {}),
      });
    },
    attach(nextView) {
      claimView(nextView);
      if (attachment) return attachment;
      if (unregister) {
        throw new Error("This session already uses a framework-owned dispatch recorder.");
      }
      const attached = attachProseMirrorDevtools(attachOptions(nextView));
      underlyingAttachment = attached;
      attachment = {
        id: attached.id,
        sessionId,
        view: attached.view,
        detach: () => session.dispose(),
      };
      return attachment;
    },
    createDispatchRecorder(nextView, recorderOptions = {}) {
      claimView(nextView);
      if (attachment) {
        throw new Error("This session already patches the EditorView dispatcher.");
      }
      if (recorder) return recorder;
      const nextOptions = { ...attachOptions(nextView), ...recorderOptions };
      const nextUnregister = store.register(nextOptions);
      try {
        recorder = createProseMirrorDispatchRecorder(nextOptions);
        unregister = nextUnregister;
      } catch (error) {
        nextUnregister();
        throw error;
      }
      return recorder;
    },
    pauseCapture() {
      assertActive();
      store.pauseCapture(options.id, sessionId);
    },
    resumeCapture() {
      assertActive();
      store.resumeCapture(options.id, sessionId);
    },
    dispose() {
      if (!active) return;
      active = false;
      try {
        if (attachment) {
          attachment = null;
          underlyingAttachment?.detach();
          underlyingAttachment = null;
        } else {
          recorder?.dispose();
          unregister?.();
        }
      } finally {
        unregister = null;
        recorder = null;
        underlyingAttachment = null;
        view = null;
        store.closeSession(options.id, sessionId);
        if (!suppliedDiagnostics) diagnostics?.dispose();
      }
    },
  };
  return session;
}
