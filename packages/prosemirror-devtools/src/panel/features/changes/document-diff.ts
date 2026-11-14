import { Mark, type Fragment, type Node as ProseMirrorNode } from "prosemirror-model";

/**
 * A structural diff of two ProseMirror documents, written as JSON lines. Unchanged siblings fold
 * into one line, changed nodes open down to the fields that differ, and added or removed nodes
 * appear as one compact line each.
 */
export type DiffLine = Readonly<{
  kind: "same" | "add" | "del" | "fold";
  depth: number;
  text: string;
  /** Positions the line refers to, shown muted after it. */
  note?: string;
  /** The untruncated text, when `text` was shortened. */
  full?: string;
  /** The changed characters of a field change, as `[start, end)` offsets into `text`. */
  highlight?: readonly [number, number];
}>;

export type DocumentDiff = Readonly<{
  lines: readonly DiffLine[];
  /** The changed region: `from` in both documents, `oldTo` before, `newTo` after. */
  range: { from: number; oldTo: number; newTo: number } | null;
  truncated: boolean;
}>;

const MAX_LINES = 400;
const MAX_LINE = 160;
/** Characters kept around a change when a long field change is cropped. */
const CONTEXT = 48;
/** Above this many child pairs, children are paired in order instead of aligned. */
const MAX_ALIGN = 4096;

class LineWriter {
  readonly lines: DiffLine[] = [];
  truncated = false;

  push(line: DiffLine): void {
    if (this.lines.length >= MAX_LINES) {
      this.truncated = true;
      return;
    }
    if (line.text.length > MAX_LINE && !line.highlight) {
      this.lines.push({ ...line, text: `${line.text.slice(0, MAX_LINE)}…`, full: line.text });
    } else this.lines.push(line);
  }
}

function json(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function sameAttrs(a: ProseMirrorNode, b: ProseMirrorNode): boolean {
  return json(a.attrs) === json(b.attrs);
}

function label(node: ProseMirrorNode): string {
  if (!node.isText) return node.type.name;
  const text = node.text ?? "";
  return JSON.stringify(text.length > 20 ? `${text.slice(0, 20)}…` : text);
}

/** Lengths of the common prefix and of the common suffix after it. */
function commonEnds(a: string, b: string): [number, number] {
  const limit = Math.min(a.length, b.length);
  let prefix = 0;
  while (prefix < limit && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (suffix < limit - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++;
  return [prefix, suffix];
}

/** One side of a field change, cropped around the change when it is long. */
function fieldLine(
  kind: "add" | "del",
  depth: number,
  key: string,
  value: string,
  start: number,
  end: number,
): DiffLine {
  const head = `"${key}": `;
  let text = value;
  let from = start;
  let to = end;
  if (value.length > MAX_LINE) {
    const cropStart = Math.max(0, start - CONTEXT);
    const cropEnd = Math.min(value.length, Math.max(end, start) + CONTEXT);
    const before = cropStart > 0 ? "…" : "";
    text = `${before}${value.slice(cropStart, cropEnd)}${cropEnd < value.length ? "…" : ""}`;
    from = start - cropStart + before.length;
    to = end - cropStart + before.length;
  }
  return {
    kind,
    depth,
    text: head + text,
    highlight: [head.length + from, head.length + to],
    ...(text === value ? {} : { full: head + value }),
  };
}

/** A field that differs: the old and the new value, with the changed characters marked. */
function fieldChange(out: LineWriter, depth: number, key: string, before: string, after: string) {
  const [prefix, suffix] = commonEnds(before, after);
  out.push(fieldLine("del", depth, key, before, prefix, before.length - suffix));
  out.push(fieldLine("add", depth, key, after, prefix, after.length - suffix));
}

function fold(out: LineWriter, depth: number, nodes: readonly ProseMirrorNode[]): void {
  if (nodes.length === 0) return;
  const names = nodes.slice(0, 4).map(label).join(", ");
  out.push({
    kind: "fold",
    depth,
    text: `⋯ ${nodes.length} unchanged: ${names}${nodes.length > 4 ? ", …" : ""}`,
  });
}

function range(pos: number, node: ProseMirrorNode): string {
  return `${pos}–${pos + node.nodeSize}`;
}

type Positioned = { node: ProseMirrorNode; pos: number };

function wholeNode(out: LineWriter, kind: "add" | "del", depth: number, entry: Positioned): void {
  out.push({ kind, depth, text: json(entry.node.toJSON()), note: range(entry.pos, entry.node) });
}

function children(fragment: Fragment, start: number): Positioned[] {
  const result: Positioned[] = [];
  fragment.forEach((node, offset) => result.push({ node, pos: start + offset }));
  return result;
}

/**
 * How alike two siblings are: 0 for different types, 3 when equal, else between 1 and 2.5 by
 * shared text at the ends and equal marks. Pairs above 0 are diffed field by field.
 */
function similarity(a: ProseMirrorNode, b: ProseMirrorNode): number {
  if (a === b || a.eq(b)) return 3;
  if (a.type !== b.type) return 0;
  const left = a.textContent;
  const right = b.textContent;
  const longest = Math.max(left.length, right.length);
  const [prefix, suffix] = commonEnds(left, right);
  const text = longest === 0 ? 1 : (prefix + suffix) / longest;
  return 1 + text + (Mark.sameSet(a.marks, b.marks) ? 0.5 : 0);
}

type Operation =
  | { kind: "pair"; before: Positioned; after: Positioned }
  | { kind: "del"; entry: Positioned }
  | { kind: "add"; entry: Positioned };

/**
 * Aligns two runs of siblings so that equal and similar nodes face each other, as a weighted
 * longest common subsequence. Unmatched nodes are additions or removals.
 */
function align(removed: readonly Positioned[], added: readonly Positioned[]): Operation[] {
  const rows = removed.length;
  const columns = added.length;
  if (rows * columns > MAX_ALIGN) {
    const operations: Operation[] = [];
    const paired = Math.min(rows, columns);
    for (let index = 0; index < paired; index++) {
      operations.push({ kind: "pair", before: removed[index]!, after: added[index]! });
    }
    removed.slice(paired).forEach((entry) => operations.push({ kind: "del", entry }));
    added.slice(paired).forEach((entry) => operations.push({ kind: "add", entry }));
    return operations;
  }
  const scores = Array.from({ length: rows + 1 }, () => new Float64Array(columns + 1));
  const weights = removed.map((left) => added.map((right) => similarity(left.node, right.node)));
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = columns - 1; j >= 0; j--) {
      const weight = weights[i]![j]!;
      scores[i]![j] = Math.max(
        scores[i + 1]![j]!,
        scores[i]![j + 1]!,
        weight > 0 ? weight + scores[i + 1]![j + 1]! : 0,
      );
    }
  }
  const operations: Operation[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < columns) {
    const weight = weights[i]![j]!;
    if (weight > 0 && scores[i]![j] === weight + scores[i + 1]![j + 1]!) {
      operations.push({ kind: "pair", before: removed[i++]!, after: added[j++]! });
    } else if (scores[i + 1]![j]! >= scores[i]![j + 1]!) {
      operations.push({ kind: "del", entry: removed[i++]! });
    } else {
      operations.push({ kind: "add", entry: added[j++]! });
    }
  }
  while (i < rows) operations.push({ kind: "del", entry: removed[i++]! });
  while (j < columns) operations.push({ kind: "add", entry: added[j++]! });
  return operations;
}

function diffFragment(
  out: LineWriter,
  depth: number,
  a: Fragment,
  aStart: number,
  b: Fragment,
  bStart: number,
): void {
  const left = children(a, aStart);
  const right = children(b, bStart);
  const same = (i: number, j: number): boolean =>
    left[i]!.node === right[j]!.node || left[i]!.node.eq(right[j]!.node);
  let prefix = 0;
  while (prefix < left.length && prefix < right.length && same(prefix, prefix)) prefix++;
  let suffix = 0;
  while (
    suffix < left.length - prefix &&
    suffix < right.length - prefix &&
    same(left.length - 1 - suffix, right.length - 1 - suffix)
  )
    suffix++;

  fold(
    out,
    depth,
    left.slice(0, prefix).map(({ node }) => node),
  );
  // Equal nodes inside the changed run fold too, grouped while they are consecutive.
  let unchanged: ProseMirrorNode[] = [];
  const flush = (): void => {
    fold(out, depth, unchanged);
    unchanged = [];
  };
  for (const operation of align(
    left.slice(prefix, left.length - suffix),
    right.slice(prefix, right.length - suffix),
  )) {
    if (operation.kind === "pair" && operation.before.node.eq(operation.after.node)) {
      unchanged.push(operation.before.node);
      continue;
    }
    flush();
    if (operation.kind === "pair") {
      const { before, after } = operation;
      diffNode(out, depth, before.node, before.pos, after.node, after.pos);
    } else wholeNode(out, operation.kind, depth, operation.entry);
  }
  flush();
  fold(
    out,
    depth,
    left.slice(left.length - suffix).map(({ node }) => node),
  );
}

/** Two nodes of the same type that differ: open the node and show only what changed. */
function diffNode(
  out: LineWriter,
  depth: number,
  a: ProseMirrorNode,
  aPos: number,
  b: ProseMirrorNode,
  bPos: number,
): void {
  const oldRange = range(aPos, a);
  const newRange = range(bPos, b);
  out.push({
    kind: "same",
    depth,
    text: `{ "type": ${JSON.stringify(a.type.name)}`,
    note: oldRange === newRange ? oldRange : `${oldRange} → ${newRange}`,
  });
  if (!sameAttrs(a, b)) fieldChange(out, depth + 1, "attrs", json(a.attrs), json(b.attrs));
  if (!Mark.sameSet(a.marks, b.marks)) {
    const marks = (node: ProseMirrorNode) => json(node.marks.map((mark) => mark.toJSON()));
    fieldChange(out, depth + 1, "marks", marks(a), marks(b));
  }
  if (a.isText && a.text !== b.text) {
    fieldChange(out, depth + 1, "text", JSON.stringify(a.text), JSON.stringify(b.text));
  }
  if (!a.isText && !a.content.eq(b.content)) {
    out.push({ kind: "same", depth: depth + 1, text: `"content": [` });
    diffFragment(out, depth + 2, a.content, aPos + 1, b.content, bPos + 1);
    out.push({ kind: "same", depth: depth + 1, text: "]" });
  }
  out.push({ kind: "same", depth, text: "}" });
}

/** The region the two documents differ in, as ProseMirror's own content diff finds it. */
function changedRange(before: ProseMirrorNode, after: ProseMirrorNode): DocumentDiff["range"] {
  const from = before.content.findDiffStart(after.content);
  if (from === null) return null;
  const end = before.content.findDiffEnd(after.content)!;
  // Identical prefixes and suffixes can overlap after inserting or removing repeated content.
  const overlap = Math.max(0, from - Math.min(end.a, end.b));
  return { from, oldTo: end.a + overlap, newTo: end.b + overlap };
}

export function diffDocuments(before: ProseMirrorNode, after: ProseMirrorNode): DocumentDiff {
  const out = new LineWriter();
  if (before.type !== after.type) {
    wholeNode(out, "del", 0, { node: before, pos: 0 });
    wholeNode(out, "add", 0, { node: after, pos: 0 });
  } else if (!before.eq(after)) {
    if (!sameAttrs(before, after)) {
      fieldChange(out, 0, "attrs", json(before.attrs), json(after.attrs));
    }
    if (!before.content.eq(after.content))
      diffFragment(out, 0, before.content, 0, after.content, 0);
  }
  return { lines: out.lines, range: changedRange(before, after), truncated: out.truncated };
}
