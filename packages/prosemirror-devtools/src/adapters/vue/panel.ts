import { defineComponent, h, onBeforeUnmount, onMounted, shallowRef, watchEffect } from "vue";
import type { DefineComponent } from "vue";

import { ProseMirrorDevtoolsCore } from "../core";
import { resolveProseMirrorDevtoolsAdapterPanelProps } from "../panel-props";
import type { ProseMirrorDevtoolsAdapterPanelProps } from "../types";

export interface ProseMirrorDevtoolsVueInit extends ProseMirrorDevtoolsAdapterPanelProps {}

const panelProps: string[] = [
  "activePanel",
  "defaultPanel",
  "defaultTab",
  "devtoolsOpen",
  "experimental",
  "extensions",
  "onActivePanelChange",
  "performanceDetailThresholdMs",
  "performanceFrameBudgetMs",
  "store",
  "theme",
];

export const ProseMirrorDevtoolsPanel = defineComponent({
  name: "ProseMirrorDevtoolsPanel",
  props: panelProps,
  setup(props) {
    const host = shallowRef<HTMLElement | null>(null);
    const adapterProps = props as unknown as ProseMirrorDevtoolsVueInit;
    let instance: ProseMirrorDevtoolsCore | null = null;

    onMounted(() => {
      if (!host.value) return;
      instance = new ProseMirrorDevtoolsCore();
      instance.mount(host.value, resolveProseMirrorDevtoolsAdapterPanelProps(adapterProps));
    });
    watchEffect(
      () => {
        const next = resolveProseMirrorDevtoolsAdapterPanelProps(adapterProps);
        instance?.update(next);
      },
      { flush: "post" },
    );
    onBeforeUnmount(() => {
      instance?.unmount();
      instance = null;
    });

    return () => h("div", { ref: host, style: { height: "100%" } });
  },
}) as unknown as DefineComponent<ProseMirrorDevtoolsVueInit, {}, unknown>;
