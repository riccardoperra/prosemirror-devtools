import { collab, getVersion, receiveTransaction, sendableSteps } from "prosemirror-collab";
import { EditorState } from "prosemirror-state";
import { afterEach, describe, expect, it } from "vitest";

import { createProseMirrorDevtoolsSession, createProseMirrorDevtoolsStore } from "../src/core";
import { createCollabInspector } from "../src/inspectors/collab";
import { createTransportObserver } from "../src/inspectors/transport";
import { createTestView, testSchema } from "./helpers";

afterEach(() => document.body.replaceChildren());

describe("official collaboration inspector", () => {
  it("captures confirmed versions, unconfirmed origins, and explicitly observed concurrent transport", () => {
    const store = createProseMirrorDevtoolsStore();
    const pluginA = collab({ clientID: "A" });
    const pluginB = collab({ clientID: "B" });
    const transportA = createTransportObserver();
    const transportB = createTransportObserver();
    const sessionA = createProseMirrorDevtoolsSession({
      id: "A",
      store,
      inspectors: [createCollabInspector({ plugin: pluginA, transport: transportA })],
      performanceMarks: false,
    });
    const sessionB = createProseMirrorDevtoolsSession({
      id: "B",
      store,
      inspectors: [createCollabInspector({ plugin: pluginB, transport: transportB })],
      performanceMarks: false,
    });
    const a = createTestView(EditorState.create({ schema: testSchema, plugins: [pluginA] }));
    const b = createTestView(EditorState.create({ schema: testSchema, plugins: [pluginB] }));
    sessionA.attach(a);
    sessionB.attach(b);
    try {
      transportA.observe({ kind: "connection", state: "connected" });
      transportB.observe({ kind: "connection", state: "connected" });
      a.dispatch(a.state.tr.insertText("x"));
      b.dispatch(b.state.tr.insertText("y"));
      const first = sendableSteps(a.state);
      if (!first) throw new Error("Expected A's pending step");
      transportA.observe({
        kind: "send",
        messageId: "A1",
        payload: { kind: "steps", version: first.version, count: first.steps.length },
        dispatch: { kind: "observed", dispatchId: 1 },
      });
      transportB.observe({
        kind: "receive",
        messageId: "A1",
        payload: { kind: "steps", version: first.version, count: first.steps.length },
        dispatch: { kind: "unknown" },
      });
      b.dispatch(
        receiveTransaction(
          b.state,
          first.steps,
          first.steps.map(() => first.clientID),
        ),
      );
      a.dispatch(
        receiveTransaction(
          a.state,
          first.steps,
          first.steps.map(() => first.clientID),
        ),
      );
      transportA.observe({
        kind: "acknowledge",
        messageId: "A1",
        confirmedVersion: 1,
        dispatch: { kind: "unknown" },
      });
      const rebased = sendableSteps(b.state);
      if (!rebased) throw new Error("Expected B's rebased pending step");
      expect(rebased.version).toBe(1);
      expect(rebased.origins[0]?.doc.textContent).toBe("y");
      transportB.observe({
        kind: "send",
        messageId: "B1",
        payload: { kind: "steps", version: rebased.version, count: rebased.steps.length },
        dispatch: { kind: "unknown" },
      });
      a.dispatch(
        receiveTransaction(
          a.state,
          rebased.steps,
          rebased.steps.map(() => rebased.clientID),
        ),
      );
      b.dispatch(
        receiveTransaction(
          b.state,
          rebased.steps,
          rebased.steps.map(() => rebased.clientID),
        ),
      );
      expect(a.state.doc.textContent).toBe("xy");
      expect(b.state.doc.textContent).toBe("xy");
      expect(getVersion(a.state)).toBe(2);
      expect(getVersion(b.state)).toBe(2);
      expect(sendableSteps(a.state)).toBeNull();
      expect(sendableSteps(b.state)).toBeNull();
      expect(
        store.getInstance("B")?.transactions[1]?.inspection?.projections[0]?.evidence,
      ).toMatchObject({
        kind: "available",
        value: {
          before: { version: 0, unconfirmedSteps: 1 },
          state: {
            version: 1,
            unconfirmedSteps: 1,
            originScope: "original-transactions-before-any-rebase",
            origins: [{ pendingStepIndex: 0, originalStepCount: 1, docChanged: true }],
          },
          transport: {
            counts: { receives: 1 },
            latest: { signal: { kind: "receive", messageId: "A1", dispatch: { kind: "unknown" } } },
          },
        },
      });
      expect(
        store.getInstance("A")?.transactions[0]?.inspection?.projections[0]?.evidence,
      ).toMatchObject({ kind: "available", value: { state: { version: 0, unconfirmedSteps: 1 } } });
      expect(
        store.getInstance("A")?.transactions[2]?.inspection?.projections[0]?.evidence,
      ).toMatchObject({ kind: "available", value: { state: { version: 2, unconfirmedSteps: 0 } } });
    } finally {
      sessionA.dispose();
      sessionB.dispose();
      a.destroy();
      b.destroy();
    }
  });

  it("keeps the live collab state advancing while detailed capture is paused and declares the gap", () => {
    const store = createProseMirrorDevtoolsStore();
    const plugin = collab({ clientID: "local" });
    const transport = createTransportObserver();
    const session = createProseMirrorDevtoolsSession({
      id: "paused",
      store,
      inspectors: [createCollabInspector({ plugin, transport })],
      performanceMarks: false,
    });
    const view = createTestView(EditorState.create({ schema: testSchema, plugins: [plugin] }));
    session.attach(view);
    try {
      session.pauseCapture();
      const remote = EditorState.create({ schema: testSchema }).tr.insertText("remote");
      transport.observe({
        kind: "receive",
        messageId: "remote1",
        payload: { kind: "steps", version: 0, count: 1 },
        dispatch: { kind: "unknown" },
      });
      view.dispatch(receiveTransaction(view.state, remote.steps, ["remote"]));
      expect(view.state.doc.textContent).toBe("remote");
      expect(getVersion(view.state)).toBe(1);
      expect(store.getInstance("paused")?.transactions).toEqual([]);
      expect(store.getInstance("paused")?.inspection?.capture.gaps).toMatchObject([
        { reason: "paused", firstDispatchId: 1, lastDispatchId: 1 },
      ]);
      expect(transport.getSnapshot()).toMatchObject({
        counts: { receives: 1 },
        latest: { signal: { messageId: "remote1" } },
      });
      session.resumeCapture();
      view.dispatch(view.state.tr.insertText("local"));
      expect(
        store.getInstance("paused")?.transactions[0]?.inspection?.projections[0]?.evidence,
      ).toMatchObject({
        kind: "available",
        value: { before: { version: 1 }, state: { version: 1, unconfirmedSteps: 1 } },
      });
    } finally {
      session.dispose();
      view.destroy();
    }
  });
});
