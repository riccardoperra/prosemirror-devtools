import { Fragment, Schema, Slice } from "prosemirror-model";
import { EditorState, Plugin } from "prosemirror-state";
import { Mapping, ReplaceStep } from "prosemirror-transform";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachProseMirrorDevtools,
  createProseMirrorDevtoolsStore,
  mapRecordedPosition,
} from "../src/core";
import { captureStepDetails } from "../src/core/transaction-changes";
import { createTestState, createTestView } from "./helpers";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function fixture(state = createTestState("abcdef")) {
  const store = createProseMirrorDevtoolsStore();
  const view = createTestView(state);
  const attachment = attachProseMirrorDevtools({
    id: "editor",
    view,
    store,
    performanceMarks: false,
  });
  return {
    view,
    record: () => store.getInstance("editor")!.transactions.at(-1)!,
    dispose() {
      attachment.detach();
      view.destroy();
    },
  };
}

describe("recorded step changes", () => {
  it("matches ProseMirror mapping boundaries and association across insert/delete steps", () => {
    const editor = fixture();
    try {
      const transaction = editor.view.state.tr.insertText("xy", 2).delete(5, 7);
      editor.view.dispatch(transaction);
      for (const assoc of [-1, 1] as const) {
        for (let position = 0; position <= transaction.before.content.size; position++) {
          const expected = transaction.mapping.mapResult(position, assoc);
          expect(mapRecordedPosition(editor.record(), position, assoc)?.result).toEqual({
            pos: expected.pos,
            deleted: expected.deleted,
            deletedBefore: expected.deletedBefore,
            deletedAfter: expected.deletedAfter,
            deletedAcross: expected.deletedAcross,
          });
        }
      }
      expect(mapRecordedPosition(editor.record(), -1)).toBeNull();
      expect(mapRecordedPosition(editor.record(), 1.5)).toBeNull();
      expect(mapRecordedPosition(editor.record(), 100)).toBeNull();
    } finally {
      editor.dispose();
    }
  });

  it("maps appended transactions in application order", () => {
    const append = new Plugin({
      appendTransaction(transactions, _old, state) {
        return transactions.some((transaction) => transaction.getMeta("root"))
          ? state.tr.insertText("!", 1)
          : null;
      },
    });
    const editor = fixture(createTestState("abc", [append]));
    try {
      editor.view.dispatch(editor.view.state.tr.insertText("x", 1).setMeta("root", true));
      const mapped = mapRecordedPosition(editor.record(), 2)!;
      expect(mapped.result.pos).toBe(4);
      expect(
        mapped.trace.map((entry) => [
          entry.transactionIndex,
          entry.stepIndex,
          entry.before,
          entry.result.pos,
        ]),
      ).toEqual([
        [0, 0, 2, 3],
        [1, 0, 3, 4],
      ]);
    } finally {
      editor.dispose();
    }
  });

  it("preserves mirror recovery for inverse steps", () => {
    const editor = fixture();
    try {
      const transaction = editor.view.state.tr.delete(2, 4);
      transaction.step(transaction.steps[0]!.invert(transaction.docs[0]!));
      const expectedMapping = new Mapping();
      expectedMapping.appendMap(transaction.mapping.maps[0]!);
      expectedMapping.appendMap(transaction.mapping.maps[1]!, 0);
      vi.spyOn(transaction.mapping, "getMirror").mockImplementation((index) =>
        index === 0 ? 1 : 0,
      );
      editor.view.dispatch(transaction);
      const result = mapRecordedPosition(editor.record(), 3)!;
      expect(result.trace[0]?.result.deleted).toBe(true);
      expect(result.result.pos).toBe(expectedMapping.mapResult(3).pos);
      expect(result.result.deleted).toBe(false);
    } finally {
      editor.dispose();
    }
  });

  it("captures unregistered custom steps without reconstructing their JSON", () => {
    class CustomReplaceStep extends ReplaceStep {
      override toJSON() {
        return { ...super.toJSON(), stepType: "unregistered-custom" };
      }
    }
    const editor = fixture();
    try {
      const transaction = editor.view.state.tr.step(
        new CustomReplaceStep(
          2,
          3,
          new Slice(Fragment.from(editor.view.state.schema.text("XYZ")), 0, 0),
        ),
      );
      editor.view.dispatch(transaction);
      expect(mapRecordedPosition(editor.record(), 5)?.result.pos).toBe(7);
      expect(editor.record().transactions[0]?.stepDetails?.[0]?.change?.after).toMatchObject({
        content: [{ type: "text", text: "XYZ" }],
      });
    } finally {
      editor.dispose();
    }
  });

  it("computes mark diffs lazily even when the step map has no ranges", () => {
    const schema = new Schema({
      nodes: { doc: { content: "text*" }, text: {} },
      marks: { strong: {} },
    });
    const state = EditorState.create({ schema, doc: schema.node("doc", null, schema.text("abc")) });
    const transaction = state.tr.addMark(0, 3, schema.mark("strong"));
    const findDiff = vi.spyOn(transaction.before.content, "findDiffStart");
    const details = captureStepDetails(transaction);
    expect(findDiff).not.toHaveBeenCalled();
    expect(details[0]?.ranges).toEqual([]);
    expect(details[0]?.change?.after).toMatchObject({ content: [{ marks: [{ type: "strong" }] }] });
    expect(details[0]?.change).toBe(details[0]?.change);
    expect(findDiff).toHaveBeenCalledOnce();
  });

  it("handles overlapping identical prefixes and suffixes in insertions", () => {
    const state = createTestState("aaa");
    const detail = captureStepDetails(state.tr.insertText("a", 2))[0]!;
    expect(detail.change).toMatchObject({
      oldTo: detail.change!.from,
      newTo: detail.change!.from + 1,
    });
  });

  it("includes root document attribute changes with empty step maps", () => {
    const schema = new Schema({
      nodes: { doc: { content: "text*", attrs: { revision: { default: 0 } } }, text: {} },
    });
    const state = EditorState.create({ schema, doc: schema.node("doc", null, schema.text("abc")) });
    const detail = captureStepDetails(state.tr.setDocAttribute("revision", 1))[0]!;
    expect(detail.ranges).toEqual([]);
    expect(detail.change).toMatchObject({
      kind: "document",
      before: { type: "doc", attrs: { revision: 0 } },
      after: { type: "doc", attrs: { revision: 1 } },
    });
  });

  it("does not map filtered or unknown custom dispatch outcomes", () => {
    const editor = fixture(
      createTestState("abc", [new Plugin({ filterTransaction: () => false })]),
    );
    try {
      editor.view.dispatch(editor.view.state.tr.insertText("x", 1));
      expect(mapRecordedPosition(editor.record(), 1)).toBeNull();
      expect(
        mapRecordedPosition({ ...editor.record(), applicationStatus: "unknown" }, 1),
      ).toBeNull();
    } finally {
      editor.dispose();
    }
  });
});
