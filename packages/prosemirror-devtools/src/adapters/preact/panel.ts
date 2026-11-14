import { h, type JSX } from "preact";
import { useEffect, useMemo, useRef } from "preact/hooks";
import type { DevtoolsPanelProps } from "@tanstack/devtools-utils/preact";

import { ProseMirrorDevtoolsCore } from "../core";
import { resolveProseMirrorDevtoolsAdapterPanelProps } from "../panel-props";
import type {
  ProseMirrorDevtoolsAdapterPanelProps,
  ResolvedProseMirrorDevtoolsAdapterPanelProps,
} from "../types";

export interface ProseMirrorDevtoolsPreactInit extends ProseMirrorDevtoolsAdapterPanelProps {}

export function useProseMirrorDevtoolsProps(
  options?: ProseMirrorDevtoolsAdapterPanelProps,
  hostProps?: Partial<DevtoolsPanelProps>,
): ResolvedProseMirrorDevtoolsAdapterPanelProps & DevtoolsPanelProps {
  const store = options?.store;
  const defaultTab = options?.defaultTab;
  const defaultPanel = options?.defaultPanel;
  const activePanel = options?.activePanel;
  const onActivePanelChange = options?.onActivePanelChange;
  const extensions = options?.extensions;
  const experimental = options?.experimental;
  const performanceFrameBudgetMs = options?.performanceFrameBudgetMs;
  const performanceDetailThresholdMs = options?.performanceDetailThresholdMs;
  const optionTheme = options?.theme;
  const optionDevtoolsOpen = options?.devtoolsOpen;
  const hostTheme = hostProps?.theme;
  const hostDevtoolsOpen = hostProps?.devtoolsOpen;

  return useMemo(
    () =>
      resolveProseMirrorDevtoolsAdapterPanelProps(
        {
          activePanel,
          defaultPanel,
          defaultTab,
          devtoolsOpen: optionDevtoolsOpen,
          experimental,
          extensions,
          onActivePanelChange,
          performanceDetailThresholdMs,
          performanceFrameBudgetMs,
          store,
          theme: optionTheme,
        } as ProseMirrorDevtoolsAdapterPanelProps,
        {
          devtoolsOpen: hostDevtoolsOpen,
          theme: hostTheme,
        } as ProseMirrorDevtoolsAdapterPanelProps,
      ) as ResolvedProseMirrorDevtoolsAdapterPanelProps & DevtoolsPanelProps,
    [
      activePanel,
      defaultPanel,
      defaultTab,
      experimental,
      extensions,
      hostDevtoolsOpen,
      hostTheme,
      onActivePanelChange,
      optionDevtoolsOpen,
      optionTheme,
      performanceDetailThresholdMs,
      performanceFrameBudgetMs,
      store,
    ],
  );
}

export function ProseMirrorDevtoolsPanel(props: ProseMirrorDevtoolsPreactInit = {}): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<ProseMirrorDevtoolsCore | null>(null);
  const panelProps = useProseMirrorDevtoolsProps(props);

  useEffect(
    () => () => {
      instance.current?.unmount();
      instance.current = null;
    },
    [],
  );
  useEffect(() => {
    if (!host.current) return;
    if (instance.current) {
      instance.current.update(panelProps);
      return;
    }
    const core = new ProseMirrorDevtoolsCore();
    core.mount(host.current, panelProps);
    instance.current = core;
  }, [panelProps]);

  return h("div", { ref: host, style: { height: "100%" } });
}
