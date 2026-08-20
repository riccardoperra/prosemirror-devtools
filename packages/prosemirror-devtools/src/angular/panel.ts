import { computed, effect } from "@angular/core";
import type { DevtoolsPanelProps } from "@tanstack/devtools-utils/angular";

import { ProseMirrorDevtoolsCore } from "../adapters/core";
import {
  equalProseMirrorDevtoolsAdapterPanelProps,
  resolveProseMirrorDevtoolsAdapterPanelProps,
} from "../adapters/panel-props";
import type { ProseMirrorDevtoolsAdapterPanelProps } from "../adapters/types";

export interface ProseMirrorDevtoolsAngularInit extends ProseMirrorDevtoolsAdapterPanelProps {}

export type ProseMirrorDevtoolsAngularPanel = () => (
  inputs: () => ProseMirrorDevtoolsAngularInit & Partial<DevtoolsPanelProps>,
  hostElement: HTMLElement,
) => () => void;

export const ProseMirrorDevtoolsPanel: ProseMirrorDevtoolsAngularPanel = () => (inputs, host) => {
  const panel = host.ownerDocument.createElement("div");
  panel.style.height = "100%";
  host.appendChild(panel);

  const panelProps = computed(() => resolveProseMirrorDevtoolsAdapterPanelProps(inputs()), {
    equal: equalProseMirrorDevtoolsAdapterPanelProps,
  });
  const panelEffect = effect((onCleanup) => {
    const props = panelProps();
    const instance = new ProseMirrorDevtoolsCore(props);
    instance.mount(panel, props);
    onCleanup(() => instance.unmount());
  });

  return () => {
    panelEffect.destroy();
    panel.remove();
  };
};
