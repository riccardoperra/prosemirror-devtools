import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  attachProseMirrorDevtools,
  createProseMirrorDevtoolsStore,
  createSnapshot,
  persistSnapshots,
} from "../src/core";
import { ProseMirrorDevtoolsPanel } from "../src/panel/panel";
import { createTestState, createTestView } from "./helpers";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("checkpoint comparison panel", () => {
  it("compares A and B, previews an explicit target, and disables a stale restore", () => {
    const store = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState("before"));
    const attachment = attachProseMirrorDevtools({
      id: "checkpoints",
      label: "Checkpoint editor",
      view,
      store,
      performanceMarks: false,
    });
    const before = createSnapshot("checkpoints", view, "Before");
    view.dispatch(view.state.tr.insertText("after", 1, 7));
    const after = createSnapshot("checkpoints", view, "After");
    persistSnapshots("checkpoints", [before, after]);
    const host = document.createElement("div");
    document.body.append(host);
    const dispose = render(
      () => <ProseMirrorDevtoolsPanel store={store} defaultPanel="snapshots" />,
      host,
    );
    const button = (text: string) =>
      Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
        (item) => item.textContent === text,
      );
    try {
      for (const [label, id] of [
        ["Checkpoint A", before.id],
        ["Checkpoint B", after.id],
      ]) {
        const select = host.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!;
        select.value = id ?? "";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const comparison = host.querySelector('[aria-label="Checkpoint A to B differences"]');
      expect(comparison?.textContent).toContain("/doc/content/0/content/0/text");
      expect(comparison?.textContent).toContain('"before"');
      expect(comparison?.textContent).toContain('"after"');
      button("Preview restore")?.click();
      expect(view.state.doc.textContent).toBe("after");
      expect(host.querySelector('[aria-label="Snapshot restore preview"]')?.textContent).toContain(
        "Target editor Checkpoint editor (checkpoints)",
      );
      view.dispatch(view.state.tr.insertText("changed", 1, 6));
      expect(button("Restore to Checkpoint editor")?.disabled).toBe(true);
      button("Preview restore")?.click();
      button("Restore to Checkpoint editor")?.click();
      expect(view.state.doc.textContent).toBe("before");
      expect(store.getInstance("checkpoints")?.dispatchCount).toBe(3);
    } finally {
      dispose();
      attachment.detach();
      view.destroy();
    }
  });
});
