import { lazy, Suspense, useEffect, useMemo, useReducer, useRef } from "react";
import type { ReactElement } from "react";

import type { RegisteredProseMirrorInstance } from "../../core/types";
import { HistoryView } from "../features/history/history-view";
import { PluginsView } from "../features/plugins/plugins-view";
import { SchemaView } from "../features/schema/schema-view";
import { SnapshotsView } from "../features/snapshots/snapshots-view";
import { StateView } from "../features/state/state-view";
import type { ExternalPanelDefinition } from "../panel-registry";
import type { ProseMirrorDevtoolsTab } from "../panel.types";
import { getReactDevtoolsPanelRenderer } from "../react-extension";
import {
  usePanelAppearance,
  usePanelDataAccess,
  usePanelMeta,
  usePanelNavigation,
} from "../panel-provider";
import { useActiveInstance } from "../store/selectors";
import { EmptyState } from "../ui/empty-state";

const PerformanceView = /* @__PURE__ */ lazy(async () => {
  const module = await import("../features/performance/performance-view");
  return { default: module.PerformanceView };
});

function ExtensionPanelView({ definition }: { definition: ExternalPanelDefinition }): ReactElement {
  const reactRenderer = getReactDevtoolsPanelRenderer(definition.panel);
  if (reactRenderer) {
    return <ReactExtensionPanelView definition={definition} render={reactRenderer} />;
  }
  return <DomExtensionPanelView definition={definition} />;
}

function usePanelAbortController(): AbortController {
  const controllerRef = useRef<AbortController | null>(null);
  const [, refresh] = useReducer((version: number) => version + 1, 0);

  if (!controllerRef.current) controllerRef.current = new AbortController();

  useEffect(() => {
    let controller = controllerRef.current;
    if (!controller || controller.signal.aborted) {
      controller = new AbortController();
      controllerRef.current = controller;
      refresh();
    }
    return () => controller.abort();
  }, []);

  return controllerRef.current;
}

function ReactExtensionPanelView({
  definition,
  render,
}: {
  definition: ExternalPanelDefinition;
  render: NonNullable<ReturnType<typeof getReactDevtoolsPanelRenderer>>;
}): ReactElement {
  const { data, actions } = usePanelDataAccess();
  const { density, resolvedTheme } = usePanelAppearance();
  const { ownerDocument } = usePanelMeta();
  const { activePanel, selectPanel } = usePanelNavigation();
  const controller = usePanelAbortController();
  const context = useMemo(
    () => ({
      data,
      actions,
      host: {
        ownerDocument,
        theme: resolvedTheme,
        density,
        activePanelId: activePanel,
        selectPanel,
        signal: controller.signal,
      },
    }),
    [
      actions,
      activePanel,
      controller.signal,
      data,
      density,
      ownerDocument,
      resolvedTheme,
      selectPanel,
    ],
  );
  return (
    <div
      className="pm-extension-panel"
      data-extension-id={definition.extensionId}
      data-panel-id={definition.id}
    >
      {render(context)}
    </div>
  );
}

function DomExtensionPanelView({
  definition,
}: {
  definition: ExternalPanelDefinition;
}): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, actions } = usePanelDataAccess();
  const { density, resolvedTheme } = usePanelAppearance();
  const { activePanel, selectPanel } = usePanelNavigation();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const controller = new AbortController();
    let cleanup: void | (() => void);
    try {
      cleanup = definition.panel.mount(container, {
        data,
        actions,
        host: {
          ownerDocument: container.ownerDocument,
          theme: resolvedTheme,
          density,
          activePanelId: activePanel,
          selectPanel,
          signal: controller.signal,
        },
      });
    } catch (error) {
      controller.abort();
      container.replaceChildren();
      throw error;
    }
    return () => {
      controller.abort();
      try {
        cleanup?.();
      } finally {
        container.replaceChildren();
      }
    };
  }, [actions, activePanel, data, definition.panel, density, resolvedTheme, selectPanel]);

  return (
    <div
      className="pm-extension-panel"
      data-extension-id={definition.extensionId}
      data-panel-id={definition.id}
      ref={containerRef}
    />
  );
}

function ActivePanelView({
  tab,
  instance,
  onClearHistory,
  performanceDetailThresholdMs,
  performanceFrameBudgetMs,
}: {
  tab: ProseMirrorDevtoolsTab;
  instance: RegisteredProseMirrorInstance;
  onClearHistory: () => void;
  performanceDetailThresholdMs: number | undefined;
  performanceFrameBudgetMs: number;
}): ReactElement {
  switch (tab) {
    case "state":
      return <StateView key={instance.id} instance={instance} />;
    case "history":
      return <HistoryView key={instance.id} instance={instance} onClear={onClearHistory} />;
    case "performance":
      return (
        <Suspense fallback={<div className="pm-empty">Loading performance tools…</div>}>
          <PerformanceView
            key={instance.id}
            instance={instance}
            detailThresholdMs={performanceDetailThresholdMs}
            frameBudgetMs={performanceFrameBudgetMs}
          />
        </Suspense>
      );
    case "plugins":
      return <PluginsView key={instance.id} instance={instance} />;
    case "schema":
      return <SchemaView key={instance.id} instance={instance} />;
    case "snapshots":
      return <SnapshotsView key={instance.id} instance={instance} />;
  }
}

export function PanelContent({
  performanceDetailThresholdMs,
  performanceFrameBudgetMs,
}: {
  performanceDetailThresholdMs: number | undefined;
  performanceFrameBudgetMs: number;
}): ReactElement {
  const { actions } = usePanelDataAccess();
  const activeInstance = useActiveInstance();
  const { activePanel, panels } = usePanelNavigation();
  const { tabId, tabPanelId } = usePanelMeta();
  const definition = panels.find(({ id }) => id === activePanel);
  const showEmptyState = !activeInstance && (definition?.requiresInstance ?? true);

  return (
    <main
      aria-labelledby={tabId(activePanel)}
      className="pm-body"
      id={tabPanelId}
      role="tabpanel"
      tabIndex={0}
    >
      {showEmptyState ? (
        <EmptyState />
      ) : definition?.kind === "extension" ? (
        <ExtensionPanelView
          definition={definition}
          key={`${definition.extensionId}:${definition.id}`}
        />
      ) : activeInstance && definition?.kind === "builtin" ? (
        <ActivePanelView
          instance={activeInstance}
          onClearHistory={() => actions.clearTransactions(activeInstance.id)}
          performanceDetailThresholdMs={performanceDetailThresholdMs}
          performanceFrameBudgetMs={performanceFrameBudgetMs}
          tab={definition.id}
        />
      ) : (
        <EmptyState />
      )}
    </main>
  );
}
