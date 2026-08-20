import {
  DestroyRef,
  Injector,
  assertInInjectionContext,
  effect,
  inject,
  untracked,
} from "@angular/core";
import type { EditorView } from "prosemirror-view";

import {
  createProseMirrorDevtoolsRegistrationManager,
  type ProseMirrorDevtoolsRegistrationOptions,
} from "../../core/registration-manager";

export interface InjectProseMirrorDevtoolsOptions extends ProseMirrorDevtoolsRegistrationOptions {
  view: EditorView | null | undefined;
  injector?: unknown;
}

function registrationOptions(
  options: InjectProseMirrorDevtoolsOptions,
): ProseMirrorDevtoolsRegistrationOptions {
  const result: ProseMirrorDevtoolsRegistrationOptions = { id: options.id };
  if (options.enabled !== undefined) result.enabled = options.enabled;
  if (options.label !== undefined) result.label = options.label;
  if (options.sessionId !== undefined) result.sessionId = options.sessionId;
  if (options.transactionLimit !== undefined) result.transactionLimit = options.transactionLimit;
  if (options.store !== undefined) result.store = options.store;
  if (options.performanceMarks !== undefined) result.performanceMarks = options.performanceMarks;
  if (options.performanceExtension !== undefined) {
    result.performanceExtension = options.performanceExtension;
  }
  return result;
}

export function injectProseMirrorDevtools(options: () => InjectProseMirrorDevtoolsOptions): void {
  const initialOptions = options();
  let injector = initialOptions.injector as Injector | undefined;
  if (!injector) {
    assertInInjectionContext(injectProseMirrorDevtools);
    injector = inject(Injector);
  }

  const registration = createProseMirrorDevtoolsRegistrationManager();
  injector.get(DestroyRef).onDestroy(() => registration.dispose());
  effect(
    () => {
      const current = options();
      untracked(() => registration.update(current.view, registrationOptions(current)));
    },
    { injector },
  );
}
