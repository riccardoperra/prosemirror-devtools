import { Plugin, type EditorState, type Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { afterEach, describe, expect, it, vi } from "vitest";

import { attachProseMirrorDevtools, createProseMirrorDevtoolsStore } from "../src/core";
import { appendTextTransaction, createTestState, createTestView } from "./helpers";

function restoreDescriptor(
  target: object,
  property: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) Object.defineProperty(target, property, descriptor);
  else Reflect.deleteProperty(target, property);
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("custom dispatch profiling edge cases", () => {
  it("leaves application status unknown when the computed root state is discarded", () => {
    const observation: { computedState?: EditorState } = {};
    const originalDispatch = vi.fn(function (this: EditorView, transaction: Transaction) {
      observation.computedState = this.state.apply(transaction);
    });
    const store = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState("before"), {
      dispatchTransaction: originalDispatch,
    });
    const attachment = attachProseMirrorDevtools({
      id: "discarded",
      view,
      store,
      performanceMarks: false,
    });

    view.dispatch(appendTextTransaction(view.state, "x"));

    expect(observation.computedState?.doc.textContent).toBe("beforex");
    expect(view.state.doc.textContent).toBe("before");
    expect(store.getSnapshot().instances[0]?.transactions[0]).toMatchObject({
      applyDuration: expect.any(Number),
      viewUpdateDuration: null,
      applicationStatus: "unknown",
      appliedTransactionCount: null,
      appendedTransactionCount: null,
      filtered: null,
    });

    attachment.detach();
    view.destroy();
  });

  it("preserves custom method assignments made while dispatch is being observed", () => {
    const replacementApply = vi.fn();
    const replacementUpdateState = vi.fn();
    const originalDispatch = vi.fn(function (this: EditorView, transaction: Transaction) {
      const state = this.state;
      this.updateState(state.apply(transaction));
      (state as unknown as Record<string, unknown>).apply = replacementApply;
      (this as unknown as Record<string, unknown>).updateState = replacementUpdateState;
    });
    const store = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState(), {
      dispatchTransaction: originalDispatch,
    });
    const stateBefore = view.state;
    const applyDescriptorBefore = Object.getOwnPropertyDescriptor(stateBefore, "apply");
    const updateStateDescriptorBefore = Object.getOwnPropertyDescriptor(view, "updateState");
    const attachment = attachProseMirrorDevtools({
      id: "custom-assignment",
      view,
      store,
      performanceMarks: false,
    });

    view.dispatch(appendTextTransaction(view.state, "x"));

    expect(stateBefore.apply).toBe(replacementApply);
    expect(view.updateState).toBe(replacementUpdateState);
    expect(view.state.doc.textContent).toBe("x");

    restoreDescriptor(stateBefore, "apply", applyDescriptorBefore);
    restoreDescriptor(view, "updateState", updateStateDescriptorBefore);
    attachment.detach();
    view.destroy();
  });

  it("does not stack wrappers or attribute nested phases to the outer dispatch", () => {
    const transactionKind = "nested-transaction-kind";
    let clock = 10;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const timingPlugin = new Plugin<null>({
      state: {
        init() {
          return null;
        },
        apply(transaction, value) {
          clock += transaction.getMeta(transactionKind) === "inner" ? 7 : 3;
          return value;
        },
      },
      view() {
        return {
          update() {
            clock += 5;
          },
        };
      },
    });
    let outerApplyDuringDispatch: unknown;
    let innerApplyBeforeDispatch: unknown;
    let innerApplyDuringDispatch: unknown;
    let outerUpdateDuringDispatch: unknown;
    let innerUpdateDuringDispatch: unknown;
    const originalDispatch = vi.fn(function (this: EditorView, transaction: Transaction) {
      if (transaction.getMeta(transactionKind) === "outer") {
        const state = this.state;
        outerApplyDuringDispatch = state.apply;
        outerUpdateDuringDispatch = this.updateState;
        this.updateState(state.apply(transaction));
        innerApplyBeforeDispatch = this.state.apply;
        this.dispatch(appendTextTransaction(this.state, "i").setMeta(transactionKind, "inner"));
        return;
      }

      const state = this.state;
      innerApplyDuringDispatch = state.apply;
      innerUpdateDuringDispatch = this.updateState;
      this.updateState(state.apply(transaction));
    });
    const store = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState("", [timingPlugin]), {
      dispatchTransaction: originalDispatch,
    });
    const applyBefore = view.state.apply;
    const updateStateBefore = view.updateState;
    const attachment = attachProseMirrorDevtools({
      id: "nested",
      view,
      store,
      performanceMarks: false,
    });

    view.dispatch(appendTextTransaction(view.state, "o").setMeta(transactionKind, "outer"));

    const records = store.getSnapshot().instances[0]?.transactions ?? [];
    const outerRecord = records.find((record) => record.id === 1);
    const innerRecord = records.find((record) => record.id === 2);
    expect(view.state.doc.textContent).toBe("oi");
    expect(records).toHaveLength(2);
    expect(outerApplyDuringDispatch).not.toBe(applyBefore);
    expect(innerApplyDuringDispatch).toBe(innerApplyBeforeDispatch);
    expect(outerUpdateDuringDispatch).not.toBe(updateStateBefore);
    expect(innerUpdateDuringDispatch).toBe(outerUpdateDuringDispatch);
    expect(outerRecord).toMatchObject({
      applyDuration: 3,
      viewUpdateDuration: 5,
    });
    expect(innerRecord).toMatchObject({
      applyDuration: 7,
      viewUpdateDuration: 5,
      applicationStatus: "applied",
      appliedTransactionCount: 1,
    });

    attachment.detach();
    view.destroy();
  });

  it("degrades without throwing when the current state is frozen", () => {
    const originalDispatch = vi.fn(function (this: EditorView, transaction: Transaction) {
      const applied = this.state.applyTransaction(transaction);
      this.updateState(applied.state);
    });
    const store = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState(), {
      dispatchTransaction: originalDispatch,
    });
    const frozenState = view.state;
    Object.freeze(frozenState);
    const attachment = attachProseMirrorDevtools({
      id: "frozen",
      view,
      store,
      performanceMarks: false,
    });

    expect(() => view.dispatch(appendTextTransaction(view.state, "x"))).not.toThrow();

    expect(Object.isFrozen(frozenState)).toBe(true);
    expect(view.state.doc.textContent).toBe("x");
    expect(store.getSnapshot().instances[0]?.transactions[0]).toMatchObject({
      applyDuration: null,
      viewUpdateDuration: expect.any(Number),
      applicationStatus: "unknown",
      appliedTransactionCount: null,
    });

    attachment.detach();
    view.destroy();
  });

  it("does not mark the root committed when updating the view fails", () => {
    const updateError = new Error("plugin view update failed");
    let failNextUpdate = false;
    const failingViewPlugin = new Plugin({
      view() {
        return {
          update() {
            if (!failNextUpdate) return;
            failNextUpdate = false;
            throw updateError;
          },
        };
      },
    });
    const originalDispatch = vi.fn(function (this: EditorView, transaction: Transaction) {
      const applied = this.state.applyTransaction(transaction);
      this.updateState(applied.state);
    });
    const store = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState("", [failingViewPlugin]), {
      dispatchTransaction: originalDispatch,
    });
    const attachment = attachProseMirrorDevtools({
      id: "failed-update",
      view,
      store,
      performanceMarks: false,
    });
    failNextUpdate = true;

    expect(() => view.dispatch(appendTextTransaction(view.state, "x"))).toThrow(updateError);

    expect(store.getSnapshot().instances[0]?.transactions[0]).toMatchObject({
      applyDuration: expect.any(Number),
      viewUpdateDuration: expect.any(Number),
      applicationStatus: "unknown",
      appliedTransactionCount: null,
      appendedTransactionCount: null,
      filtered: null,
      error: "Error: plugin view update failed",
    });

    attachment.detach();
    view.destroy();
  });

  it("restores method descriptors on the final state returned by applyTransaction", () => {
    const observation: { returnedState?: EditorState } = {};
    let returnedApplyDuringDispatch: unknown;
    let returnedApplyTransactionDuringDispatch: unknown;
    const originalDispatch = vi.fn(function (this: EditorView, transaction: Transaction) {
      const applied = this.state.applyTransaction(transaction);
      observation.returnedState = applied.state;
      returnedApplyDuringDispatch = applied.state.apply;
      returnedApplyTransactionDuringDispatch = applied.state.applyTransaction;
      this.updateState(applied.state);
    });
    const store = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState(), {
      dispatchTransaction: originalDispatch,
    });
    const prototypeApply = view.state.apply;
    const prototypeApplyTransaction = view.state.applyTransaction;
    const attachment = attachProseMirrorDevtools({
      id: "final-state-cleanup",
      view,
      store,
      performanceMarks: false,
    });

    view.dispatch(appendTextTransaction(view.state, "x"));

    const returnedState = observation.returnedState;
    if (!returnedState) throw new Error("Expected applyTransaction to return a state");
    expect(returnedState).toBe(view.state);
    expect(returnedApplyDuringDispatch).not.toBe(prototypeApply);
    expect(returnedApplyTransactionDuringDispatch).not.toBe(prototypeApplyTransaction);
    expect(Object.getOwnPropertyDescriptor(returnedState, "apply")).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(returnedState, "applyTransaction")).toBeUndefined();
    expect(returnedState.apply).toBe(prototypeApply);
    expect(returnedState.applyTransaction).toBe(prototypeApplyTransaction);

    attachment.detach();
    view.destroy();
  });
});
