import type { EditorView } from "prosemirror-view";

import { attachProseMirrorDevtools } from "./attach";
import type { AttachedProseMirrorDevtools, AttachProseMirrorDevtoolsOptions } from "./types";

export interface ProseMirrorDevtoolsRegistrationOptions extends Omit<
  AttachProseMirrorDevtoolsOptions,
  "view"
> {
  enabled?: boolean;
}

export interface ProseMirrorDevtoolsRegistrationManager {
  update(
    view: EditorView | null | undefined,
    options: ProseMirrorDevtoolsRegistrationOptions,
  ): void;
  dispose(): void;
}

function equalRegistrationOptions(
  previous: ProseMirrorDevtoolsRegistrationOptions,
  next: ProseMirrorDevtoolsRegistrationOptions,
): boolean {
  return (
    previous.id === next.id &&
    previous.label === next.label &&
    previous.sessionId === next.sessionId &&
    previous.transactionLimit === next.transactionLimit &&
    previous.store === next.store &&
    previous.performanceMarks === next.performanceMarks &&
    previous.performanceExtension === next.performanceExtension &&
    previous.diagnostics === next.diagnostics &&
    previous.captureProfile === next.captureProfile &&
    previous.inspectors === next.inspectors &&
    previous.getState === next.getState &&
    previous.enabled === next.enabled
  );
}

export function createProseMirrorDevtoolsRegistrationManager(): ProseMirrorDevtoolsRegistrationManager {
  let attachment: AttachedProseMirrorDevtools | null = null;
  let activeOptions: ProseMirrorDevtoolsRegistrationOptions | null = null;
  let activeView: EditorView | null = null;

  const detach = (): void => {
    attachment?.detach();
    attachment = null;
    activeOptions = null;
    activeView = null;
  };

  return {
    update(view, options) {
      if (!view || options.enabled === false) {
        detach();
        return;
      }
      if (
        attachment &&
        activeView === view &&
        activeOptions &&
        equalRegistrationOptions(activeOptions, options)
      ) {
        return;
      }

      detach();
      const attachOptions: AttachProseMirrorDevtoolsOptions = {
        id: options.id,
        view,
      };
      if (options.label !== undefined) attachOptions.label = options.label;
      if (options.sessionId !== undefined) attachOptions.sessionId = options.sessionId;
      if (options.transactionLimit !== undefined) {
        attachOptions.transactionLimit = options.transactionLimit;
      }
      if (options.store !== undefined) attachOptions.store = options.store;
      if (options.performanceMarks !== undefined) {
        attachOptions.performanceMarks = options.performanceMarks;
      }
      if (options.performanceExtension !== undefined) {
        attachOptions.performanceExtension = options.performanceExtension;
      }
      if (options.diagnostics) attachOptions.diagnostics = options.diagnostics;
      if (options.captureProfile !== undefined)
        attachOptions.captureProfile = options.captureProfile;
      if (options.inspectors !== undefined) attachOptions.inspectors = options.inspectors;
      if (options.getState !== undefined) attachOptions.getState = options.getState;

      attachment = attachProseMirrorDevtools(attachOptions);
      activeOptions = { ...options };
      activeView = view;
    },
    dispose: detach,
  };
}
