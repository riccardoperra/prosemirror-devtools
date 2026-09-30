import { createComponent, createMemo, createSignal, mergeProps, Show } from "solid-js";
import { render } from "solid-js/web";

import { ProseMirrorDevtoolsPanel } from "../panel/panel";
import { resolveProseMirrorDevtoolsPanelProps } from "./panel-props";
import type { ProseMirrorDevtoolsAdapterPanelProps } from "./types";

function normalizeMountProps(props: unknown): ProseMirrorDevtoolsAdapterPanelProps | undefined {
  if (typeof props === "string") {
    if (props === "light" || props === "dark") return { theme: props };
    return undefined;
  }
  if (!props || typeof props !== "object") return undefined;
  return props as ProseMirrorDevtoolsAdapterPanelProps;
}

/**
 * Framework-independent mount contract consumed by `@tanstack/devtools-utils`.
 *
 * The Solid renderer stays behind this class so every framework adapter shares
 * the same imperative mount contract.
 */
export class ProseMirrorDevtoolsCore {
  readonly #initialProps: ProseMirrorDevtoolsAdapterPanelProps;
  #dispose: (() => void) | null = null;
  #update: ((props: unknown) => void) | null = null;

  constructor(initialProps: ProseMirrorDevtoolsAdapterPanelProps = {}) {
    this.#initialProps = initialProps;
  }

  mount(element: HTMLElement, mountProps?: unknown): void {
    if (this.#dispose) throw new Error("ProseMirror Devtools is already mounted.");

    const [currentProps, setCurrentProps] = createSignal(mountProps);
    this.#dispose = render(() => {
      // Resolve inside the Solid owner so accessor-backed host props remain
      // reactive. Updating appearance must not reset navigation or inspectors.
      const panelProps = createMemo(() =>
        resolveProseMirrorDevtoolsPanelProps(
          element,
          this.#initialProps,
          normalizeMountProps(currentProps()),
        ),
      );
      return createComponent(Show, {
        keyed: true,
        get when() {
          return panelProps() !== null;
        },
        get children() {
          return createComponent(
            ProseMirrorDevtoolsPanel,
            mergeProps(() => panelProps() ?? {}),
          );
        },
      });
    }, element);
    this.#update = (props) => setCurrentProps(() => props);
  }

  update(mountProps?: unknown): void {
    if (!this.#update) throw new Error("ProseMirror Devtools is not mounted.");
    this.#update(mountProps);
  }

  unmount(): void {
    const dispose = this.#dispose;
    this.#dispose = null;
    this.#update = null;
    dispose?.();
  }
}
