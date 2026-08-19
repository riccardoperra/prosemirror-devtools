import type { EditorView } from "prosemirror-view";
import { describe, expect, it, vi } from "vitest";

import { createDevtoolsDataAccess, createProseMirrorDevtoolsStore } from "../src/core";
import { appendTextTransaction, createTestState } from "./helpers";

describe("createDevtoolsDataAccess", () => {
  it("notifies every subscriber of an instance update", () => {
    const store = createProseMirrorDevtoolsStore();
    const { data } = createDevtoolsDataAccess(store);
    const instance = data.instance("editor");
    const firstListener = vi.fn();
    const secondListener = vi.fn();

    instance.subscribe(firstListener);
    instance.subscribe(secondListener);
    store.register({ id: "editor", view: { state: createTestState() } as EditorView });

    expect(data.instance("editor")).toBe(instance);
    expect(firstListener).toHaveBeenCalledOnce();
    expect(secondListener).toHaveBeenCalledOnce();
    expect(instance.getSnapshot()?.id).toBe("editor");
  });

  it("follows the active instance and its updates", () => {
    const store = createProseMirrorDevtoolsStore();
    const firstView = { state: createTestState() } as EditorView;
    const secondView = { state: createTestState() } as EditorView;
    store.register({ id: "first", view: firstView });
    store.register({ id: "second", view: secondView });
    const { data } = createDevtoolsDataAccess(store);
    const listener = vi.fn();
    const unsubscribe = data.activeInstance.subscribe(listener);

    expect(data.activeInstance.getSnapshot()?.id).toBe("first");

    store.setActiveInstance("second");
    expect(data.activeInstance.getSnapshot()?.id).toBe("second");
    expect(listener).toHaveBeenCalledOnce();

    const transaction = appendTextTransaction(secondView.state, "x");
    const measurement = store.beginTransaction("second", transaction, secondView.state, false);
    const applied = secondView.state.applyTransaction(transaction);
    (secondView as { state: typeof applied.state }).state = applied.state;
    store.finishTransaction(measurement, {
      stateAfter: applied.state,
      appliedTransactions: applied.transactions,
    });
    store.flush();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(data.activeInstance.getSnapshot()?.transactions).toHaveLength(1);

    unsubscribe();
  });
});
