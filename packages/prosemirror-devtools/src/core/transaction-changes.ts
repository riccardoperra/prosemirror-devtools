import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { Transaction } from "prosemirror-state";
import { Mapping, StepMap } from "prosemirror-transform";

import type { SerializedValue, TransactionRecord } from "./types";

export interface StepChangeRange {
  readonly oldStart: number;
  readonly oldEnd: number;
  readonly newStart: number;
  readonly newEnd: number;
}

export interface StepDocumentChange {
  readonly kind: "content" | "document";
  readonly from: number;
  readonly oldTo: number;
  readonly newTo: number;
  /** Content changes are slices; root markup changes include the complete document. */
  readonly before: SerializedValue;
  readonly after: SerializedValue;
}

export interface RecordedStepDetails {
  readonly index: number;
  readonly ranges: readonly StepChangeRange[];
  readonly documentSizeBefore: number;
  readonly documentSizeAfter: number;
  /** Map index in the same applied transaction, if it mirrors this step. */
  readonly mirror: number | null;
  /** Computed on first inspection, including mark/attribute changes with an empty StepMap. */
  readonly change: StepDocumentChange | null;
}

function documentChange(
  before: ProseMirrorNode,
  after: ProseMirrorNode,
): StepDocumentChange | null {
  if (!before.sameMarkup(after)) {
    return {
      kind: "document",
      from: 0,
      oldTo: before.content.size,
      newTo: after.content.size,
      before: before.toJSON() as SerializedValue,
      after: after.toJSON() as SerializedValue,
    };
  }
  const from = before.content.findDiffStart(after.content);
  if (from === null) return null;
  const end = before.content.findDiffEnd(after.content)!;
  // Identical prefixes/suffixes can overlap after inserting or removing repeated content.
  const overlap = Math.max(0, from - Math.min(end.a, end.b));
  const oldTo = end.a + overlap;
  const newTo = end.b + overlap;
  return {
    kind: "content",
    from,
    oldTo,
    newTo,
    before: before.slice(from, oldTo).toJSON() as SerializedValue,
    after: after.slice(from, newTo).toJSON() as SerializedValue,
  };
}

export function captureStepDetails(transaction: Transaction): readonly RecordedStepDetails[] {
  return transaction.steps.map((_step, index) => {
    const ranges: StepChangeRange[] = [];
    transaction.mapping.maps[index]!.forEach((oldStart, oldEnd, newStart, newEnd) => {
      ranges.push({ oldStart, oldEnd, newStart, newEnd });
    });
    let before: ProseMirrorNode | null = transaction.docs[index]!;
    let after: ProseMirrorNode | null = transaction.docs[index + 1] ?? transaction.doc;
    let change: StepDocumentChange | null | undefined;
    return {
      index,
      ranges,
      documentSizeBefore: before.content.size,
      documentSizeAfter: after.content.size,
      mirror: transaction.mapping.getMirror(index) ?? null,
      get change() {
        if (change === undefined) {
          change = documentChange(before!, after!);
          before = null;
          after = null;
        }
        return change;
      },
    };
  });
}

export interface PositionMappingResult {
  readonly pos: number;
  readonly deleted: boolean;
  readonly deletedBefore: boolean;
  readonly deletedAfter: boolean;
  readonly deletedAcross: boolean;
}

export interface PositionMappingTrace {
  readonly transactionIndex: number;
  readonly stepIndex: number;
  readonly before: number;
  readonly result: PositionMappingResult;
}

function resultSnapshot(result: PositionMappingResult): PositionMappingResult {
  return {
    pos: result.pos,
    deleted: result.deleted,
    deletedBefore: result.deletedBefore,
    deletedAfter: result.deletedAfter,
    deletedAcross: result.deletedAcross,
  };
}

/** Maps only known applied steps; never pretends an unobserved custom dispatch was applied. */
export function mapRecordedPosition(
  record: TransactionRecord,
  position: number,
  assoc: -1 | 1 = 1,
): {
  result: PositionMappingResult;
  trace: readonly PositionMappingTrace[];
} | null {
  if (record.applicationStatus !== "applied" || !Number.isSafeInteger(position) || position < 0)
    return null;
  const transactions = record.transactions;
  if (transactions.some((transaction) => transaction.stepDetails === undefined)) return null;
  const firstStep = transactions.find((transaction) => transaction.stepDetails?.length)
    ?.stepDetails?.[0];
  if (firstStep && position > firstStep.documentSizeBefore) return null;
  const mapping = new Mapping();
  const trace: PositionMappingTrace[] = [];
  let current = resultSnapshot(StepMap.empty.mapResult(position, assoc));
  for (const transaction of transactions) {
    const offset = mapping.maps.length;
    for (const step of transaction.stepDetails ?? []) {
      const before = current.pos;
      const ranges = step.ranges.flatMap((range) => [
        range.oldStart,
        range.oldEnd - range.oldStart,
        range.newEnd - range.newStart,
      ]);
      const map = new StepMap(ranges);
      const mirror =
        step.mirror !== null && step.mirror < step.index ? offset + step.mirror : undefined;
      mapping.appendMap(map, mirror);
      const next = map.mapResult(before, assoc);
      // Ordinary steps are linear in the step count. A newly completed mirror pair needs the
      // complete prefix so ProseMirror can recover positions removed by its earlier inverse.
      current =
        mirror !== undefined
          ? resultSnapshot(mapping.mapResult(position, assoc))
          : {
              pos: next.pos,
              deleted: current.deleted || next.deleted,
              deletedBefore: current.deletedBefore || next.deletedBefore,
              deletedAfter: current.deletedAfter || next.deletedAfter,
              deletedAcross: current.deletedAcross || next.deletedAcross,
            };
      trace.push({
        transactionIndex: transaction.index,
        stepIndex: step.index,
        before,
        result: current,
      });
    }
  }
  return { result: current, trace };
}
