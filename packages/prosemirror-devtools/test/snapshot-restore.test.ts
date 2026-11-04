import { Schema } from "prosemirror-model";
import { EditorState, Plugin, TextSelection } from "prosemirror-state";
import { afterEach, describe, expect, it } from "vitest";

import {
  compareSnapshots,
  createSnapshot,
  restoreDocument,
  restoreSnapshot,
} from "../src/core/snapshots";
import { createTestState, createTestView } from "./helpers";

afterEach(() => document.body.replaceChildren());

describe("snapshot document contract", () => {
  it("restores root attributes and selection through a normal dispatch", () => {
    const schema = new Schema({
      nodes: {
        doc: { content: "paragraph+", attrs: { title: { default: "Untitled" } } },
        paragraph: { content: "text*", toDOM: () => ["p", 0] },
        text: {},
      },
    });
    let applied = 0;
    const observer = new Plugin({
      state: {
        init: () => 0,
        apply: (_tr, value) => {
          applied += 1;
          return value + 1;
        },
      },
    });
    const doc = schema.node(
      "doc",
      { title: "Saved title" },
      schema.node("paragraph", null, schema.text("saved")),
    );
    const view = createTestView(EditorState.create({ schema, doc, plugins: [observer] }));
    try {
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3)));
      const snapshot = createSnapshot("editor", view);
      view.dispatch(
        view.state.tr.insertText("changed", 1, 6).setDocAttribute("title", "Changed title"),
      );
      const before = applied;
      restoreSnapshot(view, snapshot);
      expect(view.state.doc.toJSON()).toEqual(snapshot.doc);
      expect(view.state.selection.toJSON()).toEqual(snapshot.selection);
      expect(applied).toBe(before + 1);
      expect(observer.getState(view.state)).toBe(applied);
    } finally {
      view.destroy();
    }
  });

  it("rejects structurally invalid documents and a non-document root before dispatch", () => {
    const view = createTestView(createTestState("unchanged"));
    try {
      expect(() =>
        restoreDocument(view, { type: "doc", content: [{ type: "text", text: "bad" }] }),
      ).toThrow();
      expect(() => restoreDocument(view, { type: "paragraph" })).toThrow("Expected a doc document");
      expect(view.state.doc.textContent).toBe("unchanged");
    } finally {
      view.destroy();
    }
  });

  it("refuses a root mark change instead of silently changing the checkpoint document", () => {
    const schema = new Schema({
      nodes: {
        doc: { content: "paragraph+" },
        paragraph: { content: "text*", toDOM: () => ["p", 0] },
        text: {},
      },
      marks: { strong: { toDOM: () => ["strong", 0] } },
    });
    const paragraph = schema.node("paragraph", null, schema.text("content"));
    const current = schema.node("doc", null, paragraph);
    const marked = schema.node("doc", null, paragraph, [schema.mark("strong")]);
    const view = createTestView(EditorState.create({ schema, doc: current }));
    try {
      expect(() => marked.check()).not.toThrow();
      expect(() => restoreDocument(view, marked.toJSON())).toThrow("Document-level marks");
      expect(view.state.doc).toBe(current);
    } finally {
      view.destroy();
    }
  });

  it("compares content, root attributes, and selection with a bounded result", () => {
    const before = {
      doc: { type: "doc", attrs: { title: "A" }, content: [{ type: "text", text: "before" }] },
      selection: { type: "text", anchor: 1, head: 1 },
    };
    const after = {
      doc: { type: "doc", attrs: { title: "B" }, content: [{ type: "text", text: "after" }] },
      selection: { type: "text", anchor: 2, head: 2 },
    };
    expect(compareSnapshots(before, after).differences.map(({ path }) => path)).toEqual([
      "/doc/attrs/title",
      "/doc/content/0/text",
      "/selection/anchor",
      "/selection/head",
    ]);
    expect(compareSnapshots(before, after, 2)).toMatchObject({
      differences: expect.any(Array),
      truncated: true,
    });
    expect(compareSnapshots(before, before)).toEqual({ differences: [], truncated: false });
  });
});
