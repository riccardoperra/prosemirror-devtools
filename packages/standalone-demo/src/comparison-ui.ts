import type { DevtoolsStore } from "prosemirror-inspector/core";
import {
  mountProseMirrorDevtools,
  type ProseMirrorDevtoolsMount,
} from "prosemirror-inspector/standalone";

export function mountComparisonControls({
  container,
  store,
}: {
  readonly container: HTMLElement;
  readonly store: DevtoolsStore;
}): () => void {
  if (!import.meta.env.DEV) return () => {};
  const document = container.ownerDocument;
  const controls = document.createElement("div");
  controls.className = "toolbar";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Open another inspector";
  button.setAttribute("aria-expanded", "false");
  controls.append(button);
  const host = document.createElement("section");
  host.className = "inspector";
  host.setAttribute("aria-label", "Additional inspector");
  host.hidden = true;
  container.append(controls, host);
  let panel: ProseMirrorDevtoolsMount | null = null;
  const close = (): void => {
    panel?.unmount();
    panel = null;
    host.hidden = true;
    button.textContent = "Open another inspector";
    button.setAttribute("aria-expanded", "false");
  };
  const toggle = (): void => {
    if (panel) {
      close();
      return;
    }
    host.hidden = false;
    panel = mountProseMirrorDevtools(host, { store, defaultPanel: "history", theme: "light" });
    button.textContent = "Close another inspector";
    button.setAttribute("aria-expanded", "true");
  };
  button.addEventListener("click", toggle);
  return () => {
    button.removeEventListener("click", toggle);
    close();
    controls.remove();
    host.remove();
  };
}
