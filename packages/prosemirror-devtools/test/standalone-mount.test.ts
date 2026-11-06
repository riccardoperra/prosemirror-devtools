import { afterEach, describe, expect, it, vi } from "vitest";

import { mountProseMirrorDevtools } from "../src/standalone";
import { createProseMirrorDevtoolsStore } from "../src/core";
import { createTestView } from "./helpers";

afterEach(() => {
  vi.unstubAllEnvs();
  document.body.replaceChildren();
});

describe("standalone mount", () => {
  it("mounts, updates, and unmounts the shared panel without a framework host", () => {
    vi.stubEnv("NODE_ENV", "development");
    const store = createProseMirrorDevtoolsStore();
    const view = createTestView();
    const unregister = store.register({ id: "standalone", view });
    const container = document.createElement("div");
    document.body.append(container);
    const panel = mountProseMirrorDevtools(container, {
      store,
      theme: "light",
      defaultPanel: "selection",
    });
    try {
      const root = container.querySelector(".pm-devtools");
      expect(root?.getAttribute("data-embedded")).toBeNull();
      expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe(
        "Selection",
      );
      panel.update({ store, theme: "dark", defaultPanel: "state", className: "updated" });
      expect(container.querySelector(".pm-devtools")).toBe(root);
      expect(root?.getAttribute("data-theme")).toBe("dark");
      expect(root?.classList.contains("updated")).toBe(true);
      expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe(
        "Selection",
      );
      panel.unmount();
      expect(container.childElementCount).toBe(0);
      panel.unmount();
      expect(() => panel.update({ store })).toThrow("not mounted");
    } finally {
      panel.unmount();
      unregister();
      view.destroy();
    }
  });

  it.each(["production", "test"])("is inactive in %s", (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    const container = document.createElement("div");
    const existing = document.createElement("span");
    container.append(existing);
    const panel = mountProseMirrorDevtools(container);
    panel.update({ theme: "dark" });
    panel.unmount();
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toBe(existing);
  });
});
