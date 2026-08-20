import type { TanStackDevtoolsReactPlugin } from "@tanstack/react-devtools";

import type { DevtoolsExtension } from "../core/extensions";
import type { DevtoolsStore, DevtoolsTheme } from "../core/types";
import { ProseMirrorDevtoolsPanel, type ProseMirrorDevtoolsPanelProps } from "../panel/panel";

export interface CreateProseMirrorDevtoolsPluginOptions {
  store?: DevtoolsStore;
  id?: string;
  name?: string;
  defaultOpen?: boolean;
  extensions?: readonly DevtoolsExtension[];
  defaultPanel?: string;
  activePanel?: string;
  onActivePanelChange?: NonNullable<ProseMirrorDevtoolsPanelProps["onActivePanelChange"]>;
  /** See `ProseMirrorDevtoolsPanelProps.performanceFrameBudgetMs`. */
  performanceFrameBudgetMs?: number;
  /** See `ProseMirrorDevtoolsPanelProps.performanceDetailThresholdMs`. */
  performanceDetailThresholdMs?: number;
}

function createProseMirrorDevtoolsPanelProps(
  options: CreateProseMirrorDevtoolsPluginOptions,
  styleTarget: Document,
  theme: DevtoolsTheme,
): ProseMirrorDevtoolsPanelProps {
  const { id: _id, name: _name, defaultOpen: _defaultOpen, ...panelProps } = options;
  return { ...panelProps, styleTarget, theme };
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
            {...createProseMirrorDevtoolsPanelProps(options, element.ownerDocument, props.theme)}
          />
        ) : null}
      </>
    ),
  };
}

export { createReactDevtoolsExtension, ProseMirrorDevtoolsPanel } from "../panel/panel";
export type {
  ProseMirrorDevtoolsPanelProps,
  ProseMirrorDevtoolsTab,
  ReactDevtoolsExtensionOptions,
  ReactDevtoolsPanelExtension,
} from "../panel/panel";
