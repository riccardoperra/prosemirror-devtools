import { createRenderEffect, onCleanup, type Accessor } from "solid-js";
import type { EditorView } from "prosemirror-view";

import {
  createProseMirrorDevtoolsRegistrationManager,
  type ProseMirrorDevtoolsRegistrationOptions,
} from "../../core/registration-manager";

export interface UseProseMirrorDevtoolsOptions extends ProseMirrorDevtoolsRegistrationOptions {}

export type MaybeAccessor<T> = T | Accessor<T>;

function access<T>(value: MaybeAccessor<T>): T {
  return typeof value === "function" ? (value as Accessor<T>)() : value;
}

export function useProseMirrorDevtools(
  view: MaybeAccessor<EditorView | null | undefined>,
  options: MaybeAccessor<UseProseMirrorDevtoolsOptions>,
): void {
  const registration = createProseMirrorDevtoolsRegistrationManager();
  onCleanup(() => registration.dispose());
  createRenderEffect(() => {
    registration.update(access(view), access(options));
  });
}
