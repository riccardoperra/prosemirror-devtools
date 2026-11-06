import { Node as ProseMirrorNode } from "prosemirror-model";
import { EditorState, Plugin, PluginKey } from "prosemirror-state";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPluginStateInspector,
  createProseMirrorInspectionClient,
  createProseMirrorDevtoolsSession,
  createProseMirrorDevtoolsStore,
  type CreateProseMirrorDevtoolsSessionOptions,
  type InspectionEvidence,
} from "../src/core";
import { appendTextTransaction, createTestState, createTestView } from "./helpers";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function available<T>(evidence: InspectionEvidence<T>): T {
  if (evidence.kind !== "available") throw new Error(`${evidence.kind}: ${evidence.reason}`);
  return evidence.value;
}

function setup(
  options: Omit<CreateProseMirrorDevtoolsSessionOptions, "id" | "store"> = {},
  plugins: readonly Plugin[] = [],
) {
  const store = createProseMirrorDevtoolsStore();
  const session = createProseMirrorDevtoolsSession({
    id: "editor",
    store,
    performanceMarks: false,
    ...options,
  });
  const view = createTestView(createTestState("hello", session.instrumentPlugins(plugins)));
  session.attach(view);
  cleanups.push(
    () => view.destroy(),
    () => session.dispose(),
  );
  const client = createProseMirrorInspectionClient({ store });
  const target = client.listEditors()[0]?.target;
  if (!target) throw new Error("The real editor must be discoverable.");
  return { store, session, view, client, target };
}

describe("serializable inspection client", () => {
  it("pins related reads and expires a live point when the state advances", () => {
    const { view, client, target } = setup();
    const point = available(client.pin({ target }));
    expect(available(client.read({ point, query: { kind: "document" } }))).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
    });
    expect(available(client.read({ point, query: { kind: "selection" } }))).toMatchObject({
      type: "text",
      from: 1,
      to: 1,
      empty: true,
    });
    view.dispatch(appendTextTransaction(view.state, "!"));
    expect(client.read({ point, query: { kind: "document" } }).kind).toBe("expired");
    expect(
      client.query({
        target,
        query: { kind: "document" },
        at: { kind: "transaction", id: 1, phase: "before" },
      }),
    ).toMatchObject({ kind: "available", value: { content: [{ content: [{ text: "hello" }] }] } });
  });

  it("invalidates remounted targets even when the caller reuses a session ID", () => {
    const { store, session, view, client, target } = setup({ sessionId: "reused" });
    const firstPoint = available(client.pin({ target }));
    session.dispose();
    const replacement = createProseMirrorDevtoolsSession({
      id: "editor",
      sessionId: "reused",
      store,
      performanceMarks: false,
    });
    replacement.attach(view);
    cleanups.push(() => replacement.dispose());
    const current = client.listEditors()[0]?.target;
    expect(current?.generation).not.toBe(target.generation);
    expect(client.pin({ target }).kind).toBe("expired");
    expect(client.read({ point: firstPoint, query: { kind: "selection" } }).kind).toBe("expired");
    expect(client.pin({ target: { ...target, sourceId: "another-source" } }).kind).toBe(
      "unsupported",
    );
  });

  it("reads historical provider evidence without substituting current plugin state", () => {
    const plugin = new Plugin({
      key: new PluginKey("counter"),
      state: { init: () => 0, apply: (_transaction, value) => value + 1 },
    });
    const inspector = createPluginStateInspector({
      id: "counter",
      plugin,
      serialize: (value) => ({ count: value }),
    });
    const { view, client, target } = setup({ inspectors: [inspector] }, [plugin]);
    view.dispatch(view.state.tr);
    view.dispatch(view.state.tr);
    const historical = client.query({
      target,
      at: { kind: "transaction", id: 1 },
      query: { kind: "contribution", id: "counter" },
    });
    expect(historical).toMatchObject({
      kind: "available",
      value: { before: { value: { count: 0 } }, after: { value: { count: 1 } }, changed: true },
    });
    expect(client.query({ target, query: { kind: "contribution", id: "counter" } })).toMatchObject({
      kind: "available",
      value: { count: 2 },
    });
    expect(
      client.query({ target, at: { kind: "transaction", id: 1 }, query: { kind: "plugins" } }).kind,
    ).toBe("unobserved");
    expect(
      client.query({
        target,
        at: { kind: "transaction", id: 1, phase: "before" },
        query: { kind: "contribution", id: "counter" },
      }).kind,
    ).toBe("unobserved");
  });

  it("distinguishes disabled, unobserved, expired, and paused capture from current state", () => {
    const { view, client, session, target } = setup({ transactionLimit: 1 });
    expect(client.query({ target, query: { kind: "events" } }).kind).toBe("disabled");
    expect(client.query({ target, query: { kind: "transaction", id: 1 } }).kind).toBe("unobserved");
    view.dispatch(appendTextTransaction(view.state, "a"));
    session.pauseCapture();
    view.dispatch(appendTextTransaction(view.state, "b"));
    expect(client.query({ target, query: { kind: "document" } })).toMatchObject({
      kind: "available",
      value: { content: [{ content: [{ text: "helloab" }] }] },
    });
    expect(client.query({ target, query: { kind: "transaction", id: 2 } })).toMatchObject({
      kind: "unobserved",
      coverage: { gaps: [{ reason: "paused", firstDispatchId: 2, lastDispatchId: 2 }] },
    });
    session.resumeCapture();
    view.dispatch(appendTextTransaction(view.state, "c"));
    expect(
      client.query({ target, at: { kind: "transaction", id: 1 }, query: { kind: "document" } })
        .kind,
    ).toBe("expired");
    expect(client.query({ target, query: { kind: "transactions" } })).toMatchObject({
      kind: "available",
      value: [{ id: 3 }],
      coverage: { complete: false },
    });
  });

  it("shares one traversal budget across all nodes in a document range", () => {
    const { view, client, target } = setup();
    const schema = view.state.schema;
    const doc = schema.node(
      "doc",
      null,
      Array.from({ length: 1000 }, () => schema.node("paragraph", null, schema.text("a"))),
    );
    view.updateState(EditorState.create({ schema, doc }));
    const traversal = vi.spyOn(ProseMirrorNode.prototype, "forEach");
    const result = client.query({
      target,
      query: { kind: "document", from: 0, to: doc.content.size },
      limits: { maxNodes: 10 },
    });
    expect(result.kind).toBe("error");
    expect(traversal.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it("bounds document work and supports retained historical ranges without an EditorState", () => {
    const { view, client, target } = setup();
    view.dispatch(appendTextTransaction(view.state, " world"));
    const limits = { maxStringLength: 10 };
    expect(client.query({ target, query: { kind: "document" }, limits }).kind).toBe("error");
    expect(
      client.query({
        target,
        at: { kind: "transaction", id: 1 },
        query: { kind: "document", from: 1, to: 4 },
        limits,
      }),
    ).toMatchObject({
      kind: "available",
      value: { kind: "slice", content: [{ type: "text", text: "hel" }] },
    });
    expect(client.query({ target, query: { kind: "document", from: -1 } }).kind).toBe("error");
    expect(
      client.query({ target, query: { kind: "transactions" }, limits: { maxItems: 1 } }),
    ).toMatchObject({ kind: "available", value: [{ id: 1 }] });
  });

  it.each([0, 1])(
    "keeps an unavailable plugin boundary %i distinct from a failed value",
    (failedValue) => {
      const plugin = new Plugin({
        state: { init: () => 0, apply: (_transaction, value) => value + 1 },
      });
      const inspector = createPluginStateInspector({
        id: "opaque-boundary",
        plugin,
        serialize: (value) =>
          value === failedValue ? new Map([["count", value]]) : { count: value },
      });
      const { view, client, target } = setup({ inspectors: [inspector] }, [plugin]);
      view.dispatch(view.state.tr);
      expect(
        client.query({
          target,
          at: { kind: "transaction", id: 1 },
          query: { kind: "contribution", id: "opaque-boundary" },
        }),
      ).toMatchObject({ kind: "error", coverage: { complete: false } });
      expect(
        client.query({
          target,
          at: { kind: "transaction", id: 1 },
          query: { kind: "contributions" },
        }),
      ).toMatchObject({ kind: "available", coverage: { complete: false } });
    },
  );

  it("returns bounded serialization errors without invoking application getters", () => {
    let getterCalls = 0;
    const payload = Object.defineProperty({}, "danger", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return document.body;
      },
    });
    const { client, target, view } = setup({
      inspectors: [
        {
          descriptor: {
            id: "unsafe",
            version: "1",
            label: "Unsafe",
            description: "Opaque payload",
            prerequisites: [],
          },
          read: () => ({ kind: "available", value: payload }),
          capture: () => ({ kind: "available", value: payload }),
        },
      ],
    });
    view.dispatch(view.state.tr);
    expect(client.query({ target, query: { kind: "contribution", id: "unsafe" } }).kind).toBe(
      "error",
    );
    expect(
      client.query({
        target,
        at: { kind: "transaction", id: 1 },
        query: { kind: "contribution", id: "unsafe" },
      }).kind,
    ).toBe("error");
    expect(getterCalls).toBe(0);
    expect(() =>
      JSON.stringify(client.query({ target, query: { kind: "transaction", id: 1 } })),
    ).not.toThrow();
  });

  it("uses explicit targets independently of the active panel editor and publishes subscriptions", () => {
    const { store, view, client, target } = setup({ diagnostics: true });
    const otherView = createTestView(createTestState("other"));
    const otherSession = createProseMirrorDevtoolsSession({
      id: "other",
      store,
      performanceMarks: false,
    });
    otherSession.attach(otherView);
    cleanups.push(
      () => otherView.destroy(),
      () => otherSession.dispose(),
    );
    const listener = vi.fn();
    const unsubscribe = client.subscribe({ target }, listener);
    store.setActiveInstance("other");
    expect(available(client.query({ target, query: { kind: "document" } }))).toMatchObject({
      content: [{ content: [{ text: "hello" }] }],
    });
    expect(listener).not.toHaveBeenCalled();
    view.dispatch(view.state.tr);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    view.dispatch(view.state.tr);
    expect(listener).not.toHaveBeenCalled();
    expect(client.catalog().queries.map((query) => query.kind)).toEqual(
      expect.arrayContaining(["events", "plugins", "contribution"]),
    );
  });

  it("publishes diagnostics through the committed core boundary, including events without dispatch", () => {
    const { store, session, view, client, target } = setup({ diagnostics: true });
    const observedIds: number[][] = [];
    client.subscribe({ target }, () => {
      observedIds.push(store.getInstance("editor")?.transactions.map((record) => record.id) ?? []);
    });
    session.diagnostics?.traceCommand("write", () => view.dispatch(view.state.tr));
    expect(observedIds).toEqual([[1], [1]]);
    observedIds.length = 0;
    session.diagnostics?.traceCommand("without-dispatch", () => false);
    expect(observedIds).toEqual([[1]]);
    expect(
      client.query({ target, query: { kind: "events", name: "without-dispatch" } }),
    ).toMatchObject({
      kind: "available",
      value: [{ name: "without-dispatch", handled: false, dispatches: [] }],
    });
  });

  it("declares every nested detail and schema list truncation in its coverage", () => {
    const { store, view, client, target } = setup();
    const transaction = view.state.tr.insertText("a").insertText("b").insertText("c");
    const measurement = store.beginTransaction("editor", transaction, view.state, false);
    const applied = view.state.applyTransaction(transaction);
    view.updateState(applied.state);
    store.finishTransaction(measurement, {
      stateAfter: applied.state,
      appliedTransactions: applied.transactions,
    });
    const detail = client.query({
      target,
      query: { kind: "transaction", id: 1 },
      limits: { maxItems: 1 },
    });
    expect(detail).toMatchObject({
      kind: "available",
      value: { transactions: [{ steps: [expect.any(Object)], maps: [expect.any(Object)] }] },
      coverage: { truncated: true, complete: false },
    });
    expect(
      client.query({ target, query: { kind: "schema" }, limits: { maxItems: 1 } }),
    ).toMatchObject({ kind: "available", coverage: { truncated: true, complete: false } });
    expect(
      client.query({
        target,
        at: { kind: "transaction", id: 1, phase: "before" },
        query: { kind: "transactions" },
      }),
    ).toMatchObject({ kind: "available", value: [] });
    expect(
      client.query({
        target,
        at: { kind: "transaction", id: 1, phase: "before" },
        query: { kind: "transaction", id: 1 },
      }).kind,
    ).toBe("unobserved");
  });

  it("declares evicted and cleared diagnostic evidence instead of treating absence as a negative", () => {
    const { session, client, target } = setup({ diagnostics: { limit: 2 } });
    for (const name of ["first", "second", "third"])
      session.diagnostics?.traceCommand(name, () => false);
    const retained = client.query({ target, query: { kind: "events", afterId: 0 } });
    expect(retained).toMatchObject({
      kind: "available",
      value: [{ id: 2 }, { id: 3 }],
      coverage: { complete: false },
    });
    expect(retained.coverage.notes.join(" ")).toContain(
      "1 event observations were evicted or cleared",
    );
    session.diagnostics?.clearEvents();
    expect(client.query({ target, query: { kind: "events" } })).toMatchObject({
      kind: "expired",
      coverage: { complete: false },
    });
  });

  it("expires retained points after eviction and after an explicit history clear", () => {
    const { session, store, view, client, target } = setup({ transactionLimit: 1 });
    view.dispatch(view.state.tr);
    const first = available(client.pin({ target, at: { kind: "transaction", id: 1 } }));
    view.dispatch(view.state.tr);
    expect(client.read({ point: first, query: { kind: "selection" } }).kind).toBe("expired");
    const second = available(client.pin({ target, at: { kind: "transaction", id: 2 } }));
    store.clearTransactions(session.id);
    expect(client.read({ point: second, query: { kind: "document" } }).kind).toBe("expired");
    expect(client.query({ target, query: { kind: "transactions" } })).toMatchObject({
      kind: "available",
      value: [],
      coverage: { complete: false, gaps: [{ reason: "evicted" }, { reason: "cleared" }] },
    });
  });
});
