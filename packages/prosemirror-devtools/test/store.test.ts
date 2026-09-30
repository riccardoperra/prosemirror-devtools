import type { EditorView } from "prosemirror-view";
import { describe, expect, it, vi } from "vitest";

import {
  markProseMirrorDevtools,
  measureProseMirrorDevtools,
  createProseMirrorDevtoolsStore,
} from "../src/core";
import { appendTextTransaction, createTestState } from "./helpers";

function viewForState(state = createTestState()): EditorView {
  return { state } as EditorView;
}

describe("createProseMirrorDevtoolsStore", () => {
  it("switches between registered instances and selects a fallback when active one unregisters", () => {
    const store = createProseMirrorDevtoolsStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const firstView = viewForState();
    const secondView = viewForState();

    const unregisterFirst = store.register({
      id: "first",
      label: "First editor",
      view: firstView,
    });
    const unregisterSecond = store.register({
      id: "second",
      label: "Second editor",
      view: secondView,
    });

    expect(store.getSnapshot()).toMatchObject({
      activeInstanceId: "first",
      instances: [
        { id: "first", label: "First editor", transactionLimit: null, view: firstView },
        { id: "second", label: "Second editor", transactionLimit: null, view: secondView },
      ],
    });

    store.setActiveInstance("second");
    expect(store.getSnapshot().activeInstanceId).toBe("second");

    unregisterSecond();
    expect(store.getSnapshot()).toMatchObject({
      activeInstanceId: "first",
      instances: [{ id: "first" }],
    });

    unregisterSecond();
    expect(listener).toHaveBeenCalledTimes(4);
    expect(() => store.setActiveInstance("missing")).toThrow(
      'Cannot activate unknown ProseMirror editor "missing".',
    );

    unregisterFirst();
    expect(store.getSnapshot()).toMatchObject({
      activeInstanceId: null,
      instances: [],
    });

    unsubscribe();
    store.register({ id: "third", view: viewForState() });
    expect(listener).toHaveBeenCalledTimes(5);
  });

  it("ignores unregister requests for a different view and rejects duplicate ids", () => {
    const store = createProseMirrorDevtoolsStore();
    const registeredView = viewForState();
    const otherView = viewForState();

    store.register({ id: "editor", view: registeredView });
    store.unregister("editor", otherView);

    expect(store.getSnapshot().instances).toHaveLength(1);
    expect(() => store.register({ id: "editor", view: otherView })).toThrow(
      'A ProseMirror editor with id "editor" is already registered.',
    );
  });

  it("treats repeated same-view registrations as independent leases", () => {
    const store = createProseMirrorDevtoolsStore();
    const view = viewForState();
    const releaseFirst = store.register({ id: "editor", view });
    const releaseSecond = store.register({ id: "editor", view });

    releaseFirst();
    expect(store.getInstance("editor")?.view).toBe(view);
    releaseFirst();
    expect(store.getInstance("editor")?.view).toBe(view);

    releaseSecond();
    expect(store.getInstance("editor")).toBeUndefined();
  });

  it("does not release a replacement registration through an older lease for the same view", () => {
    const store = createProseMirrorDevtoolsStore();
    const view = viewForState();
    const releaseOld = store.register({ id: "editor", view });
    store.unregister("editor");
    const releaseCurrent = store.register({ id: "editor", view });

    releaseOld();
    expect(store.getInstance("editor")?.view).toBe(view);

    releaseCurrent();
    expect(store.getInstance("editor")).toBeUndefined();
  });

  it("clamps a negative transaction limit when the same view is registered again", () => {
    const store = createProseMirrorDevtoolsStore();
    let state = createTestState();
    const view = viewForState(state);

    store.register({ id: "editor", view, transactionLimit: 3 });
    store.register({ id: "editor", view, transactionLimit: -10 });

    expect(store.getSnapshot().instances[0]?.transactionLimit).toBe(1);

    for (const text of ["a", "b"]) {
      const transaction = appendTextTransaction(state, text);
      const measurement = store.beginTransaction("editor", transaction, state, false);
      const applied = state.applyTransaction(transaction);

      expect(() =>
        store.finishTransaction(measurement, {
          stateAfter: applied.state,
          appliedTransactions: applied.transactions,
        }),
      ).not.toThrow();

      state = applied.state;
      (view as { state: typeof state }).state = state;
    }

    expect(store.getSnapshot().instances[0]?.transactions).toHaveLength(1);
    expect(store.getSnapshot().instances[0]?.transactions[0]?.docAfter).toMatchObject({
      content: [{ content: [{ text: "ab" }] }],
    });
  });

  it("keeps only the configured number of transaction records and clears profiling data", () => {
    const store = createProseMirrorDevtoolsStore();
    let state = createTestState();
    const view = viewForState(state);
    store.register({ id: "editor", view, transactionLimit: 2 });

    for (const text of ["a", "b", "c"]) {
      const transaction = appendTextTransaction(state, text);
      const measurement = store.beginTransaction("editor", transaction, state, false);
      store.measurePluginHook(
        "editor",
        "slow-plugin$",
        "Slow plugin",
        "state.apply",
        () => undefined,
      );
      store.recordPhase(measurement, "apply", 2);
      store.recordPhase(measurement, "viewUpdate", 3);

      const applied = state.applyTransaction(transaction);
      const record = store.finishTransaction(measurement, {
        stateAfter: applied.state,
        appliedTransactions: applied.transactions,
      });
      state = applied.state;
      (view as { state: typeof state }).state = state;

      expect(record).toMatchObject({
        instanceId: "editor",
        applyDuration: 2,
        viewUpdateDuration: 3,
        customDispatchDuration: null,
        appliedTransactionCount: 1,
        appendedTransactionCount: 0,
        docChanged: true,
        stepCount: 1,
      });
    }

    const instance = store.getSnapshot().instances[0];
    expect(instance?.dispatchCount).toBe(3);
    expect(instance?.transactions.map((record) => record.id)).toEqual([2, 3]);
    expect(instance?.transactions.at(-1)?.docAfter).toMatchObject({
      content: [{ content: [{ text: "abc" }] }],
    });
    expect(instance?.pluginTimings).toEqual([
      expect.objectContaining({
        pluginKey: "slow-plugin$",
        hook: "state.apply",
        count: 3,
      }),
    ]);

    store.clearTransactions("editor");
    expect(store.getSnapshot().instances[0]).toMatchObject({
      dispatchCount: 3,
      transactions: [],
      pluginTimings: [],
    });
  });

  it("keeps unscoped timings separate from a literal star session id", () => {
    const store = createProseMirrorDevtoolsStore();
    store.measurePluginHook("editor", "unscoped$", "Unscoped", "state.init", () => undefined);
    store.measurePluginHook("editor", "scoped$", "Scoped", "state.init", () => undefined, "*");
    store.register({ id: "editor", sessionId: "*", view: viewForState() });

    expect(store.getInstance("editor")?.pluginTimings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pluginKey: "unscoped$", count: 1 }),
        expect.objectContaining({ pluginKey: "scoped$", count: 1 }),
      ]),
    );
  });

  it("buffers startup hooks only before an instance registers", () => {
    const store = createProseMirrorDevtoolsStore();
    store.measurePluginHook("editor", "startup$", "Startup", "state.init", () => undefined);
    store.measurePluginHook("editor", "runtime$", "Runtime", "state.apply", () => undefined);
    store.register({ id: "editor", view: viewForState() });

    expect(store.getInstance("editor")?.pluginTimings).toEqual([
      expect.objectContaining({ pluginKey: "startup$", hook: "state.init", count: 1 }),
    ]);
  });

  it("notifies only the subscriptions affected by a store update", () => {
    const store = createProseMirrorDevtoolsStore();
    let firstState = createTestState();
    const firstView = viewForState(firstState);
    const secondView = viewForState();
    store.register({ id: "first", view: firstView });
    store.register({ id: "second", view: secondView });

    const all = vi.fn();
    const active = vi.fn();
    const descriptors = vi.fn();
    const first = vi.fn();
    const second = vi.fn();
    store.subscribe(all);
    store.subscribeActiveInstance(active);
    store.subscribeInstanceDescriptors(descriptors);
    store.subscribeInstance("first", first);
    store.subscribeInstance("second", second);

    const transaction = appendTextTransaction(firstState, "x");
    const measurement = store.beginTransaction("first", transaction, firstState, false);
    const applied = firstState.applyTransaction(transaction);
    store.finishTransaction(measurement, {
      stateAfter: applied.state,
      appliedTransactions: applied.transactions,
    });
    firstState = applied.state;
    (firstView as { state: typeof firstState }).state = firstState;
    expect(all).toHaveBeenCalledOnce();
    expect(first).toHaveBeenCalledOnce();
    expect(active).not.toHaveBeenCalled();
    expect(descriptors).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    store.setActiveInstance("second");
    expect(all).toHaveBeenCalledTimes(2);
    expect(active).toHaveBeenCalledOnce();
    expect(first).toHaveBeenCalledOnce();
    expect(descriptors).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });

  it("publishes nested transaction signals and events at the outermost boundary", () => {
    const store = createProseMirrorDevtoolsStore();
    const state = createTestState();
    const view = viewForState(state);
    store.register({ id: "editor", view });
    const storeListener = vi.fn();
    const instanceListener = vi.fn();
    const dispatchListener = vi.fn();
    store.subscribe(storeListener);
    store.subscribeInstance("editor", instanceListener);
    store.subscribeDispatch(dispatchListener);

    const outerTransaction = appendTextTransaction(state, "o");
    const innerTransaction = appendTextTransaction(state, "i");
    const outer = store.beginTransaction("editor", outerTransaction, state, false);
    const inner = store.beginTransaction("editor", innerTransaction, state, false);
    const innerApplied = state.applyTransaction(innerTransaction);

    store.finishTransaction(inner, {
      stateAfter: innerApplied.state,
      appliedTransactions: innerApplied.transactions,
    });

    expect(store.getInstance("editor")?.transactions.map(({ id }) => id)).toEqual([2]);
    expect(storeListener).not.toHaveBeenCalled();
    expect(instanceListener).not.toHaveBeenCalled();
    expect(dispatchListener).not.toHaveBeenCalled();

    const outerApplied = state.applyTransaction(outerTransaction);
    store.finishTransaction(outer, {
      stateAfter: outerApplied.state,
      appliedTransactions: outerApplied.transactions,
    });

    expect(store.getInstance("editor")?.transactions.map(({ id }) => id)).toEqual([1, 2]);
    expect(storeListener).toHaveBeenCalledOnce();
    expect(instanceListener).toHaveBeenCalledOnce();
    expect(dispatchListener).toHaveBeenCalledOnce();
    expect(
      dispatchListener.mock.calls[0]?.[0].map(
        ({ record }: { record: { id: number } }) => record.id,
      ),
    ).toEqual([1, 2]);
  });

  it("does not deliver the current dispatch to subscriptions added during delivery", () => {
    const store = createProseMirrorDevtoolsStore();
    const state = createTestState();
    store.register({ id: "editor", view: viewForState(state) });
    const replacement = vi.fn();
    const unsubscribe = store.subscribeDispatch(() => {
      unsubscribe();
      store.subscribeDispatch(replacement);
    });

    const record = () => {
      const measurement = store.beginTransaction("editor", state.tr, state, false);
      store.finishTransaction(measurement, { stateAfter: state });
    };
    record();
    expect(replacement).not.toHaveBeenCalled();
    record();
    expect(replacement).toHaveBeenCalledOnce();
  });

  it("keeps history unbounded and publishes every completed outer dispatch", () => {
    const store = createProseMirrorDevtoolsStore();
    let state = createTestState();
    const view = viewForState(state);
    store.register({ id: "editor", view });
    const storeListener = vi.fn();
    const instanceListener = vi.fn();
    const dispatchListener = vi.fn();
    store.subscribe(storeListener);
    store.subscribeInstance("editor", instanceListener);
    store.subscribeDispatch(dispatchListener);

    for (const text of ["a", "b", "c"]) {
      const beforeState = state;
      const transaction = appendTextTransaction(state, text);
      const measurement = store.beginTransaction("editor", transaction, state, false);
      const applied = state.applyTransaction(transaction);
      state = applied.state;
      (view as { state: typeof state }).state = state;
      store.finishTransaction(measurement, {
        stateAfter: state,
        appliedTransactions: applied.transactions,
      });
      expect(measurement.beforeState).toBe(beforeState);
    }

    expect(store.getInstance("editor")?.transactions.map(({ id }) => id)).toEqual([1, 2, 3]);
    expect(store.getInstance("editor")?.transactionLimit).toBeNull();
    expect(storeListener).toHaveBeenCalledTimes(3);
    expect(instanceListener).toHaveBeenCalledTimes(3);
    expect(dispatchListener).toHaveBeenCalledTimes(3);
    const events = dispatchListener.mock.calls.flatMap(([batch]) => batch);
    expect(events.map(({ record }) => record.id)).toEqual([1, 2, 3]);
    expect(events[0]).toMatchObject({
      instanceId: "editor",
      beforeState: expect.any(Object),
      stateAfter: expect.any(Object),
      transaction: expect.any(Object),
    });
    expect(store.getSnapshot().instances[0]?.transactions).toHaveLength(3);
  });

  it("serializes documents lazily and caches the result", () => {
    const store = createProseMirrorDevtoolsStore();
    const state = createTestState();
    const view = viewForState(state);
    store.register({ id: "editor", view });
    const transaction = appendTextTransaction(state, "x");
    const applied = state.applyTransaction(transaction);
    const beforeToJSON = vi.spyOn(state.doc, "toJSON");
    const afterToJSON = vi.spyOn(applied.state.doc, "toJSON");
    const measurement = store.beginTransaction("editor", transaction, state, false);

    const record = store.finishTransaction(measurement, {
      stateAfter: applied.state,
      appliedTransactions: applied.transactions,
    });

    expect(record?.docChanged).toBe(true);
    expect(record?.stepCount).toBe(1);
    expect(beforeToJSON).not.toHaveBeenCalled();
    expect(afterToJSON).not.toHaveBeenCalled();

    expect(record?.docAfter).toMatchObject({
      content: [{ content: [{ text: "x" }] }],
    });
    expect(beforeToJSON).toHaveBeenCalledOnce();
    expect(afterToJSON).toHaveBeenCalledOnce();

    void record?.docBefore;
    void record?.transactions;
    void record?.selectionAfter;
    expect(beforeToJSON).toHaveBeenCalledOnce();
    expect(afterToJSON).toHaveBeenCalledOnce();
    expect(Object.keys(record ?? {})).toEqual(expect.arrayContaining(["docBefore", "docAfter"]));
  });

  it("serializes an unchanged document only once", () => {
    const store = createProseMirrorDevtoolsStore();
    const state = createTestState();
    const view = viewForState(state);
    store.register({ id: "editor", view });
    const transaction = state.tr;
    const applied = state.applyTransaction(transaction);
    const toJSON = vi.spyOn(state.doc, "toJSON");
    const measurement = store.beginTransaction("editor", transaction, state, false);

    const record = store.finishTransaction(measurement, {
      stateAfter: applied.state,
      appliedTransactions: applied.transactions,
    });

    expect(toJSON).not.toHaveBeenCalled();
    expect(record?.docBefore).toBe(record?.docAfter);
    expect(toJSON).toHaveBeenCalledOnce();
  });

  it("keeps ProseMirror step JSON lossless", () => {
    const store = createProseMirrorDevtoolsStore();
    const state = createTestState();
    const view = viewForState(state);
    store.register({ id: "editor", view });
    const text = "x".repeat(20_001);
    const transaction = appendTextTransaction(state, text);
    const applied = state.applyTransaction(transaction);
    const measurement = store.beginTransaction("editor", transaction, state, false);

    const record = store.finishTransaction(measurement, {
      stateAfter: applied.state,
      appliedTransactions: applied.transactions,
    });

    expect(record?.transactions[0]?.steps[0]).toMatchObject({
      slice: { content: [{ text }] },
    });
  });

  it("keeps transaction metadata as provided", () => {
    const store = createProseMirrorDevtoolsStore();
    const state = createTestState();
    const view = viewForState(state);
    store.register({ id: "editor", view });
    const metadata = { source: "test" };
    const transaction = state.tr.setMeta("payload", metadata);
    const applied = state.applyTransaction(transaction);
    const measurement = store.beginTransaction("editor", transaction, state, false);

    const record = store.finishTransaction(measurement, {
      stateAfter: applied.state,
      appliedTransactions: applied.transactions,
    });

    expect(record?.transactions[0]?.meta.payload).toBe(metadata);
  });

  it("records point markers and measured custom spans on the active dispatch", () => {
    let clock = 100;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const store = createProseMirrorDevtoolsStore();
    const state = createTestState();
    const view = viewForState(state);
    store.register({ id: "editor", view });

    expect(markProseMirrorDevtools("editor", "outside", { store })).toBe(false);
    const outsideRun = vi.fn(() => undefined);
    expect(measureProseMirrorDevtools("editor", "outside span", outsideRun, { store })).toBe(
      undefined,
    );
    expect(outsideRun).toHaveBeenCalledOnce();
    const transaction = appendTextTransaction(state, "x");
    const measurement = store.beginTransaction("editor", transaction, state, false);
    clock += 2;
    expect(
      markProseMirrorDevtools("editor", "remote steps received", {
        category: "collaboration",
        tone: "info",
        data: { count: 3 },
        store,
      }),
    ).toBe(true);
    const result = measureProseMirrorDevtools(
      "editor",
      "rebase",
      () => {
        clock += 5;
        return "rebased";
      },
      { category: "collaboration", tone: "warning", store },
    );
    expect(result).toBe("rebased");

    const applied = state.applyTransaction(transaction);
    const record = store.finishTransaction(measurement, {
      stateAfter: applied.state,
      appliedTransactions: applied.transactions,
    });
    expect(record?.markers).toEqual([
      {
        label: "remote steps received",
        category: "collaboration",
        tone: "info",
        startOffset: 2,
        duration: null,
        data: { count: 3 },
      },
      {
        label: "rebase",
        category: "collaboration",
        tone: "warning",
        startOffset: 2,
        duration: 5,
      },
    ]);
  });

  it("emits opt-in Chrome Performance tracks and markers with exact dispatch offsets", () => {
    let clock = 100;
    const mark = vi.fn();
    const measure = vi.fn();
    const clearMarks = vi.fn();
    const clearMeasures = vi.fn();
    const originalPerformance = globalThis.performance;
    Object.defineProperty(globalThis, "performance", {
      configurable: true,
      value: { now: () => clock, mark, measure, clearMarks, clearMeasures },
    });

    try {
      const store = createProseMirrorDevtoolsStore();
      const state = createTestState();
      const view = viewForState(state);
      store.register({ id: "editor", label: "Article editor", sessionId: "session1", view });
      const transaction = appendTextTransaction(state, "x");
      const measurement = store.beginTransaction("editor", transaction, state, false, {
        trackGroup: "Editor diagnostics",
        pluginHookThresholdMs: 1,
      });

      const applyStartedAt = clock;
      clock += 1;
      store.measurePluginHook("editor", "slow$", "Slow plugin", "state.apply", () => {
        clock += 2;
      });
      store.measurePluginHook("editor", "fast$", "Fast plugin", "state.apply", () => undefined);
      store.recordPhase(measurement, "apply", clock - applyStartedAt, applyStartedAt);

      clock += 1;
      const viewStartedAt = clock;
      clock += 1;
      store.measurePluginHook("editor", "slow$", "Slow plugin", "props.decorations", () => {
        clock += 2;
      });
      store.addMarker("editor", "Remote steps", {
        category: "collaboration",
        tone: "info",
        data: { count: 2 },
      });
      store.measureMarker(
        "editor",
        "Rebase",
        () => {
          clock += 3;
        },
        { category: "collaboration", tone: "warning" },
      );
      store.recordPhase(measurement, "viewUpdate", clock - viewStartedAt, viewStartedAt);
      store.recordPhase(measurement, "customDispatch", clock - 100, 100);

      const applied = state.applyTransaction(transaction);
      store.finishTransaction(measurement, {
        stateAfter: applied.state,
        appliedTransactions: applied.transactions,
      });
      expect(measure).toHaveBeenCalledTimes(8);
      expect(measure.mock.calls.some(([name]) => String(name).startsWith("Fast plugin ·"))).toBe(
        false,
      );
      expect(
        measure.mock.calls.some(([, options]) => {
          const detail = (options as { detail?: { devtools?: { track?: string } } }).detail;
          return ["Custom dispatch", "State apply", "View update"].includes(
            detail?.devtools?.track ?? "",
          );
        }),
      ).toBe(false);
      expect(measure).toHaveBeenCalledWith(
        "Dispatch #1 · editor · session1",
        expect.objectContaining({
          start: 100,
          duration: 10,
          detail: expect.objectContaining({
            devtools: expect.objectContaining({
              dataType: "track-entry",
              track: "Dispatches",
              trackGroup: "Editor diagnostics",
              properties: expect.arrayContaining([
                ["Dispatcher", "custom"],
                ["Custom callback duration", "10.00 ms"],
              ]),
            }),
          }),
        }),
      );
      expect(measure).toHaveBeenCalledWith(
        "Slow plugin · state.apply · editor #1 [session1] · 1",
        expect.objectContaining({
          start: 101,
          duration: 2,
          detail: expect.objectContaining({
            devtools: expect.objectContaining({
              track: "Dispatches",
              trackGroup: "Editor diagnostics",
            }),
          }),
        }),
      );
      expect(measure).toHaveBeenCalledWith(
        "State apply · editor #1 [session1] · 1",
        expect.objectContaining({
          start: 100,
          duration: 3,
          detail: expect.objectContaining({
            devtools: expect.objectContaining({ track: "Dispatches" }),
          }),
        }),
      );
      expect(measure).toHaveBeenCalledWith(
        "View update · editor #1 [session1] · 2",
        expect.objectContaining({
          start: 104,
          duration: 6,
          detail: expect.objectContaining({
            devtools: expect.objectContaining({ track: "Dispatches" }),
          }),
        }),
      );
      expect(measure).toHaveBeenCalledWith(
        "Slow plugin · props.decorations · editor #1 [session1] · 3",
        expect.objectContaining({
          start: 105,
          duration: 2,
          detail: expect.objectContaining({
            devtools: expect.objectContaining({ track: "Dispatches" }),
          }),
        }),
      );
      expect(measure).toHaveBeenCalledWith(
        "Rebase · editor #1 [session1] · 2",
        expect.objectContaining({
          start: 107,
          duration: 3,
          detail: expect.objectContaining({
            devtools: expect.objectContaining({
              track: "Markers",
              trackGroup: "Editor diagnostics",
              color: "tertiary-dark",
            }),
          }),
        }),
      );
      expect(mark).toHaveBeenCalledWith(
        "Remote steps · editor #1 [session1] · 1",
        expect.objectContaining({
          startTime: 107,
          detail: expect.objectContaining({
            devtools: expect.objectContaining({
              dataType: "marker",
              color: "primary-light",
              properties: expect.arrayContaining([["count", "2"]]),
            }),
          }),
        }),
      );
      expect(measure).toHaveBeenCalledWith(
        "Remote steps · editor #1 [session1] · 1 · track",
        expect.objectContaining({
          start: 107,
          duration: 0,
          detail: expect.objectContaining({
            devtools: expect.objectContaining({
              dataType: "track-entry",
              track: "Markers",
              trackGroup: "Editor diagnostics",
            }),
          }),
        }),
      );
      expect(measure).toHaveBeenCalledWith(
        "Custom code · editor #1 [session1] · 1",
        expect.objectContaining({
          start: 103,
          duration: 1,
          detail: expect.objectContaining({
            devtools: expect.objectContaining({
              track: "Dispatches",
              properties: expect.arrayContaining([
                ["Start offset", "3.00 ms"],
                ["End offset", "4.00 ms"],
                ["Duration", "1.00 ms"],
              ]),
            }),
          }),
        }),
      );

      store.clearTransactions("editor");
      expect(clearMeasures).toHaveBeenCalledWith("Dispatch #1 · editor · session1");
      expect(clearMeasures).toHaveBeenCalledWith(
        "Slow plugin · state.apply · editor #1 [session1] · 1",
      );
      expect(clearMeasures).toHaveBeenCalledWith("Rebase · editor #1 [session1] · 2");
      expect(clearMeasures).toHaveBeenCalledWith("Remote steps · editor #1 [session1] · 1 · track");
      expect(clearMeasures).toHaveBeenCalledWith("Custom code · editor #1 [session1] · 1");
      expect(clearMarks).toHaveBeenCalledWith("Remote steps · editor #1 [session1] · 1");
    } finally {
      Object.defineProperty(globalThis, "performance", {
        configurable: true,
        value: originalPerformance,
      });
    }
  });
});
