import { Schema } from "prosemirror-model";
import { AllSelection, EditorState, NodeSelection, TextSelection } from "prosemirror-state";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";

import { attachProseMirrorDevtools, createProseMirrorDevtoolsStore } from "../src/core";
import { inspectPosition } from "../src/panel/features/selection/selection-view";
import { ProseMirrorDevtoolsPanel } from "../src/panel/panel";
import { createTestState, createTestView } from "./helpers";

afterEach(() => document.body.replaceChildren());

describe("Selection panel", () => {
  it("resolves nested content boundaries without reading outside the document", () => {
    const schema = new Schema({
      nodes: {
        doc: { content: "block+" },
        blockquote: { content: "block+", group: "block" },
        paragraph: { content: "text*", group: "block" },
        text: {},
      },
    });
    const doc = schema.node(
      "doc",
      null,
      schema.node("blockquote", null, schema.node("paragraph", null, schema.text("hello"))),
    );
    expect(inspectPosition(doc.resolve(4))).toEqual({
      pos: 4,
      depth: 2,
      parentOffset: 2,
      textOffset: 2,
      ancestors: [
        { depth: 0, type: "doc", index: 0, start: 0, end: 9, before: null, after: null, attrs: {} },
        {
          depth: 1,
          type: "blockquote",
          index: 0,
          start: 1,
          end: 8,
          before: 0,
          after: 9,
          attrs: {},
        },
        { depth: 2, type: "paragraph", index: 0, start: 2, end: 7, before: 1, after: 8, attrs: {} },
      ],
    });
    expect(inspectPosition(doc.resolve(doc.content.size)).ancestors).toHaveLength(1);
  });

  it("tracks backward, node and all selections and switches endpoints", () => {
    const state = createTestState("hello");
    const view = createTestView(
      state.apply(state.tr.setSelection(TextSelection.create(state.doc, 5, 2))),
    );
    const store = createProseMirrorDevtoolsStore();
    const attachment = attachProseMirrorDevtools({
      id: "editor",
      view,
      store,
      performanceMarks: false,
    });
    const container = document.createElement("div");
    document.body.append(container);
    const dispose = render(
      () => <ProseMirrorDevtoolsPanel defaultPanel="selection" store={store} />,
      container,
    );
    try {
      expect(container.textContent).toContain("backward");
      expect(container.textContent).toContain("position 2");
      const buttons = container.querySelectorAll<HTMLButtonElement>(
        '[aria-label="Selection endpoint"] button',
      );
      buttons[0]?.click();
      expect(container.textContent).toContain("position 5");
      expect(buttons[0]?.getAttribute("aria-pressed")).toBe("true");

      view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
      expect(container.textContent).toContain("position 0");
      expect(container.textContent).toContain('"node"');
      view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
      buttons[1]?.click();
      expect(container.textContent).toContain("position 7");
      expect(container.textContent).toContain('"all"');
    } finally {
      dispose();
      attachment.detach();
      view.destroy();
    }
  });

  it("distinguishes inherited stored marks from an explicitly empty set", () => {
    const schema = new Schema({
      nodes: {
        doc: { content: "paragraph+" },
        paragraph: { content: "text*", toDOM: () => ["p", 0] },
        text: {},
      },
      marks: { strong: { toDOM: () => ["strong", 0] } },
    });
    const state = EditorState.create({
      schema,
      doc: schema.node(
        "doc",
        null,
        schema.node("paragraph", null, schema.text("bold", [schema.mark("strong")])),
      ),
    });
    const view = createTestView(state);
    const store = createProseMirrorDevtoolsStore();
    const attachment = attachProseMirrorDevtools({
      id: "marks",
      view,
      store,
      performanceMarks: false,
    });
    const container = document.createElement("div");
    const dispose = render(
      () => <ProseMirrorDevtoolsPanel defaultPanel="selection" store={store} />,
      container,
    );
    try {
      const storedMarks = () =>
        Array.from(container.querySelectorAll(".pm-json-row")).find(
          (row) => row.querySelector(".pm-json-key")?.textContent === "storedMarks",
        );
      expect(storedMarks()?.textContent).toContain("null");
      view.dispatch(view.state.tr.setStoredMarks([]));
      expect(storedMarks()?.textContent).toContain("Array(0)");
    } finally {
      dispose();
      attachment.detach();
      view.destroy();
    }
  });
});
