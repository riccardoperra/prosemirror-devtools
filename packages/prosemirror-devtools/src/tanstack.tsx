import type { TanStackDevtoolsReactPlugin } from "@tanstack/react-devtools";

import type { DevtoolsStore } from "./core/types";
import { ProseMirrorDevtoolsPanel } from "./panel/panel";

export interface CreateProseMirrorDevtoolsPluginOptions {
  store?: DevtoolsStore;
  id?: string;
  name?: string;
  defaultOpen?: boolean;
}

/** Creates a TanStack Devtools plugin that follows the shell's light/dark theme. */
export function createProseMirrorDevtoolsPlugin(
  options: CreateProseMirrorDevtoolsPluginOptions = {},
): TanStackDevtoolsReactPlugin {
  return {
    id: options.id ?? "prosemirror-devtools",
    name: options.name ?? "ProseMirror",
    defaultOpen: options.defaultOpen ?? false,
    render: (element, props) => (
      <>
        {props.devtoolsOpen ? (
          <ProseMirrorDevtoolsPanel
            {...(options.store ? { store: options.store } : {})}
            styleTarget={element.ownerDocument}
            theme={props.theme}
          />
        ) : null}
      </>
    ),
  };
}

export { ProseMirrorDevtoolsPanel } from "./panel/panel";
export type { ProseMirrorDevtoolsPanelProps, ProseMirrorDevtoolsTab } from "./panel/panel";
