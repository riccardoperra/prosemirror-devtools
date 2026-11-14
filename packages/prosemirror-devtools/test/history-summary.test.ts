import { Schema, type Node as ProseMirrorNode } from "prosemirror-model";
import { EditorState, TextSelection, type Transaction } from "prosemirror-state";
import { describe, expect, it } from "vitest";

import {
  describeSelection,
  formatStep,
  summarizeStep,
} from "../src/panel/features/history/summarize-dispatch";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "text*", group: "block" },
    heading: { content: "text*", group: "block", attrs: { level: { default: 1 } } },
    blockquote: { content: "block+", group: "block" },
    text: {},
  },
  marks: { strong: {} },
});

function stateWith(...texts: string[]): EditorState {
  return EditorState.create({
    schema,
    doc: schema.node(
      "doc",
      null,
      texts.map((text) => schema.node("paragraph", null, text ? schema.text(text) : undefined)),
    ),
  });
}

/** The words for each step of `edit`, each read against the document it applied to. */
function words(state: EditorState, edit: (tr: Transaction) => void): string[] {
  const tr = state.tr;
  edit(tr);
  return tr.steps.map((step, index) =>
    formatStep(summarizeStep(step.toJSON(), tr.docs[index] as ProseMirrorNode)),
  );
}

describe("dispatch summaries", () => {
  it("names text edits with the text they touch", () => {
    const state = stateWith("hello");
    expect(words(state, (tr) => tr.insertText("x", 6))).toEqual(['insert "x" at 6']);
    expect(words(state, (tr) => tr.delete(2, 4))).toEqual(['delete "el" 2–4']);
    expect(words(state, (tr) => tr.insertText("J", 1, 2))).toEqual(['replace "h" → "J" 1–2']);
    expect(words(state, (tr) => tr.addMark(1, 6, schema.mark("strong")))).toEqual([
      "add mark strong 1–6",
    ]);
  });

  it("recognises Enter, Backspace at a block start and block type changes", () => {
    const state = stateWith("hello", "world");
    expect(words(state, (tr) => tr.split(3))).toEqual(["split paragraph at 3"]);
    expect(words(state, (tr) => tr.join(7))).toEqual(["join paragraph at 6"]);
    expect(words(state, (tr) => tr.setBlockType(1, 6, schema.nodes.heading!))).toEqual([
      "change paragraph → heading 0–7",
    ]);
    const heading = state.apply(state.tr.setBlockType(1, 6, schema.nodes.heading!));
    expect(words(heading, (tr) => tr.setNodeAttribute(0, "level", 2))).toEqual([
      "set heading.level = 2 at 0",
    ]);
  });

  it("recognises wrapping and lifting", () => {
    const state = stateWith("hello");
    const range = state.doc.resolve(1).blockRange()!;
    expect(words(state, (tr) => tr.wrap(range, [{ type: schema.nodes.blockquote! }]))).toEqual([
      "wrap in blockquote 0–7",
    ]);
    const wrapped = state.apply(state.tr.wrap(range, [{ type: schema.nodes.blockquote! }]));
    const inner = wrapped.doc.resolve(2).blockRange()!;
    expect(words(wrapped, (tr) => tr.lift(inner, 0))).toEqual(["lift out of blockquote 0–9"]);
  });

  it("still describes a step without the document it applied to", () => {
    const state = stateWith("hello");
    const tr = state.tr.insertText("x", 6);
    expect(formatStep(summarizeStep(tr.steps[0]!.toJSON(), null))).toBe('insert "x" at 6');
    expect(formatStep(summarizeStep({ stepType: "custom", from: 3 }, null))).toBe("custom at 3");
  });

  it("describes selections in words", () => {
    const state = stateWith("hello");
    expect(describeSelection(TextSelection.create(state.doc, 3).toJSON())).toBe("cursor 3");
    expect(describeSelection(TextSelection.create(state.doc, 2, 5).toJSON())).toBe("text 2–5");
    expect(describeSelection(TextSelection.create(state.doc, 5, 2).toJSON())).toBe(
      "text 2–5 backward",
    );
    expect(describeSelection({ type: "node", anchor: 0 })).toBe("node 0");
    expect(describeSelection({ type: "all" })).toBe("all");
    expect(describeSelection(null)).toBe("unknown");
  });
});
