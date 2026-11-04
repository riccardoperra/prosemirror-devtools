import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createProseMirrorDevtoolsStore, createSnapshot, loadSnapshots } from "../src/core";
import { useSnapshots } from "../src/panel/features/snapshots/use-snapshots";
import { createTestState, createTestView } from "./helpers";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("snapshot imports", () => {
  it("requires a current explicit preview and refuses a remounted target", () => {
    const source = createTestView(createTestState("saved"));
    const target = createTestView(createTestState("target"));
    const replacement = createTestView(createTestState("replacement"));
    const store = createProseMirrorDevtoolsStore();
    const unregister = store.register({ id: "editor", view: target });
    const [instance, setInstance] = createSignal(store.getInstance("editor")!);
    let dispose = (): void => {};
    const snapshots = createRoot((cleanup) => {
      dispose = cleanup;
      return useSnapshots(instance);
    });
    const checkpoint = createSnapshot("source", source);
    try {
      snapshots.previewRestore(checkpoint);
      expect(target.state.doc.textContent).toBe("target");
      target.dispatch(target.state.tr.insertText(" changed", 7));
      snapshots.confirmRestore();
      expect(target.state.doc.textContent).toBe("target changed");
      expect(snapshots.error()).toContain("target changed");
      snapshots.previewRestore(checkpoint);
      setInstance({ ...instance(), view: replacement });
      snapshots.confirmRestore();
      expect(replacement.state.doc.textContent).toBe("replacement");
      snapshots.previewRestore(checkpoint);
      snapshots.confirmRestore();
      expect(replacement.state.doc.textContent).toBe("saved");
    } finally {
      dispose();
      unregister();
      source.destroy();
      target.destroy();
      replacement.destroy();
    }
  });

  it.each(["switch", "dispose", "complete"] as const)(
    "keeps imports with their owner: %s",
    async (action) => {
      const first = createTestView(createTestState("first"));
      const second = createTestView(createTestState("second"));
      const store = createProseMirrorDevtoolsStore();
      const unregisterFirst = store.register({ id: "first", view: first });
      const unregisterSecond = store.register({ id: "second", view: second });
      const [instance, setInstance] = createSignal(store.getInstance("first")!);
      let dispose = (): void => {};
      const snapshots = createRoot((cleanup) => {
        dispose = cleanup;
        return useSnapshots(instance);
      });
      let resolveText!: (value: string) => void;
      const file = {
        name: "document.json",
        text: () =>
          new Promise<string>((resolve) => {
            resolveText = resolve;
          }),
      } as File;
      try {
        const pending = snapshots.importFile(file);
        if (action === "switch") setInstance(store.getInstance("second")!);
        else if (action === "dispose") dispose();
        resolveText(JSON.stringify(first.state.doc.toJSON()));
        await pending;
        expect(snapshots.snapshots()).toHaveLength(action === "complete" ? 1 : 0);
        expect(loadSnapshots("first")).toHaveLength(action === "complete" ? 1 : 0);
        expect(loadSnapshots("second")).toHaveLength(0);
      } finally {
        dispose();
        unregisterFirst();
        unregisterSecond();
        first.destroy();
        second.destroy();
      }
    },
  );
});
