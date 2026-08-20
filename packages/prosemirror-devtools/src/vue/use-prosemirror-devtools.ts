import { onScopeDispose, unref, watchEffect, type MaybeRef } from "vue";
import type { EditorView } from "prosemirror-view";

import {
  createProseMirrorDevtoolsRegistrationManager,
  type ProseMirrorDevtoolsRegistrationOptions,
} from "../core/registration-manager";

export interface UseProseMirrorDevtoolsOptions extends ProseMirrorDevtoolsRegistrationOptions {}

export function useProseMirrorDevtools(
  view: MaybeRef<EditorView | null | undefined>,
  options: MaybeRef<UseProseMirrorDevtoolsOptions>,
): void {
  const registration = createProseMirrorDevtoolsRegistrationManager();
  onScopeDispose(() => registration.dispose());
  watchEffect(() => {
    registration.update(unref(view), unref(options));
  });
}
