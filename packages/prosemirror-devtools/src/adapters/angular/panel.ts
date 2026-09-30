import { computed, DestroyRef, effect, inject } from "@angular/core";
import type { DevtoolsPanelProps } from "@tanstack/devtools-utils/angular";

import { ProseMirrorDevtoolsCore } from "../core";
import {
  equalProseMirrorDevtoolsAdapterPanelProps,
  resolveProseMirrorDevtoolsAdapterPanelProps,
} from "../panel-props";
import type { ProseMirrorDevtoolsAdapterPanelProps } from "../types";

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
  const instance = new ProseMirrorDevtoolsCore();
  let mounted = false;
  const panelEffect = effect(() => {
    const props = panelProps();
    if (mounted) {
      instance.update(props);
    } else {
      instance.mount(panel, props);
      mounted = true;
    }
  });

  const dispose = (): void => {
    panelEffect.destroy();
    instance.unmount();
    panel.remove();
  };
  const unregisterDestroy = inject(DestroyRef).onDestroy(dispose);
  return () => {
    unregisterDestroy();
    dispose();
  };
};
