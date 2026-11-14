import type { DevtoolsExtension } from "../core/extensions";
import type { ExperimentalFeatures, ProseMirrorDevtoolsTab } from "../core/panel-types";
import type { DevtoolsStore } from "../core/types";

export type TanStackDevtoolsTheme = "light" | "dark";

/** Renderer-neutral options accepted by every TanStack Devtools adapter. */
export interface ProseMirrorDevtoolsPanelInit {
  store?: DevtoolsStore;
  /** @deprecated Use `defaultPanel`. */
  defaultTab?: ProseMirrorDevtoolsTab;
  defaultPanel?: string;
  activePanel?: string;
  onActivePanelChange?: (panelId: string) => void;
  extensions?: readonly DevtoolsExtension[];
  performanceFrameBudgetMs?: number;
  performanceDetailThresholdMs?: number;
  /** Enables experimental views. `true` enables all of them. They may change in any release. */
  experimental?: ExperimentalFeatures;
}

/** Options passed between a framework panel wrapper and the imperative panel core. */
export interface ProseMirrorDevtoolsAdapterPanelProps extends ProseMirrorDevtoolsPanelInit {
  theme?: TanStackDevtoolsTheme;
  devtoolsOpen?: boolean;
}

export interface ResolvedProseMirrorDevtoolsAdapterPanelProps extends ProseMirrorDevtoolsPanelInit {
  theme: TanStackDevtoolsTheme;
  devtoolsOpen: boolean;
}

export interface CreateProseMirrorDevtoolsPluginOptions extends ProseMirrorDevtoolsPanelInit {
  id?: string;
  name?: string;
  defaultOpen?: boolean;
}

export interface ResolvedProseMirrorDevtoolsPluginMetadata {
  id: string;
  name: string;
  defaultOpen: boolean;
}
