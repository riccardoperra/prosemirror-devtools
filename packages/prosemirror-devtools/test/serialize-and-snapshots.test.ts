import { TextSelection } from "prosemirror-state";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSnapshot,
  inspectState,
  loadSnapshots,
  persistSnapshots,
  restoreDocument,
  restoreSnapshot,
} from "../src/core";
import { createTestState, createTestView } from "./helpers";

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>();

  get length(): number {
    return this.#values.size;
  }

  clear(): void {
    this.#values.clear();
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.#values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }
}

afterEach(() => {
  if (typeof document !== "undefined") document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("state inspection", () => {
  it("reads document statistics lazily and reuses text counts across selection changes", () => {
    const state = createTestState("content");
    const textBetween = vi.spyOn(state.doc, "textBetween");
    const inspection = inspectState(state);
    expect(textBetween).not.toHaveBeenCalled();
    expect(inspection.stats.textSize).toBe(7);

    const selected = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 3)));
    const selectedInspection = inspectState(selected);
    expect(selectedInspection.selection).toMatchObject({ from: 3 });
    expect(selectedInspection.stats.textSize).toBe(7);
    expect(textBetween).toHaveBeenCalledOnce();

    // A consumer mutating its inspection must not corrupt cached statistics for another state.
    inspection.stats.textSize = 0;
    expect(selectedInspection.stats.textSize).toBe(7);

    const changed = selected.apply(selected.tr.insertText("!"));
    expect(inspectState(changed).stats.textSize).toBe(8);
  });
});

describe("snapshots", () => {
  it("persists, loads, and restores a document and selection", () => {
    const storage = new MemoryStorage();
    const view = createTestView(createTestState("saved"));
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3)));
    const snapshot = createSnapshot("editor", view, "Checkpoint");

    persistSnapshots("editor", [snapshot], storage);
    expect(
      JSON.parse(storage.getItem("prosemirror-devtools:snapshots:v1:editor") ?? "null"),
    ).toEqual({
      version: 1,
      snapshots: [snapshot],
    });
    expect(loadSnapshots("editor", storage)).toEqual([snapshot]);

    view.dispatch(view.state.tr.insertText("changed", 1, 6));
    expect(view.state.doc.textContent).toBe("changed");

    restoreSnapshot(view, snapshot);
    expect(view.state.doc.textContent).toBe("saved");
    expect(view.state.selection.toJSON()).toEqual(snapshot.selection);
    view.destroy();
  });

  it("restores a valid document even when the saved selection is stale", () => {
    const source = createTestView(createTestState("source"));
    const target = createTestView(createTestState("target"));
    const snapshot = createSnapshot("source", source, "Source");

    restoreDocument(target, snapshot.doc, {
      type: "text",
      anchor: 10_000,
      head: 10_000,
    });

    expect(target.state.doc.textContent).toBe("source");
    expect(target.state.selection.from).toBeLessThan(target.state.doc.nodeSize);
    source.destroy();
    target.destroy();
  });

  it("returns an empty list for malformed persisted data", () => {
    const storage = new MemoryStorage();
    storage.setItem("prosemirror-devtools:snapshots:editor", "not-json");

    expect(loadSnapshots("editor", storage)).toEqual([]);
  });

  it("filters malformed legacy entries and migrates valid snapshots to the versioned key", () => {
    const storage = new MemoryStorage();
    const view = createTestView(createTestState("valid"));
    const valid = createSnapshot("editor", view, "Valid checkpoint");
    const malformed = [
      null,
      { ...valid, id: 42 },
      { ...valid, instanceId: null },
      { ...valid, createdAt: "today" },
      { ...valid, doc: { content: [] } },
    ];
    storage.setItem(
      "prosemirror-devtools:snapshots:editor",
      JSON.stringify([malformed[0], valid, ...malformed.slice(1)]),
    );

    expect(loadSnapshots("editor", storage)).toEqual([valid]);
    expect(storage.getItem("prosemirror-devtools:snapshots:editor")).toBeNull();
    expect(
      JSON.parse(storage.getItem("prosemirror-devtools:snapshots:v1:editor") ?? "null"),
    ).toEqual({ version: 1, snapshots: [valid] });
    view.destroy();
  });
});
