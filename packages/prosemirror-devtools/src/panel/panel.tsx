import { useMemo, type ReactElement } from "react";

import type { DevtoolsExtension } from "../core/extensions";
import { prosemirrorDevtoolsStore } from "../core/store/create-devtools-store";
import { DEFAULT_PERFORMANCE_FRAME_BUDGET_MS } from "./panel.constants";
import { resolvePanelRegistry } from "./panel-registry";
import type { ProseMirrorDevtoolsPanelProps } from "./panel.types";
import { PanelProvider } from "./panel-provider";
import { PanelContent } from "./shell/panel-content";
import { PanelFrame } from "./shell/panel-frame";
import { PanelTabList } from "./shell/panel-tab-list";
import { PanelToolbar } from "./shell/panel-toolbar";

export type { ProseMirrorDevtoolsPanelProps, ProseMirrorDevtoolsTab } from "./panel.types";
export { createReactDevtoolsExtension } from "./react-extension";
export type { ReactDevtoolsExtensionOptions, ReactDevtoolsPanelExtension } from "./react-extension";

const NO_EXTENSIONS: readonly DevtoolsExtension[] = [];

export function ProseMirrorDevtoolsPanel({
  store = prosemirrorDevtoolsStore,
  theme = "system",
  defaultTab = "state",
  defaultPanel,
  activePanel,
  onActivePanelChange,
  extensions = NO_EXTENSIONS,
  performanceFrameBudgetMs = DEFAULT_PERFORMANCE_FRAME_BUDGET_MS,
  performanceDetailThresholdMs,
  className,
  style,
  styleTarget,
}: ProseMirrorDevtoolsPanelProps): ReactElement {
  const panels = useMemo(() => resolvePanelRegistry(extensions), [extensions]);
  return (
    <PanelProvider
      activePanel={activePanel}
      defaultPanel={defaultPanel ?? defaultTab}
      onActivePanelChange={onActivePanelChange}
      panels={panels}
      store={store}
      styleTarget={styleTarget}
      theme={theme}
    >
      <PanelFrame className={className} style={style}>
        <header className="pm-header">
          <PanelToolbar />
          <PanelTabList />
        </header>
        <PanelContent
          performanceDetailThresholdMs={performanceDetailThresholdMs}
          performanceFrameBudgetMs={performanceFrameBudgetMs}
        />
      </PanelFrame>
    </PanelProvider>
  );
}
