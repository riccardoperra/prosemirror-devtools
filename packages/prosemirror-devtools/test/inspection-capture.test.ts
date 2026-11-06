import { Plugin, PluginKey } from "prosemirror-state";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachProseMirrorDevtools,
  createBoundedCaptureProfile,
  createPluginStateInspector,
  createProseMirrorDevtoolsSession,
  createProseMirrorDevtoolsStore,
  type ProseMirrorDevtoolsSession,
} from "../src/core";
import { appendTextTransaction, createTestState, createTestView } from "./helpers";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function editor(session: ProseMirrorDevtoolsSession, plugins: readonly Plugin[] = []) {
  const view = createTestView(createTestState("", session.instrumentPlugins(plugins)));
  cleanups.push(
    () => view.destroy(),
    () => session.dispose(),
  );
  session.attach(view);
  return view;
}

describe("canonical inspection capture", () => {
  it("captures actual filter and append outcomes without repeating hooks", () => {
    let filterCalls = 0;
    let appendCalls = 0;
    const filter = new Plugin({
      key: new PluginKey("filter"),
      filterTransaction(transaction) {
        filterCalls += 1;
        return transaction.getMeta("reject") !== true;
      },
    });
    const append = new Plugin({
      key: new PluginKey("append"),
      appendTransaction(transactions, _oldState, state) {
        appendCalls += 1;
        return transactions.some((transaction) => transaction.getMeta("requestAppend"))
          ? appendTextTransaction(state, "a").setMeta("reject", true)
          : null;
      },
    });
    const store = createProseMirrorDevtoolsStore();
    const session = createProseMirrorDevtoolsSession({
      id: "editor",
      store,
      performanceMarks: false,
    });
    const view = editor(session, [filter, append]);
    view.dispatch(appendTextTransaction(view.state, "r").setMeta("requestAppend", true));
    view.dispatch(appendTextTransaction(view.state, "x").setMeta("reject", true));

    const records = store.getInstance("editor")?.transactions;
    expect(filterCalls).toBe(3);
    expect(appendCalls).toBe(1);
    expect(view.state.doc.textContent).toBe("r");
    expect(records?.[0]).toMatchObject({
      applicationStatus: "applied",
      appliedTransactionCount: 1,
    });
    expect(records?.[0]?.inspection?.provenance).toMatchObject({
      kind: "partial",
      transactions: [
        { id: 0, appliedIndex: 0, origin: { kind: "root" } },
        { id: 1, appliedIndex: null, origin: { kind: "append", pluginKey: "append$" } },
      ],
      filters: [
        { transactionId: 0, outcome: "accepted", pluginKey: "filter$" },
        { transactionId: 1, outcome: "rejected", pluginKey: "filter$" },
      ],
      appends: [{ inputTransactionIds: [0], outputTransactionId: 1, outcome: "returned" }],
    });
    expect(records?.[1]).toMatchObject({
      applicationStatus: "filtered",
      transactions: [],
      stepCount: 0,
    });
    expect(records?.[1]?.inspection?.provenance.filters).toMatchObject([
      { transactionId: 0, outcome: "rejected" },
    ]);
  });

  it("publishes nested dispatches synchronously in invocation order with causal parent IDs", () => {
    let nested = false;
    const store = createProseMirrorDevtoolsStore();
    const session = createProseMirrorDevtoolsSession({
      id: "editor",
      store,
      performanceMarks: false,
    });
    const view = editor(session, [
      new Plugin({
        view() {
          return {
            update(nextView) {
              if (nested || nextView.state.doc.textContent !== "o") return;
              nested = true;
              nextView.dispatch(appendTextTransaction(nextView.state, "i"));
            },
          };
        },
      }),
    ]);
    const publications: number[][] = [];
    store.subscribeDispatch((events) => {
      expect(view.state.doc.textContent).toBe("oi");
      publications.push(events.map((event) => event.record.id));
    });
    view.dispatch(appendTextTransaction(view.state, "o"));
    expect(publications).toEqual([[1, 2]]);
    expect(
      store
        .getInstance("editor")
        ?.transactions.map((record) => [record.id, record.inspection?.parentDispatchId]),
    ).toEqual([
      [1, null],
      [2, 1],
    ]);
  });

  it("retains selected plugin projections before a mutable plugin changes its state", () => {
    const plugin = new Plugin({
      key: new PluginKey("counter"),
      state: {
        init: () => ({ count: 0 }),
        apply(_transaction, value) {
          value.count += 1;
          return value;
        },
      },
    });
    const inspector = createPluginStateInspector({
      id: "counter",
      plugin,
      serialize: (value) => ({ count: value.count }),
    });
    const store = createProseMirrorDevtoolsStore();
    const session = createProseMirrorDevtoolsSession({
      id: "editor",
      store,
      inspectors: [inspector],
      performanceMarks: false,
    });
    const view = editor(session, [plugin]);
    view.dispatch(view.state.tr);
    view.dispatch(view.state.tr);
    expect(store.getInstance("editor")?.transactions[0]?.inspection?.projections).toEqual([
      {
        id: "counter",
        version: "1",
        evidence: {
          kind: "available",
          value: {
            before: { kind: "available", value: { count: 0 } },
            after: { kind: "available", value: { count: 1 } },
            changed: true,
            scope: "synchronous-dispatch",
            externalMutations: "unobserved",
          },
        },
      },
    ]);
    expect(plugin.getState(view.state)?.count).toBe(2);
  });

  it("advances state and dispatch identities through pause and preserves explicit gaps", () => {
    const store = createProseMirrorDevtoolsStore();
    const session = createProseMirrorDevtoolsSession({
      id: "editor",
      store,
      diagnostics: true,
      captureProfile: createBoundedCaptureProfile({ transactions: 1 }),
      performanceMarks: false,
    });
    const view = editor(session);
    view.dispatch(appendTextTransaction(view.state, "a"));
    session.pauseCapture();
    session.diagnostics?.traceCommand("unrecorded", () =>
      view.dispatch(appendTextTransaction(view.state, "b")),
    );
    expect(view.state.doc.textContent).toBe("ab");
    expect(store.getInstance("editor")?.dispatchCount).toBe(2);
    expect(store.getInstance("editor")?.inspection?.capture).toMatchObject({
      kind: "paused",
      gaps: [{ reason: "paused", firstDispatchId: 2, lastDispatchId: 2 }],
    });
    expect(session.diagnostics?.getSnapshot().events).toEqual([]);
    session.resumeCapture();
    view.dispatch(appendTextTransaction(view.state, "c"));
    const instance = store.getInstance("editor");
    expect(instance?.transactions.map((record) => record.id)).toEqual([3]);
    expect(instance?.inspection?.capture.gaps).toMatchObject([
      { reason: "evicted", firstDispatchId: 1, lastDispatchId: 1 },
      { reason: "paused", firstDispatchId: 2, lastDispatchId: 2 },
    ]);
    expect(instance?.inspection?.capture.gaps[1]?.stateBeforeId).not.toBe(
      instance?.inspection?.capture.gaps[1]?.stateAfterId,
    );
  });

  it("preserves an explicit diagnostics limit when the bounded profile is not requested", () => {
    const store = createProseMirrorDevtoolsStore();
    const session = createProseMirrorDevtoolsSession({
      id: "editor",
      store,
      diagnostics: { limit: 500 },
    });
    editor(session);
    for (let index = 0; index < 205; index += 1)
      session.diagnostics?.traceCommand(String(index), () => true);
    expect(session.diagnostics?.getSnapshot().events).toHaveLength(205);
    expect(store.getInstance("editor")?.inspection?.capture.profile.budgets.events).toBe(500);
  });

  it("records authoritative controlled state without forcing an EditorView update", () => {
    const store = createProseMirrorDevtoolsStore();
    const session = createProseMirrorDevtoolsSession({
      id: "controlled",
      store,
      performanceMarks: false,
    });
    const view = createTestView(createTestState());
    cleanups.push(
      () => view.destroy(),
      () => session.dispose(),
    );
    const initialState = view.state;
    let modelState = initialState;
    const recorder = session.createDispatchRecorder(view, { getState: () => modelState });
    const transaction = appendTextTransaction(modelState, "x");
    recorder.record(transaction, () => {
      modelState = modelState.apply(transaction);
    });
    expect(view.state).toBe(initialState);
    expect(store.getInstance("controlled")?.inspection?.getState()).toBe(modelState);
    expect(store.getInstance("controlled")?.transactions[0]).toMatchObject({
      applicationStatus: "applied",
      docAfter: { content: [{ content: [{ text: "x" }] }] },
    });
  });

  it("prevents a second capture path and releases middleware ownership on disposal", () => {
    const store = createProseMirrorDevtoolsStore();
    const session = createProseMirrorDevtoolsSession({ id: "editor", store });
    const view = createTestView(createTestState());
    cleanups.push(
      () => view.destroy(),
      () => session.dispose(),
    );
    session.createDispatchRecorder(view);
    expect(() =>
      attachProseMirrorDevtools({ id: "editor", view, store, sessionId: session.sessionId }),
    ).toThrow("capture path");
    session.dispose();
    const attachment = attachProseMirrorDevtools({ id: "editor", view, store });
    cleanups.push(() => attachment.detach());
    view.dispatch(view.state.tr);
    expect(store.getInstance("editor")?.transactions).toHaveLength(1);
  });

  it("preserves the application error when optional serializers fail", () => {
    const store = createProseMirrorDevtoolsStore();
    const applicationError = new Error("application failure");
    const session = createProseMirrorDevtoolsSession({
      id: "editor",
      store,
      performanceMarks: false,
      inspectors: [
        {
          descriptor: {
            id: "broken",
            version: "1",
            label: "Broken",
            description: "Throws",
            prerequisites: [],
          },
          read() {
            throw new Error("read failed");
          },
          capture() {
            throw new Error("serializer failed");
          },
        },
      ],
    });
    const view = editor(session, [
      new Plugin({
        filterTransaction() {
          throw applicationError;
        },
      }),
    ]);
    expect(() => view.dispatch(appendTextTransaction(view.state, "x"))).toThrow(applicationError);
    const record = store.getInstance("editor")?.transactions[0];
    expect(record?.error).toBe("Error: application failure");
    expect(record?.inspection?.projections[0]?.evidence).toEqual({
      kind: "error",
      reason: "Error: serializer failed",
    });
    expect(record?.inspection?.provenance.filters).toMatchObject([
      { outcome: "error", error: "Error: application failure" },
    ]);
  });

  it("does not allow step serialization to break a successful application dispatch", () => {
    const store = createProseMirrorDevtoolsStore();
    const session = createProseMirrorDevtoolsSession({
      id: "editor",
      store,
      performanceMarks: false,
    });
    const view = editor(session);
    const transaction = appendTextTransaction(view.state, "x");
    const step = transaction.steps[0];
    if (!step) throw new Error("The test transaction must contain a real ProseMirror step.");
    vi.spyOn(step, "toJSON").mockImplementation(() => {
      throw new Error("step serialization failed");
    });
    expect(() => view.dispatch(transaction)).not.toThrow();
    expect(view.state.doc.textContent).toBe("x");
    expect(store.getInstance("editor")?.transactions[0]?.captureErrors).toEqual([
      "Error: step serialization failed",
    ]);
  });
});
