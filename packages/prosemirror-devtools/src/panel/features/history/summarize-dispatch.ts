import { Slice, type Node as ProseMirrorNode } from "prosemirror-model";
import { Step } from "prosemirror-transform";

import { getRecordedTransactionDocument } from "../../../core/store/transaction-record";
import type { AppliedTransactionRecord, TransactionRecord } from "../../../core/types";

/** One step in words: `insert "x" at 92`. `subject` is quoted text or a type name. */
export type StepSummary = Readonly<{
  action: string;
  subject: string | null;
  at: string;
  stepType: string;
}>;

export type TransactionSummary = Readonly<{
  transaction: AppliedTransactionRecord;
  steps: readonly StepSummary[];
}>;

const MAX_TEXT = 40;

type StepJSON = Record<string, unknown> & { stepType?: unknown };

function quote(text: string): string {
  const flat = text.replace(/\n/g, "↵");
  return JSON.stringify(flat.length > MAX_TEXT ? `${flat.slice(0, MAX_TEXT)}…` : flat);
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function range(from: number | null, to: number | null): string {
  if (from === null) return "";
  return to === null || to === from ? `at ${from}` : `${from}–${to}`;
}

function textBetween(doc: ProseMirrorNode | null, from: number, to: number): string | null {
  if (!doc || from < 0 || to > doc.content.size || from >= to) return null;
  return doc.textBetween(from, to, "\n", "￼");
}

function topLevelNames(slice: Slice): string {
  const names: string[] = [];
  slice.content.forEach((node) => names.push(node.type.name));
  const unique = [...new Set(names)];
  return unique.length > 3 ? `${unique.slice(0, 3).join(", ")}…` : unique.join(", ");
}

/** The inserted content: its text when it is text, else the node types it adds. */
function describeSlice(slice: Slice): string {
  const text = slice.content.textBetween(0, slice.content.size, "\n", "￼");
  let inline = true;
  slice.content.forEach((node) => {
    if (!node.isInline) inline = false;
  });
  const opened = slice.openStart > 0 || slice.openEnd > 0;
  if (text && (inline || opened)) return quote(text);
  return topLevelNames(slice) || "nothing";
}

function readSlice(json: unknown, doc: ProseMirrorNode | null): Slice | null {
  if (!doc) return null;
  try {
    return Slice.fromJSON(doc.type.schema, json as never);
  } catch {
    return null;
  }
}

/** The text in a slice's JSON, for records whose documents are no longer available. */
function jsonText(json: unknown): string | null {
  let text = "";
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    const node = value as { text?: unknown; content?: unknown };
    if (typeof node.text === "string") text += node.text;
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };
  visit(json);
  return text ? quote(text) : null;
}

function markName(json: unknown): string {
  if (json && typeof json === "object" && "type" in json) return String(json.type);
  return "mark";
}

function preview(value: unknown): string {
  if (typeof value === "string") return quote(value);
  try {
    const text = JSON.stringify(value);
    return text === undefined
      ? String(value)
      : text.length > MAX_TEXT
        ? `${text.slice(0, MAX_TEXT)}…`
        : text;
  } catch {
    return String(value);
  }
}

function summarizeReplace(json: StepJSON, doc: ProseMirrorNode | null): StepSummary {
  const from = num(json.from) ?? 0;
  const to = num(json.to) ?? from;
  const slice = json.slice ? readSlice(json.slice, doc) : Slice.empty;
  const hasContent = json.slice !== undefined && (slice === null || slice.size > 0);
  const removed = textBetween(doc, from, to);
  const base = { stepType: "replace" };

  if (!hasContent) {
    if (doc && from < to) {
      const $from = doc.resolve(from);
      const $to = doc.resolve(to);
      // Only block boundaries in between: joining two blocks, as Backspace at a block start does.
      if (!$from.sameParent($to) && doc.textBetween(from, to, "", "￼") === "") {
        return { ...base, action: "join", subject: $from.parent.type.name, at: `at ${from}` };
      }
    }
    return {
      ...base,
      action: "delete",
      subject: removed ? quote(removed) : null,
      at: range(from, to),
    };
  }
  if (!slice)
    return {
      ...base,
      action: from === to ? "insert" : "replace",
      subject: jsonText(json.slice),
      at: range(from, to),
    };
  if (
    from === to &&
    slice.openStart > 0 &&
    slice.openEnd > 0 &&
    slice.content.childCount === 2 &&
    slice.content.textBetween(0, slice.content.size) === ""
  ) {
    return {
      ...base,
      action: "split",
      subject: slice.content.firstChild!.type.name,
      at: `at ${from}`,
    };
  }
  if (from === to)
    return { ...base, action: "insert", subject: describeSlice(slice), at: `at ${from}` };
  return {
    ...base,
    action: "replace",
    subject: `${removed ? quote(removed) : "content"} → ${describeSlice(slice)}`,
    at: range(from, to),
  };
}

function summarizeReplaceAround(json: StepJSON, doc: ProseMirrorNode | null): StepSummary {
  const from = num(json.from) ?? 0;
  const to = num(json.to) ?? from;
  const gapFrom = num(json.gapFrom) ?? from;
  const gapTo = num(json.gapTo) ?? to;
  const slice = json.slice ? readSlice(json.slice, doc) : null;
  const base = { stepType: "replaceAround", at: range(from, to) };
  const first = slice?.content.firstChild;
  if (gapFrom === from + 1 && gapTo === to - 1 && first && slice.content.childCount === 1) {
    const old = doc?.nodeAt(from)?.type.name;
    return {
      ...base,
      action: "change",
      subject: old ? `${old} → ${first.type.name}` : first.type.name,
    };
  }
  if (gapFrom === from && gapTo === to && first)
    return { ...base, action: "wrap in", subject: first.type.name };
  if (gapFrom > from || gapTo < to) {
    const parent = doc && from <= doc.content.size ? doc.nodeAt(from)?.type.name : undefined;
    return { ...base, action: "lift", subject: parent ? `out of ${parent}` : null };
  }
  return { ...base, action: "replace around", subject: null };
}

export function summarizeStep(json: unknown, doc: ProseMirrorNode | null): StepSummary {
  const step = (json && typeof json === "object" ? json : {}) as StepJSON;
  const stepType = typeof step.stepType === "string" ? step.stepType : "unknown";
  const from = num(step.from);
  const to = num(step.to);
  const pos = num(step.pos);
  switch (stepType) {
    case "replace":
      return summarizeReplace(step, doc);
    case "replaceAround":
      return summarizeReplaceAround(step, doc);
    case "addMark":
    case "removeMark":
      return {
        stepType,
        action: stepType === "addMark" ? "add mark" : "remove mark",
        subject: markName(step.mark),
        at: range(from, to),
      };
    case "addNodeMark":
    case "removeNodeMark":
      return {
        stepType,
        action: stepType === "addNodeMark" ? "add node mark" : "remove node mark",
        subject: markName(step.mark),
        at: range(pos, null),
      };
    case "attr": {
      const node = doc && pos !== null ? doc.nodeAt(pos)?.type.name : undefined;
      return {
        stepType,
        action: "set",
        subject: `${node ? `${node}.` : ""}${String(step.attr)} = ${preview(step.value)}`,
        at: range(pos, null),
      };
    }
    case "docAttr":
      return {
        stepType,
        action: "set",
        subject: `doc.${String(step.attr)} = ${preview(step.value)}`,
        at: "",
      };
    default:
      return { stepType, action: stepType, subject: null, at: range(from ?? pos, to) };
  }
}

/** Replays the recorded steps from the document before the dispatch, so each step reads its own input. */
export function summarizeTransactions(record: TransactionRecord): TransactionSummary[] {
  let doc = getRecordedTransactionDocument(record, "before") ?? null;
  return record.transactions.map((transaction) => ({
    transaction,
    steps: transaction.steps.map((json) => {
      const summary = summarizeStep(json, doc);
      if (doc) {
        try {
          doc = Step.fromJSON(doc.type.schema, json as never).apply(doc).doc ?? null;
        } catch {
          doc = null;
        }
      }
      return summary;
    }),
  }));
}

export function formatStep(step: StepSummary): string {
  return [step.action, step.subject, step.at].filter(Boolean).join(" ");
}

/** A selection's JSON in words: `cursor 92`, `text 66–78`, `node 10`, `all`. */
export function describeSelection(value: unknown): string {
  if (!value || typeof value !== "object") return "unknown";
  const json = value as Record<string, unknown>;
  const anchor = num(json.anchor);
  const head = num(json.head);
  switch (json.type) {
    case "text":
      if (anchor === null) return "text";
      if (head === null || anchor === head) return `cursor ${anchor}`;
      return anchor < head ? `text ${anchor}–${head}` : `text ${head}–${anchor} backward`;
    case "node":
      return `node ${anchor ?? ""}`.trim();
    case "all":
      return "all";
    default: {
      const pos = num(json.pos) ?? anchor;
      return `${String(json.type ?? "selection")}${pos === null ? "" : ` ${pos}`}`;
    }
  }
}

export type DispatchHeadline = Readonly<{
  /** The first step, when the dispatch has one. */
  step: StepSummary | null;
  /** The headline as plain text, for labels. */
  title: string;
  /** Steps after the first. */
  more: number;
}>;

/** The headline of a dispatch: its first step, or what it set when it has none. */
export function summarizeDispatch(
  record: TransactionRecord,
  transactions: readonly TransactionSummary[] = summarizeTransactions(record),
): DispatchHeadline {
  const plain = (title: string): DispatchHeadline => ({ step: null, title, more: 0 });
  if (record.applicationStatus === "filtered" || record.filtered) return plain("filtered");
  const steps = transactions.flatMap((transaction) => transaction.steps);
  const first = steps[0];
  if (first) return { step: first, title: formatStep(first), more: steps.length - 1 };
  if (record.selectionSet) {
    const step = {
      action: "select",
      subject: describeSelection(record.selectionAfter),
      at: "",
      stepType: "selection",
    };
    return { step, title: formatStep(step), more: 0 };
  }
  if (record.storedMarksSet) return plain("set stored marks");
  const meta = transactions.flatMap(({ transaction }) => Object.keys(transaction.meta));
  if (meta.length > 0) return plain(`meta ${[...new Set(meta)].join(", ")}`);
  return plain("no change");
}

/** Who produced an applied transaction: the dispatch itself, or a plugin's appendTransaction. */
export function transactionOrigin(
  record: TransactionRecord,
  transaction: AppliedTransactionRecord,
): { label: string; pluginKey: string | null } {
  if (!transaction.appended) return { label: "Root transaction", pluginKey: null };
  const provenance = record.inspection?.provenance;
  const origin = provenance?.transactions.find(
    (entry) => entry.appliedIndex === transaction.index,
  )?.origin;
  if (origin?.kind !== "append") return { label: "Appended transaction", pluginKey: null };
  const label =
    provenance?.appends.find((entry) => entry.pluginKey === origin.pluginKey)?.pluginLabel ??
    record.timings.find((timing) => timing.pluginKey === origin.pluginKey)?.pluginLabel ??
    origin.pluginKey;
  return { label: `Appended by ${label}`, pluginKey: origin.pluginKey };
}
