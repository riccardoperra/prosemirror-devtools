import { Schema } from "prosemirror-model";
import { AllSelection, EditorState, NodeSelection, TextSelection } from "prosemirror-state";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";

import { attachProseMirrorDevtools, createProseMirrorDevtoolsStore } from "../src/core";
import { describePosition } from "../src/panel/features/selection/selection-view";
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
    const inside = describePosition(doc.resolve(4));
    expect(inside).toMatchObject({
      pos: 4,
      depth: 2,
      parentOffset: 2,
      textOffset: 2,
      place: "inside",
    });
    expect(inside.path.map(({ node, from, to }) => [node.type.name, from, to])).toEqual([
      ["doc", 0, 9],
      ["blockquote", 0, 9],
      ["paragraph", 1, 8],
    ]);
    // Inside a text node both neighbours are cut at the position but link to the whole node.
    expect(inside.nodeBefore).toMatchObject({ from: 2, to: 4, target: 2 });
    expect(inside.nodeBefore?.node.text).toBe("he");
    expect(inside.nodeAfter).toMatchObject({ from: 4, to: 7, target: 2 });
    expect(inside.nodeAfter?.node.text).toBe("llo");
    const end = describePosition(doc.resolve(doc.content.size));
    expect(end.path).toHaveLength(1);
    expect(end.place).toBe("end");
    expect(end.nodeAfter).toBeNull();
  });

  it("shows backward, node, all and cursor selections with one card per endpoint", () => {
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
      const card = (name: string) =>
        container.querySelector(`[aria-label="${name} position"]`)?.textContent ?? "";
      const summary = () =>
        container.querySelector('[aria-label="Selection summary"]')?.textContent ?? "";
      expect(summary()).toContain("backward");
      expect(card("Anchor")).toContain("pos 5");
      expect(card("Head")).toContain("pos 2");
      expect(container.querySelector('[aria-label="Selected content"]')?.textContent).toContain(
        '"ell"',
      );

      view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
      expect(card("Anchor")).toContain("pos 0");
      expect(summary()).toContain("node");
      expect(container.textContent).toContain('"type": "node"');
      view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
      expect(card("Head")).toContain("pos 7");
      expect(container.textContent).toContain('"type": "all"');

      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3)));
      expect(card("Cursor")).toContain("pos 3");
      expect(card("Anchor")).toBe("");
      expect(container.querySelector('[aria-label="Selected content"]')).toBeNull();
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
      const source = () =>
        container.querySelector("[data-marks-source]")?.getAttribute("data-marks-source");
      expect(source()).toBe("at cursor");
      view.dispatch(view.state.tr.setStoredMarks([]));
      expect(source()).toBe("stored");
    } finally {
      dispose();
      attachment.detach();
      view.destroy();
    }
  });
});
