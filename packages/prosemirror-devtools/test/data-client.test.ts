import type { EditorView } from "prosemirror-view";
import { describe, expect, it, vi } from "vitest";

import { createDevtoolsDataAccess, createProseMirrorDevtoolsStore } from "../src/core";
import { appendTextTransaction, createTestState } from "./helpers";

describe("createDevtoolsDataAccess", () => {
  it("reuses transaction readables for equivalent queries", () => {
    const store = createProseMirrorDevtoolsStore();
    const { data } = createDevtoolsDataAccess(store);
    const defaults = data.transactions("editor");

    expect(
      data.transactions("editor", {
        offset: -1,
        limit: Number.POSITIVE_INFINITY,
        order: "oldest-first",
      }),
    ).toBe(defaults);
    expect(data.transactions("editor", { limit: Number.NaN })).not.toBe(defaults);
    expect(data.transactions("editor\u0000nested")).not.toBe(defaults);
  });

  it("keeps page snapshots stable until the selected instance changes", () => {
    const store = createProseMirrorDevtoolsStore();
    const state = createTestState();
    const view = { state } as EditorView;
    store.register({ id: "editor", view });
    const { data } = createDevtoolsDataAccess(store);
    const transactions = data.transactions("editor", { limit: 10 });
    const initialPage = transactions.getSnapshot();
    const listener = vi.fn();
    const unsubscribe = transactions.subscribe(listener);

    expect(transactions.getSnapshot()).toBe(initialPage);

    const transaction = appendTextTransaction(state, "x");
    const measurement = store.beginTransaction("editor", transaction, state, false);
    const applied = state.applyTransaction(transaction);
    store.finishTransaction(measurement, {
      stateAfter: applied.state,
      appliedTransactions: applied.transactions,
    });
    store.flush();

    const nextPage = transactions.getSnapshot();
    expect(listener).toHaveBeenCalledOnce();
    expect(nextPage).not.toBe(initialPage);
    expect(nextPage.records.map(({ id }) => id)).toEqual([1]);
    expect(transactions.getSnapshot()).toBe(nextPage);

    unsubscribe();
  });
});
