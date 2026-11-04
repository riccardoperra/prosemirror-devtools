import { keymap } from "prosemirror-keymap";
import { Plugin, PluginKey } from "prosemirror-state";
import { afterEach, describe, expect, it } from "vitest";

import {
  createProseMirrorDevtoolsSession,
  createProseMirrorDevtoolsStore,
  createProseMirrorInspectionClient,
} from "../src/core";
import { createTestState, createTestView } from "./helpers";

afterEach(() => document.body.replaceChildren());

describe("C5 named input evidence", () => {
  it("links a real keymap command and retains paste and composition events without payloads", () => {
    const store = createProseMirrorDevtoolsStore();
    const session = createProseMirrorDevtoolsSession({
      id: "input",
      store,
      diagnostics: true,
      performanceMarks: false,
    });
    const diagnostics = session.diagnostics;
    if (!diagnostics) throw new Error("The input scenario requires diagnostics.");
    const keys = keymap({
      Enter(state, dispatch) {
        return diagnostics.traceCommand("Insert marker", () => {
          dispatch?.(state.tr.insertText("x"));
          return true;
        });
      },
      Escape() {
        return diagnostics.traceCommand("No action", () => false);
      },
    });
    const input = new Plugin({
      key: new PluginKey("input-events"),
      props: {
        handleDOMEvents: {
          paste: () => true,
          compositionstart: () => true,
          compositionend: () => true,
        },
      },
    });
    const view = createTestView(createTestState("", session.instrumentPlugins([keys, input])));
    session.attach(view);
    try {
      view.dom.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }),
      );
      view.dom.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }),
      );
      let payloadReads = 0;
      const paste = Object.defineProperty(new Event("paste", { bubbles: true }), "clipboardData", {
        get() {
          payloadReads += 1;
          return { getData: () => "private clipboard" };
        },
      });
      const composition = Object.defineProperty(
        new Event("compositionstart", { bubbles: true }),
        "data",
        {
          get() {
            payloadReads += 1;
            return "private composition";
          },
        },
      );
      view.dom.dispatchEvent(paste);
      view.dom.dispatchEvent(composition);
      view.dom.dispatchEvent(new Event("compositionend", { bubbles: true }));

      expect(view.state.doc.textContent).toBe("x");
      expect(store.getInstance("input")?.transactions).toHaveLength(1);
      const events = diagnostics.getSnapshot().events;
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "command",
            name: "Insert marker",
            handled: true,
            dispatches: [
              {
                instanceId: "input",
                id: 1,
                sessionId: session.sessionId,
                generation: store.getInstance("input")?.inspection?.target.generation,
              },
            ],
          }),
          expect.objectContaining({
            kind: "command",
            name: "No action",
            handled: false,
            dispatches: [],
          }),
          expect.objectContaining({
            kind: "dom-event",
            name: "paste",
            handled: true,
            dispatches: [],
          }),
          expect.objectContaining({ kind: "dom-event", name: "compositionstart", handled: true }),
          expect.objectContaining({ kind: "dom-event", name: "compositionend", handled: true }),
        ]),
      );
      const client = createProseMirrorInspectionClient({ store });
      const target = client.listEditors()[0]?.target;
      if (!target) throw new Error("The input editor must be discoverable.");
      const result = client.query({ target, query: { kind: "events" } });
      expect(result.kind).toBe("available");
      expect(JSON.stringify(result)).not.toContain("private clipboard");
      expect(JSON.stringify(result)).not.toContain("private composition");
      expect(payloadReads).toBe(0);
    } finally {
      session.dispose();
      view.destroy();
    }
  });
});
