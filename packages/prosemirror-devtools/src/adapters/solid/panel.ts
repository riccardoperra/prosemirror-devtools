import { createComponent, type JSX } from "solid-js";
import {
  createSolidPanel,
  type ClassType,
  type DevtoolsPanelProps,
} from "@tanstack/devtools-utils/solid";

import { ProseMirrorDevtoolsCore } from "../core";
import type {
  ProseMirrorDevtoolsAdapterPanelProps,
  ResolvedProseMirrorDevtoolsAdapterPanelProps,
} from "../types";

export interface ProseMirrorDevtoolsSolidInit extends ProseMirrorDevtoolsAdapterPanelProps {}

const [PanelBase] = createSolidPanel<
  ResolvedProseMirrorDevtoolsAdapterPanelProps & DevtoolsPanelProps
>(ProseMirrorDevtoolsCore as unknown as ClassType);

export function resolveProseMirrorDevtoolsSolidProps(
  options: ProseMirrorDevtoolsAdapterPanelProps,
  hostProps?: Partial<DevtoolsPanelProps>,
): ResolvedProseMirrorDevtoolsAdapterPanelProps & DevtoolsPanelProps {
  return {
    get activePanel() {
      return options.activePanel;
    },
    get defaultPanel() {
      return options.defaultPanel;
    },
    get defaultTab() {
      return options.defaultTab;
    },
    get devtoolsOpen() {
      return hostProps?.devtoolsOpen ?? options.devtoolsOpen ?? true;
    },
    get extensions() {
      return options.extensions;
    },
    get onActivePanelChange() {
      return options.onActivePanelChange;
    },
    get performanceDetailThresholdMs() {
      return options.performanceDetailThresholdMs;
    },
    get performanceFrameBudgetMs() {
      return options.performanceFrameBudgetMs;
    },
    get store() {
      return options.store;
    },
    get theme() {
      return hostProps?.theme ?? options.theme ?? "dark";
    },
  } as ResolvedProseMirrorDevtoolsAdapterPanelProps & DevtoolsPanelProps;
}

export function ProseMirrorDevtoolsPanel(props: ProseMirrorDevtoolsSolidInit = {}): JSX.Element {
  return createComponent(PanelBase, resolveProseMirrorDevtoolsSolidProps(props));
}
