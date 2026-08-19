import { Plugin } from "prosemirror-state";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createProseMirrorDevtoolsSession, createProseMirrorDevtoolsStore } from "../src/core";
import { appendTextTransaction, createTestState, createTestView } from "./helpers";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("createProseMirrorDevtoolsSession", () => {
  it("owns plugin timing, attachment, and stale-hook teardown", () => {
    let clock = 10;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const destroy = vi.fn(() => {
      clock += 7;
    });
    const plugin = new Plugin({
      state: {
        init() {
          clock += 2;
          return null;
        },
        apply(_transaction, value) {
          clock += 3;
          return value;
        },
      },
      view() {
        return { destroy };
      },
    });
    const store = createProseMirrorDevtoolsStore();
    const session = createProseMirrorDevtoolsSession({
      id: "editor",
      sessionId: "first-session",
      performanceMarks: false,
      store,
    });
    const plugins = session.instrumentPlugins([plugin]);
    const view = createTestView(createTestState("", plugins));
    session.attach(view);

    view.dispatch(appendTextTransaction(view.state, "x"));
    expect(store.getInstance("editor")?.pluginTimings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ hook: "state.init", count: 1 }),
        expect.objectContaining({ hook: "state.apply", count: 1 }),
      ]),
    );

    session.dispose();
    expect(session.active).toBe(false);
    expect(store.getSnapshot().instances).toEqual([]);
    view.destroy();
    expect(destroy).toHaveBeenCalledOnce();

    const nextSession = createProseMirrorDevtoolsSession({
      id: "editor",
      sessionId: "second-session",
      performanceMarks: false,
      store,
    });
    const nextView = createTestView(createTestState());
    nextSession.attach(nextView);
    expect(store.getInstance("editor")?.pluginTimings).toEqual([]);
    nextSession.dispose();
    nextView.destroy();
  });

  it("uses private session namespaces for same-id editors in isolated stores", () => {
    let clock = 100;
    const measure = vi.fn();
    const clearMeasures = vi.fn();
    const originalPerformance = globalThis.performance;
    Object.defineProperty(globalThis, "performance", {
      configurable: true,
      value: { now: () => clock++, measure, clearMeasures },
    });

    try {
      const first = createProseMirrorDevtoolsSession({
        id: "editor",
        sessionId: "alpha",
        store: createProseMirrorDevtoolsStore(),
      });
      const second = createProseMirrorDevtoolsSession({
        id: "editor",
        sessionId: "beta",
        store: createProseMirrorDevtoolsStore(),
      });
      const firstView = createTestView(createTestState());
      const secondView = createTestView(createTestState());
      first.attach(firstView);
      second.attach(secondView);

      firstView.dispatch(appendTextTransaction(firstView.state, "a"));
      secondView.dispatch(appendTextTransaction(secondView.state, "b"));

      expect(measure).toHaveBeenCalledWith(
        "prosemirror-devtools:alpha:editor:dispatch:1",
        expect.objectContaining({ start: expect.any(Number), duration: expect.any(Number) }),
      );
      expect(measure).toHaveBeenCalledWith(
        "prosemirror-devtools:beta:editor:dispatch:1",
        expect.objectContaining({ start: expect.any(Number), duration: expect.any(Number) }),
      );

      first.dispose();
      second.dispose();
      firstView.destroy();
      secondView.destroy();
    } finally {
      Object.defineProperty(globalThis, "performance", {
        configurable: true,
        value: originalPerformance,
      });
    }
  });

  it("discards buffered initialization timings when disposed before attachment", () => {
    const store = createProseMirrorDevtoolsStore();
    const session = createProseMirrorDevtoolsSession({
      id: "editor",
      sessionId: "abandoned",
      store,
    });
    const plugins = session.instrumentPlugins([
      new Plugin({
        state: {
          init: () => null,
          apply: (_transaction, value) => value,
        },
      }),
    ]);
    createTestState("", plugins);
    session.dispose();

    const view = createTestView(createTestState());
    const unregister = store.register({ id: "editor", sessionId: "abandoned", view });
    expect(store.getInstance("editor")?.pluginTimings).toEqual([]);
    unregister();
    view.destroy();
  });

  it("records through framework-owned dispatch middleware without patching the view", () => {
    const store = createProseMirrorDevtoolsStore();
    const session = createProseMirrorDevtoolsSession({
      id: "editor",
      performanceMarks: false,
      store,
    });
    const view = createTestView(createTestState());
    const originalDispatch = view.props.dispatchTransaction;
    const recorder = session.createDispatchRecorder(view);
    const transaction = appendTextTransaction(view.state, "x");

    recorder.record(transaction, () => {
      const applied = view.state.applyTransaction(transaction);
      view.updateState(applied.state);
    });

    expect(view.props.dispatchTransaction).toBe(originalDispatch);
    expect(store.getInstance("editor")?.transactions).toEqual([
      expect.objectContaining({ id: 1, sessionId: session.sessionId }),
    ]);
    session.dispose();
    expect(store.getSnapshot().instances).toEqual([]);
    view.destroy();
  });
});
