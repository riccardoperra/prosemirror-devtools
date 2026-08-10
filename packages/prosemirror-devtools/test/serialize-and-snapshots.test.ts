import { TextSelection } from "prosemirror-state";
import { afterEach, describe, expect, it } from "vitest";

import {
  createSnapshot,
  loadSnapshots,
  persistSnapshots,
  restoreDocument,
  restoreSnapshot,
  serializeValue,
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
});

describe("serializeValue", () => {
  it("preserves JSON primitives and stringifies only non-finite numbers", () => {
    expect(serializeValue({ enabled: true, disabled: false, count: 2, invalid: Infinity })).toEqual(
      {
        enabled: true,
        disabled: false,
        count: 2,
        invalid: "Infinity",
      },
    );
  });

  it("serializes circular objects and arrays without losing their constructor context", () => {
    class Payload {
      label = "root";
      self: Payload = this;
    }
    const payload = new Payload();
    const array: unknown[] = [payload];
    array.push(array);

    expect(serializeValue({ payload, array })).toEqual({
      payload: {
        label: "root",
        self: "[Circular Payload]",
      },
      array: [
        {
          label: "root",
          self: "[Circular Payload]",
        },
        "[Circular Array]",
      ],
    });
  });

  it("honors entry, depth, and string limits", () => {
    expect(
      serializeValue(
        {
          first: "abcdef",
          second: { nested: true },
          third: 3,
        },
        { maxEntries: 2, maxDepth: 1, maxStringLength: 3 },
      ),
    ).toEqual({
      first: "abc…",
      second: "[Object]",
      "…": "[+1 more]",
    });
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
