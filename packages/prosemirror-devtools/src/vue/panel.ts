import { defineComponent, h } from "vue";
import { createVuePanel, type DevtoolsPanelProps } from "@tanstack/devtools-utils/vue";
import type { DefineComponent } from "vue";

import { ProseMirrorDevtoolsCore } from "../adapters/core";
import {
  equalProseMirrorDevtoolsAdapterPanelProps,
  resolveProseMirrorDevtoolsAdapterPanelProps,
} from "../adapters/panel-props";
import type {
  ProseMirrorDevtoolsAdapterPanelProps,
  ResolvedProseMirrorDevtoolsAdapterPanelProps,
} from "../adapters/types";

export interface ProseMirrorDevtoolsVueInit extends ProseMirrorDevtoolsAdapterPanelProps {}

class ProseMirrorDevtoolsVueCore extends ProseMirrorDevtoolsCore {
  constructor(props: ProseMirrorDevtoolsVueInit) {
    super(props);
  }
}

const [PanelBase] = createVuePanel<
  ResolvedProseMirrorDevtoolsAdapterPanelProps & DevtoolsPanelProps,
  ProseMirrorDevtoolsVueCore
>(ProseMirrorDevtoolsVueCore);

const panelProps: string[] = [
  "activePanel",
  "defaultPanel",
  "defaultTab",
  "devtoolsOpen",
  "extensions",
  "onActivePanelChange",
  "performanceDetailThresholdMs",
  "performanceFrameBudgetMs",
  "store",
  "theme",
];

function createPanelWrapper(
  name: string,
  Component: typeof PanelBase,
): DefineComponent<ProseMirrorDevtoolsVueInit, {}, unknown> {
  return defineComponent({
    name,
    props: panelProps,
    setup(props) {
      const adapterProps = props as unknown as ProseMirrorDevtoolsVueInit;
      let current = resolveProseMirrorDevtoolsAdapterPanelProps(adapterProps);
      let version = 0;

      return () => {
        const next = resolveProseMirrorDevtoolsAdapterPanelProps(adapterProps);
        if (!equalProseMirrorDevtoolsAdapterPanelProps(current, next)) {
          current = next;
          version += 1;
        }
        return h(Component, {
          devtoolsProps: current,
          key: version,
          props: current,
        });
      };
    },
  }) as unknown as DefineComponent<ProseMirrorDevtoolsVueInit, {}, unknown>;
}

export const ProseMirrorDevtoolsPanel = createPanelWrapper("ProseMirrorDevtoolsPanel", PanelBase);
