import {
  createEffect,
  createMemo,
  lazy,
  Match,
  onCleanup,
  Show,
  Suspense,
  Switch,
  type JSX,
} from "solid-js";

import { panelStyles } from "../styles";

import type { RegisteredProseMirrorInstance } from "../../core/types";
import { HistoryView } from "../features/history/history-view";
import { PluginsView } from "../features/plugins/plugins-view";
import { SchemaView } from "../features/schema/schema-view";
import { SnapshotsView } from "../features/snapshots/snapshots-view";
import { StateView } from "../features/state/state-view";
import type { ExternalPanelDefinition } from "../panel-registry";
import type { ProseMirrorDevtoolsTab } from "../panel.types";
import {
  usePanelAppearance,
  usePanelDataAccess,
  usePanelMeta,
  usePanelNavigation,
} from "../panel-provider";
import { useActiveInstance } from "../store/selectors";
import { EmptyState } from "../ui/empty-state";

const PerformanceView = lazy(async () => {
  const module = await import("../features/performance/performance-view");
  return { default: module.PerformanceView };
});

interface ExtensionPanelViewProps {
  definition: ExternalPanelDefinition;
}

function ExtensionPanelView(props: ExtensionPanelViewProps): JSX.Element {
  let container: HTMLDivElement | undefined;
  const { data, actions } = usePanelDataAccess();
  const appearance = usePanelAppearance();
  const navigation = usePanelNavigation();

  createEffect(() => {
    const mountElement = container;
    if (!mountElement) return;
    const definition = props.definition;
    const density = appearance.density();
    const theme = appearance.resolvedTheme();
    const activePanelId = navigation.activePanel();
    const controller = new AbortController();
    let cleanup: void | (() => void);

    try {
      cleanup = definition.panel.mount(mountElement, {
        data,
        actions,
        host: {
          ownerDocument: mountElement.ownerDocument,
          theme,
          density,
          activePanelId,
          selectPanel: navigation.selectPanel,
          signal: controller.signal,
        },
      });
    } catch (error) {
      controller.abort();
      mountElement.replaceChildren();
      throw error;
    }

    onCleanup(() => {
      controller.abort();
      try {
        cleanup?.();
      } finally {
        mountElement.replaceChildren();
      }
    });
  });

  return (
    <div
      class={panelStyles.pmExtensionPanel}
      data-extension-id={props.definition.extensionId}
      data-panel-id={props.definition.id}
      ref={(element) => {
        container = element;
      }}
    />
  );
}

interface ActivePanelViewProps {
  tab: ProseMirrorDevtoolsTab;
  instance: RegisteredProseMirrorInstance;
  onClearHistory: () => void;
  performanceDetailThresholdMs: number | undefined;
  performanceFrameBudgetMs: number;
}

function ActivePanelView(props: ActivePanelViewProps): JSX.Element {
  return (
    <Show keyed when={props.instance.id}>
      {(_instanceId) => (
        <Switch>
          <Match when={props.tab === "state"}>
            <StateView instance={props.instance} />
          </Match>
          <Match when={props.tab === "history"}>
            <HistoryView instance={props.instance} onClear={props.onClearHistory} />
          </Match>
          <Match when={props.tab === "performance"}>
            <Suspense fallback={<div class={panelStyles.pmEmpty}>Loading performance tools…</div>}>
              <PerformanceView
                detailThresholdMs={props.performanceDetailThresholdMs}
                frameBudgetMs={props.performanceFrameBudgetMs}
                instance={props.instance}
              />
            </Suspense>
          </Match>
          <Match when={props.tab === "plugins"}>
            <PluginsView instance={props.instance} />
          </Match>
          <Match when={props.tab === "schema"}>
            <SchemaView instance={props.instance} />
          </Match>
          <Match when={props.tab === "snapshots"}>
            <SnapshotsView instance={props.instance} />
          </Match>
        </Switch>
      )}
    </Show>
  );
}

export interface PanelContentProps {
  performanceDetailThresholdMs: number | undefined;
  performanceFrameBudgetMs: number;
}

export function PanelContent(props: PanelContentProps): JSX.Element {
  const { actions } = usePanelDataAccess();
  const activeInstance = useActiveInstance();
  const navigation = usePanelNavigation();
  const meta = usePanelMeta();
  const definition = createMemo(() =>
    navigation.panels().find(({ id }) => id === navigation.activePanel()),
  );
  const extensionDefinition = createMemo(() => {
    const current = definition();
    return current?.kind === "extension" ? current : undefined;
  });
  const builtinDefinition = createMemo(() => {
    const current = definition();
    return current?.kind === "builtin" ? current : undefined;
  });
  const showEmptyState = createMemo(
    () => !activeInstance() && (definition()?.requiresInstance ?? true),
  );

  return (
    <main
      aria-labelledby={meta.tabId(navigation.activePanel())}
      class={panelStyles.pmBody}
      id={meta.tabPanelId}
      role="tabpanel"
      tabIndex={0}
    >
      <Show when={!showEmptyState()} fallback={<EmptyState />}>
        <Show
          when={extensionDefinition()}
          fallback={
            <Show when={activeInstance() && builtinDefinition()} fallback={<EmptyState />}>
              <ActivePanelView
                instance={activeInstance()!}
                onClearHistory={() => {
                  const instance = activeInstance();
                  if (instance) actions.clearTransactions(instance.id);
                }}
                performanceDetailThresholdMs={props.performanceDetailThresholdMs}
                performanceFrameBudgetMs={props.performanceFrameBudgetMs}
                tab={builtinDefinition()!.id}
              />
            </Show>
          }
        >
          {(current) => <ExtensionPanelView definition={current()} />}
        </Show>
      </Show>
    </main>
  );
}
