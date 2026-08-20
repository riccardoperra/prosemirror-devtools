import { createMemo, mergeProps, Show, type JSX } from "solid-js";

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

const NO_EXTENSIONS: readonly DevtoolsExtension[] = [];

export function ProseMirrorDevtoolsPanel(input: ProseMirrorDevtoolsPanelProps = {}): JSX.Element {
  const props = mergeProps(
    {
      store: prosemirrorDevtoolsStore,
      theme: "system" as const,
      defaultTab: "state" as const,
      extensions: NO_EXTENSIONS,
      embedded: false,
      performanceFrameBudgetMs: DEFAULT_PERFORMANCE_FRAME_BUDGET_MS,
    },
    input,
  );
  const panels = createMemo(() => resolvePanelRegistry(props.extensions));

  return (
    <Show keyed when={props.store}>
      {(store) => (
        <PanelProvider
          activePanel={props.activePanel}
          defaultPanel={props.defaultPanel ?? props.defaultTab}
          onActivePanelChange={props.onActivePanelChange}
          panels={panels()}
          store={store}
          styleTarget={props.styleTarget}
          theme={props.theme}
        >
          <PanelFrame className={props.className} embedded={props.embedded} style={props.style}>
            <header class="pm-header" data-embedded={props.embedded ? "true" : undefined}>
              <PanelToolbar embedded={props.embedded} />
              <PanelTabList />
            </header>
            <PanelContent
              performanceDetailThresholdMs={props.performanceDetailThresholdMs}
              performanceFrameBudgetMs={props.performanceFrameBudgetMs}
            />
          </PanelFrame>
        </PanelProvider>
      )}
    </Show>
  );
}
