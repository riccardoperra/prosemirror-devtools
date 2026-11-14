import { Editor, Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { history, redo, undo } from "prosemirror-history";
import { EditorState } from "prosemirror-state";
import { afterEach, describe, expect, it } from "vitest";

import {
  attachTiptapDevtools,
  detachTiptapDevtools,
  dispatchTiptapTransaction,
  setupTiptapDevtools,
} from "../src/adapters/tiptap";
import { createProseMirrorDevtoolsSession, createProseMirrorDevtoolsStore } from "../src/core";
import { createHistoryInspector } from "../src/inspectors/history";
import { createTestView, testSchema } from "./helpers";

afterEach(() => document.body.replaceChildren());

describe("official history inspector", () => {
  it("distinguishes application dispatches from undoable events using public history APIs", () => {
    const plugin = history();
    const inspector = createHistoryInspector({ plugin });
    const store = createProseMirrorDevtoolsStore();
    const session = createProseMirrorDevtoolsSession({
      id: "history",
      store,
      inspectors: [inspector],
      performanceMarks: false,
    });
    const view = createTestView(
      EditorState.create({ schema: testSchema, plugins: session.instrumentPlugins([plugin]) }),
    );
    session.attach(view);
    try {
      view.dispatch(view.state.tr.insertText("x"));
      view.dispatch(view.state.tr.setMeta("addToHistory", false));
      const first = store.getInstance("history")?.transactions[0]?.inspection?.projections[0];
      const metadataOnly =
        store.getInstance("history")?.transactions[1]?.inspection?.projections[0];
      expect(first).toMatchObject({
        id: "prosemirror-history",
        evidence: {
          kind: "available",
          value: {
            kind: "dispatch",
            before: { undoDepth: 0, redoDepth: 0 },
            after: { undoDepth: 1, redoDepth: 0 },
            root: { historyTransaction: false, addToHistory: "unspecified" },
          },
        },
      });
      expect(metadataOnly?.evidence).toMatchObject({
        kind: "available",
        value: {
          before: { undoDepth: 1, redoDepth: 0 },
          after: { undoDepth: 1, redoDepth: 0 },
          root: { historyTransaction: false, addToHistory: "excluded" },
        },
      });
      expect(undo(view.state, view.dispatch)).toBe(true);
      expect(view.state.doc.textContent).toBe("");
      expect(
        store.getInstance("history")?.transactions[2]?.inspection?.projections[0]?.evidence,
      ).toMatchObject({
        kind: "available",
        value: {
          after: { undoDepth: 0, redoDepth: 1 },
          root: { historyTransaction: true },
        },
      });
      expect(redo(view.state, view.dispatch)).toBe(true);
      expect(store.getInstance("history")?.transactions).toHaveLength(4);
      expect(
        store.getInstance("history")?.transactions[3]?.inspection?.projections[0]?.evidence,
      ).toMatchObject({
        kind: "available",
        value: {
          after: { undoDepth: 1, redoDepth: 0 },
          root: { historyTransaction: true },
        },
      });
      expect(first?.evidence).toMatchObject({
        kind: "available",
        value: { after: { undoDepth: 1, redoDepth: 0 } },
      });
    } finally {
      session.dispose();
      view.destroy();
    }
  });

  it("reports a missing history plugin instead of presenting a supported empty history", () => {
    const store = createProseMirrorDevtoolsStore();
    const session = createProseMirrorDevtoolsSession({
      id: "missing",
      store,
      inspectors: [createHistoryInspector({ plugin: history() })],
      performanceMarks: false,
    });
    const view = createTestView();
    session.attach(view);
    try {
      view.dispatch(view.state.tr.insertText("x"));
      expect(
        store.getInstance("missing")?.transactions[0]?.inspection?.projections[0]?.evidence.kind,
      ).toBe("unsupported");
    } finally {
      session.dispose();
      view.destroy();
    }
  });

  it("finds the history plugin when none is supplied", () => {
    const store = createProseMirrorDevtoolsStore();
    const session = createProseMirrorDevtoolsSession({
      id: "found",
      store,
      inspectors: [createHistoryInspector()],
      performanceMarks: false,
    });
    const view = createTestView(EditorState.create({ schema: testSchema, plugins: [history()] }));
    session.attach(view);
    try {
      view.dispatch(view.state.tr.insertText("x"));
      expect(
        store.getInstance("found")?.transactions[0]?.inspection?.projections[0]?.evidence,
      ).toMatchObject({ kind: "available", value: { after: { undoDepth: 1, redoDepth: 0 } } });
    } finally {
      session.dispose();
      view.destroy();
    }
  });

  it("reports a missing history plugin when none is supplied or installed", () => {
    const store = createProseMirrorDevtoolsStore();
    const session = createProseMirrorDevtoolsSession({
      id: "absent",
      store,
      inspectors: [createHistoryInspector()],
      performanceMarks: false,
    });
    const view = createTestView();
    session.attach(view);
    try {
      view.dispatch(view.state.tr.insertText("x"));
      expect(
        store.getInstance("absent")?.transactions[0]?.inspection?.projections[0]?.evidence.kind,
      ).toBe("unsupported");
    } finally {
      session.dispose();
      view.destroy();
    }
  });

  it("observes StarterKit undo and redo in a Tiptap editor set up before history exists", () => {
    const store = createProseMirrorDevtoolsStore();
    const element = document.createElement("div");
    document.body.append(element);
    const editor = new Editor({
      element,
      content: "<p>Hello</p>",
      extensions: [
        Extension.create({
          name: "inspector",
          priority: 10_000,
          onBeforeCreate() {
            setupTiptapDevtools(this.editor, {
              id: "tiptap-history",
              store,
              inspectors: [createHistoryInspector()],
              performanceMarks: false,
            });
          },
          onCreate() {
            attachTiptapDevtools(this.editor);
          },
          dispatchTransaction(props) {
            dispatchTiptapTransaction(this.editor, props);
          },
          onDestroy() {
            detachTiptapDevtools(this.editor);
          },
        }),
        StarterKit,
      ],
    });
    const historyEvidence = () =>
      store.getInstance("tiptap-history")?.transactions.at(-1)?.inspection?.projections[0]
        ?.evidence;
    try {
      editor.commands.insertContent("x");
      expect(historyEvidence()).toMatchObject({
        kind: "available",
        value: { after: { undoDepth: 1, redoDepth: 0 }, root: { historyTransaction: false } },
      });
      expect(editor.commands.undo()).toBe(true);
      expect(historyEvidence()).toMatchObject({
        kind: "available",
        value: { after: { undoDepth: 0, redoDepth: 1 }, root: { historyTransaction: true } },
      });
      expect(editor.commands.redo()).toBe(true);
      expect(historyEvidence()).toMatchObject({
        kind: "available",
        value: { after: { undoDepth: 1, redoDepth: 0 }, root: { historyTransaction: true } },
      });
    } finally {
      editor.destroy();
    }
  });
});
