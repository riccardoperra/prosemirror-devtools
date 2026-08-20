import { h, type JSX } from "preact";
import { useMemo } from "preact/hooks";
import { createPreactPanel, type DevtoolsPanelProps } from "@tanstack/devtools-utils/preact";

import { ProseMirrorDevtoolsCore } from "../adapters/core";
import { resolveProseMirrorDevtoolsAdapterPanelProps } from "../adapters/panel-props";
import type {
  ProseMirrorDevtoolsAdapterPanelProps,
  ResolvedProseMirrorDevtoolsAdapterPanelProps,
} from "../adapters/types";

export interface ProseMirrorDevtoolsPreactInit extends ProseMirrorDevtoolsAdapterPanelProps {}

const [PanelBase] = createPreactPanel<
  ResolvedProseMirrorDevtoolsAdapterPanelProps & DevtoolsPanelProps,
  ProseMirrorDevtoolsCore
>(ProseMirrorDevtoolsCore);

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
  return h(PanelBase, useProseMirrorDevtoolsProps(props));
}
