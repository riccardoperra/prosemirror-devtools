import { Plugin } from "prosemirror-state";
import { afterEach, describe, expect, it } from "vitest";

import {
  createProseMirrorDevtoolsSession,
  createProseMirrorDevtoolsStore,
  createProseMirrorInspectionClient,
} from "../src/core";
import { appendTextTransaction, createTestState, createTestView } from "./helpers";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  document.body.replaceChildren();
});

describe("capture generation isolation", () => {
  it.each([false, true])(
    "discards a dispatch that outlives its registration, paused=%s",
    (paused) => {
      const store = createProseMirrorDevtoolsStore();
      const oldSession = createProseMirrorDevtoolsSession({
        id: "reused",
        sessionId: "same",
        store,
        performanceMarks: false,
      });
      const replacementView = createTestView(createTestState("B"));
      const oldView = createTestView(createTestState("A"), {
        dispatchTransaction(transaction) {
          oldView.updateState(oldView.state.applyTransaction(transaction).state);
          oldSession.dispose();
          const replacementSession = createProseMirrorDevtoolsSession({
            id: "reused",
            sessionId: "same",
            store,
            performanceMarks: false,
          });
          replacementSession.attach(replacementView);
          cleanups.push(() => replacementSession.dispose());
        },
      });
      oldSession.attach(oldView);
      cleanups.push(
        () => oldView.destroy(),
        () => replacementView.destroy(),
        () => oldSession.dispose(),
      );
      const client = createProseMirrorInspectionClient({ store });
      const previous = client.listEditors()[0]?.target;
      if (paused) oldSession.pauseCapture();
      oldView.dispatch(appendTextTransaction(oldView.state, "X"));
      const target = client.listEditors()[0]?.target;
      if (!previous || !target) throw new Error("Both registrations must be observed.");
      expect(target.generation).not.toBe(previous.generation);
      expect(client.pin({ target: previous }).kind).toBe("expired");
      expect(store.getInstance("reused")).toMatchObject({
        dispatchCount: 0,
        transactions: [],
        inspection: { capture: { gaps: [] } },
      });
      expect(
        client.query({ target, at: { kind: "transaction", id: 1 }, query: { kind: "document" } })
          .kind,
      ).toBe("unobserved");
      replacementView.dispatch(appendTextTransaction(replacementView.state, "!"));
      expect(store.getInstance("reused")?.transactions).toHaveLength(1);
      expect(
        client.query({ target, at: { kind: "transaction", id: 1 }, query: { kind: "document" } }),
      ).toMatchObject({ kind: "available", value: { content: [{ content: [{ text: "B!" }] }] } });
    },
  );

  it("discards plugin timing when the hook replaces its registration", () => {
    const store = createProseMirrorDevtoolsStore();
    const oldSession = createProseMirrorDevtoolsSession({
      id: "reused",
      sessionId: "same",
      store,
      performanceMarks: false,
    });
    const replacementView = createTestView(createTestState("B"));
    const plugin = new Plugin({
      state: {
        init: () => 0,
        apply(_transaction, value) {
          oldSession.dispose();
          const replacementSession = createProseMirrorDevtoolsSession({
            id: "reused",
            sessionId: "same",
            store,
            performanceMarks: false,
          });
          replacementSession.attach(replacementView);
          cleanups.push(() => replacementSession.dispose());
          return value + 1;
        },
      },
    });
    const oldView = createTestView(createTestState("A", oldSession.instrumentPlugins([plugin])));
    oldSession.attach(oldView);
    cleanups.push(
      () => oldView.destroy(),
      () => replacementView.destroy(),
      () => oldSession.dispose(),
    );
    oldView.dispatch(appendTextTransaction(oldView.state, "X"));
    expect(store.getInstance("reused")).toMatchObject({
      dispatchCount: 0,
      transactions: [],
      pluginTimings: [],
    });
    expect(replacementView.state.doc.textContent).toBe("B");
  });
});
