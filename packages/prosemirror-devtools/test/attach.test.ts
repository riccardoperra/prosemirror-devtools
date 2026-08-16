import { Plugin, type Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { afterEach, describe, expect, it, vi } from "vitest";

import { attachProseMirrorDevtools, createProseMirrorDevtoolsStore } from "../src/core";
import { appendTextTransaction, createTestState, createTestView } from "./helpers";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("attachProseMirrorDevtools", () => {
  it("profiles the default dispatch apply and view phases and restores it on detach", () => {
    const store = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState("before"));
    const updateState = vi.spyOn(view, "updateState");
    expect(view.props.dispatchTransaction).toBeUndefined();

    const attachment = attachProseMirrorDevtools({
      id: "editor",
      view,
      store,
      performanceMarks: false,
    });
    const wrappedDispatch = view.props.dispatchTransaction;

    expect(wrappedDispatch).toBeTypeOf("function");
    view.dispatch(appendTextTransaction(view.state, "!"));

    expect(view.state.doc.textContent).toBe("before!");
    expect(updateState).toHaveBeenCalledOnce();
    expect(store.getSnapshot().instances[0]?.transactions[0]).toMatchObject({
      applyDuration: expect.any(Number),
      viewUpdateDuration: expect.any(Number),
      customDispatchDuration: null,
      appliedTransactionCount: 1,
      appendedTransactionCount: 0,
      docChanged: true,
      stepCount: 1,
      error: null,
    });

    attachment.detach();
    attachment.detach();

    expect(view.props.dispatchTransaction).toBeUndefined();
    expect(store.getSnapshot().instances).toEqual([]);

    view.dispatch(appendTextTransaction(view.state, "?"));
    expect(view.state.doc.textContent).toBe("before!?");
    view.destroy();
  });

  it("profiles apply and view phases in a custom dispatcher and restores shadowed methods", () => {
    const store = createProseMirrorDevtoolsStore();
    let applyDuringDispatch: unknown;
    let updateStateDuringDispatch: unknown;
    const originalDispatch = vi.fn(function (this: EditorView, transaction: Transaction) {
      const state = this.state;
      applyDuringDispatch = state.apply;
      updateStateDuringDispatch = this.updateState;
      this.updateState(state.apply(transaction));
    });
    const view = createTestView(createTestState(), {
      dispatchTransaction: originalDispatch,
    });
    const stateBefore = view.state;
    const applyBefore = stateBefore.apply;
    const applyDescriptorBefore = Object.getOwnPropertyDescriptor(stateBefore, "apply");
    const updateStateBefore = view.updateState;
    const updateStateDescriptorBefore = Object.getOwnPropertyDescriptor(view, "updateState");

    const attachment = attachProseMirrorDevtools({
      id: "custom",
      view,
      store,
      performanceMarks: false,
    });
    expect(view.props.dispatchTransaction).not.toBe(originalDispatch);

    view.dispatch(appendTextTransaction(view.state, "x"));
    expect(originalDispatch).toHaveBeenCalledOnce();
    expect(store.getSnapshot().instances[0]?.transactions[0]).toMatchObject({
      applyDuration: expect.any(Number),
      viewUpdateDuration: expect.any(Number),
      customDispatchDuration: expect.any(Number),
      applicationStatus: "applied",
      appliedTransactionCount: 1,
      appendedTransactionCount: 0,
      filtered: false,
      docAfter: expect.objectContaining({ type: "doc" }),
    });
    expect(applyDuringDispatch).not.toBe(applyBefore);
    expect(updateStateDuringDispatch).not.toBe(updateStateBefore);
    expect(stateBefore.apply).toBe(applyBefore);
    expect(Object.getOwnPropertyDescriptor(stateBefore, "apply")).toEqual(applyDescriptorBefore);
    expect(view.updateState).toBe(updateStateBefore);
    expect(Object.getOwnPropertyDescriptor(view, "updateState")).toEqual(
      updateStateDescriptorBefore,
    );

    attachment.detach();
    expect(view.props.dispatchTransaction).toBe(originalDispatch);
    view.destroy();
  });

  it("captures appended transactions from a custom dispatcher using applyTransaction", () => {
    const appendPlugin = new Plugin({
      appendTransaction(transactions, _oldState, newState) {
        if (transactions.some((transaction) => transaction.getMeta("test-appended"))) {
          return null;
        }
        return appendTextTransaction(newState, "!").setMeta("test-appended", true);
      },
    });
    const store = createProseMirrorDevtoolsStore();
    const originalDispatch = vi.fn(function (this: EditorView, transaction: Transaction) {
      const applied = this.state.applyTransaction(transaction);
      this.updateState(applied.state);
    });
    const view = createTestView(createTestState("", [appendPlugin]), {
      dispatchTransaction: originalDispatch,
    });
    const attachment = attachProseMirrorDevtools({
      id: "custom-appended",
      view,
      store,
      performanceMarks: false,
    });

    view.dispatch(appendTextTransaction(view.state, "x"));

    expect(view.state.doc.textContent).toBe("x!");
    expect(store.getSnapshot().instances[0]?.transactions[0]).toMatchObject({
      applyDuration: expect.any(Number),
      viewUpdateDuration: expect.any(Number),
      applicationStatus: "applied",
      appliedTransactionCount: 2,
      appendedTransactionCount: 1,
      filtered: false,
      transactions: [
        { index: 0, appended: false },
        { index: 1, appended: true },
      ],
      stepCount: 2,
    });

    attachment.detach();
    view.destroy();
  });

  it("reports a root transaction filtered by a custom dispatcher's applyTransaction", () => {
    const filterPlugin = new Plugin({
      filterTransaction(transaction) {
        return transaction.getMeta("test-filter") !== true;
      },
    });
    const store = createProseMirrorDevtoolsStore();
    const originalDispatch = vi.fn(function (this: EditorView, transaction: Transaction) {
      const applied = this.state.applyTransaction(transaction);
      this.updateState(applied.state);
    });
    const view = createTestView(createTestState("before", [filterPlugin]), {
      dispatchTransaction: originalDispatch,
    });
    const attachment = attachProseMirrorDevtools({
      id: "custom-filtered",
      view,
      store,
      performanceMarks: false,
    });

    view.dispatch(appendTextTransaction(view.state, "x").setMeta("test-filter", true));

    expect(view.state.doc.textContent).toBe("before");
    expect(store.getSnapshot().instances[0]?.transactions[0]).toMatchObject({
      applyDuration: expect.any(Number),
      viewUpdateDuration: expect.any(Number),
      applicationStatus: "filtered",
      appliedTransactionCount: 0,
      appendedTransactionCount: 0,
      filtered: true,
      transactions: [],
      stepCount: 0,
      docChanged: false,
    });

    attachment.detach();
    view.destroy();
  });

  it("restores temporarily shadowed custom-dispatch methods when dispatch throws", () => {
    const dispatchError = new Error("custom dispatch failed");
    let applyDuringDispatch: unknown;
    let updateStateDuringDispatch: unknown;
    const originalDispatch = vi.fn(function (this: EditorView, transaction: Transaction) {
      const state = this.state;
      applyDuringDispatch = state.apply;
      updateStateDuringDispatch = this.updateState;
      this.updateState(state.apply(transaction));
      throw dispatchError;
    });
    const store = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState(), {
      dispatchTransaction: originalDispatch,
    });
    const stateBefore = view.state;
    const applyBefore = stateBefore.apply;
    const applyDescriptorBefore = Object.getOwnPropertyDescriptor(stateBefore, "apply");
    const updateStateBefore = view.updateState;
    const updateStateDescriptorBefore = Object.getOwnPropertyDescriptor(view, "updateState");
    const attachment = attachProseMirrorDevtools({
      id: "custom-throwing",
      view,
      store,
      performanceMarks: false,
    });

    expect(() => view.dispatch(appendTextTransaction(view.state, "x"))).toThrow(dispatchError);

    expect(applyDuringDispatch).not.toBe(applyBefore);
    expect(updateStateDuringDispatch).not.toBe(updateStateBefore);
    expect(stateBefore.apply).toBe(applyBefore);
    expect(Object.getOwnPropertyDescriptor(stateBefore, "apply")).toEqual(applyDescriptorBefore);
    expect(view.updateState).toBe(updateStateBefore);
    expect(Object.getOwnPropertyDescriptor(view, "updateState")).toEqual(
      updateStateDescriptorBefore,
    );
    expect(store.getSnapshot().instances[0]?.transactions[0]).toMatchObject({
      applyDuration: expect.any(Number),
      viewUpdateDuration: expect.any(Number),
      applicationStatus: "applied",
      appliedTransactionCount: 1,
      error: "Error: custom dispatch failed",
    });

    attachment.detach();
    view.destroy();
  });

  it("does not let a failing store subscriber escape editor dispatch", () => {
    const store = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState());
    const attachment = attachProseMirrorDevtools({
      id: "editor",
      view,
      store,
      performanceMarks: false,
    });
    const subscriberError = new Error("subscriber failed");
    const unsubscribe = store.subscribe(() => {
      throw subscriberError;
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => view.dispatch(appendTextTransaction(view.state, "x"))).not.toThrow();
    expect(() => store.flush()).not.toThrow();

    expect(view.state.doc.textContent).toBe("x");
    expect(store.getSnapshot().instances[0]?.transactions).toHaveLength(1);
    expect(consoleError).toHaveBeenCalledWith(
      "[prosemirror-devtools] Store subscriber failed",
      subscriberError,
    );

    unsubscribe();
    attachment.detach();
    view.destroy();
  });

  it("rejects attaching the same view and id to a different store", () => {
    const firstStore = createProseMirrorDevtoolsStore();
    const secondStore = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState());
    const attachment = attachProseMirrorDevtools({
      id: "editor",
      view,
      store: firstStore,
      performanceMarks: false,
    });

    expect(() =>
      attachProseMirrorDevtools({
        id: "editor",
        view,
        store: secondStore,
        performanceMarks: false,
      }),
    ).toThrow("This EditorView is already attached to a different devtools store.");
    expect(firstStore.getSnapshot().instances).toHaveLength(1);
    expect(secondStore.getSnapshot().instances).toEqual([]);

    attachment.detach();
    view.destroy();
  });

  it("rejects taking over an attachment owned by another explicit session", () => {
    const store = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState());
    const attachment = attachProseMirrorDevtools({
      id: "editor",
      performanceMarks: false,
      sessionId: "first",
      store,
      view,
    });

    expect(() =>
      attachProseMirrorDevtools({
        id: "editor",
        performanceMarks: false,
        sessionId: "second",
        store,
        view,
      }),
    ).toThrow("This EditorView is already attached to a different devtools session.");
    expect(store.getInstance("editor")?.view).toBe(view);

    attachment.detach();
    view.destroy();
  });

  it("rolls back registration when dispatcher installation fails", () => {
    const store = createProseMirrorDevtoolsStore();
    const installationError = new Error("setProps failed");
    const view = {
      state: createTestState(),
      props: {},
      setProps: vi.fn(() => {
        throw installationError;
      }),
    } as unknown as EditorView;

    expect(() =>
      attachProseMirrorDevtools({ id: "editor", performanceMarks: false, store, view }),
    ).toThrow(installationError);
    expect(store.getSnapshot().instances).toEqual([]);
  });
});
