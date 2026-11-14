import { Schema } from "prosemirror-model";
import { EditorState, type Transaction } from "prosemirror-state";
import { describe, expect, it } from "vitest";

import { diffDocuments, type DiffLine } from "../src/panel/features/changes/document-diff";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "text*", group: "block" },
    heading: { content: "text*", group: "block", attrs: { level: { default: 1 } } },
    text: {},
  },
  marks: { strong: {} },
});

const state = EditorState.create({
  schema,
  doc: schema.node("doc", null, [
    schema.node("heading", null, schema.text("Title")),
    schema.node("paragraph", null, schema.text("hello")),
    schema.node("paragraph", null, schema.text("world")),
  ]),
});

function diff(edit: (tr: Transaction) => void) {
  const tr = state.tr;
  edit(tr);
  return diffDocuments(state.doc, tr.doc);
}

const show = (lines: readonly DiffLine[]): string[] =>
  lines.map((line) => `${line.kind} ${"  ".repeat(line.depth)}${line.text}`);

describe("document diff", () => {
  it("opens only the changed node and folds its unchanged siblings", () => {
    const result = diff((tr) => tr.insertText("!", 13));
    expect(result.range).toEqual({ from: 13, oldTo: 13, newTo: 14 });
    expect(show(result.lines)).toEqual([
      "fold ⋯ 1 unchanged: heading",
      'same { "type": "paragraph"',
      'same   "content": [',
      'same     { "type": "text"',
      'del       "text": "hello"',
      'add       "text": "hello!"',
      "same     }",
      "same   ]",
      "same }",
      "fold ⋯ 1 unchanged: paragraph",
    ]);
    expect(result.lines[1]?.note).toBe("7–14 → 7–15");
  });

  it("shows a split as the shortened node plus one added node", () => {
    const lines = show(diff((tr) => tr.split(10)).lines);
    expect(lines).toContain('del       "text": "hello"');
    expect(lines).toContain('add       "text": "he"');
    expect(lines).toContain('add {"type":"paragraph","content":[{"type":"text","text":"llo"}]}');
  });

  it("shows changed marks and attributes as field changes", () => {
    const bold = show(diff((tr) => tr.addMark(8, 10, schema.mark("strong"))).lines);
    expect(bold).toContain('add       "marks": [{"type":"strong"}]');
    expect(bold).toContain('add       "text": "he"');
    expect(bold).toContain('add     {"type":"text","text":"llo"}');

    const level = show(diff((tr) => tr.setNodeAttribute(0, "level", 2)).lines);
    expect(level).toContain('del   "attrs": {"level":1}');
    expect(level).toContain('add   "attrs": {"level":2}');
    expect(level).not.toContain('del       "text": "Title"');
  });

  it("is empty when only the selection changed", () => {
    const result = diff((tr) => tr.setMeta("noop", true));
    expect(result.lines).toEqual([]);
    expect(result.range).toBeNull();
  });
});
