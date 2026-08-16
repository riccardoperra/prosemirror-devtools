import type { TanStackDevtoolsReactPlugin } from "@tanstack/react-devtools";

import type { DevtoolsExtension } from "./core/extensions";
import type { DevtoolsStore } from "./core/types";
import { ProseMirrorDevtoolsPanel, type ProseMirrorDevtoolsPanelProps } from "./panel/panel";

export interface CreateProseMirrorDevtoolsPluginOptions {
  store?: DevtoolsStore;
  id?: string;
  name?: string;
  defaultOpen?: boolean;
  extensions?: readonly DevtoolsExtension[];
  defaultPanel?: string;
  activePanel?: string;
  onActivePanelChange?: ProseMirrorDevtoolsPanelProps["onActivePanelChange"];
  /** See `ProseMirrorDevtoolsPanelProps.performanceFrameBudgetMs`. */
  performanceFrameBudgetMs?: number;
  /** See `ProseMirrorDevtoolsPanelProps.performanceDetailThresholdMs`. */
  performanceDetailThresholdMs?: number;
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
            {...(options.activePanel === undefined ? {} : { activePanel: options.activePanel })}
            {...(options.defaultPanel === undefined ? {} : { defaultPanel: options.defaultPanel })}
            {...(options.extensions === undefined ? {} : { extensions: options.extensions })}
            {...(options.onActivePanelChange === undefined
              ? {}
              : { onActivePanelChange: options.onActivePanelChange })}
            {...(options.store ? { store: options.store } : {})}
            {...(options.performanceDetailThresholdMs === undefined
              ? {}
              : { performanceDetailThresholdMs: options.performanceDetailThresholdMs })}
            {...(options.performanceFrameBudgetMs === undefined
              ? {}
              : { performanceFrameBudgetMs: options.performanceFrameBudgetMs })}
            styleTarget={element.ownerDocument}
            theme={props.theme}
          />
        ) : null}
      </>
    ),
  };
}

export { createReactDevtoolsExtension, ProseMirrorDevtoolsPanel } from "./panel/panel";
export type {
  ProseMirrorDevtoolsPanelProps,
  ProseMirrorDevtoolsTab,
  ReactDevtoolsExtensionOptions,
  ReactDevtoolsPanelExtension,
} from "./panel/panel";
