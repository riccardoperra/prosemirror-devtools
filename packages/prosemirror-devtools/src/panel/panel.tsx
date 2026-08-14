import type { ReactElement } from "react";

import { prosemirrorDevtoolsStore } from "../core/store/create-devtools-store";
import { DEFAULT_PERFORMANCE_FRAME_BUDGET_MS } from "./panel.constants";
import type { ProseMirrorDevtoolsPanelProps } from "./panel.types";
import { PanelProvider } from "./panel-provider";
import { PanelContent } from "./shell/panel-content";
import { PanelFrame } from "./shell/panel-frame";
import { PanelTabList } from "./shell/panel-tab-list";
import { PanelToolbar } from "./shell/panel-toolbar";

export type { ProseMirrorDevtoolsPanelProps, ProseMirrorDevtoolsTab } from "./panel.types";

export function ProseMirrorDevtoolsPanel({
  store = prosemirrorDevtoolsStore,
  theme = "system",
  defaultTab = "state",
  performanceFrameBudgetMs = DEFAULT_PERFORMANCE_FRAME_BUDGET_MS,
  performanceDetailThresholdMs,
  className,
  style,
  styleTarget,
}: ProseMirrorDevtoolsPanelProps): ReactElement {
  return (
    <PanelProvider defaultTab={defaultTab} store={store} styleTarget={styleTarget} theme={theme}>
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
