import { useEffect, useState } from "preact/hooks";
import type { EditorView } from "prosemirror-view";

import {
  createProseMirrorDevtoolsRegistrationManager,
  type ProseMirrorDevtoolsRegistrationOptions,
} from "../core/registration-manager";

export interface UseProseMirrorDevtoolsOptions extends ProseMirrorDevtoolsRegistrationOptions {}

export function useProseMirrorDevtools(
  view: EditorView | null | undefined,
  options: UseProseMirrorDevtoolsOptions,
): void {
  const [registration] = useState(createProseMirrorDevtoolsRegistrationManager);

  useEffect(() => () => registration.dispose(), [registration]);
  useEffect(() => {
    registration.update(view, options);
  });
}
