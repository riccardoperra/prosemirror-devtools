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
}>;

export type DocumentDiff = Readonly<{
  lines: readonly DiffLine[];
  /** The changed region: `from` in both documents, `oldTo` before, `newTo` after. */
  range: { from: number; oldTo: number; newTo: number } | null;
  truncated: boolean;
}>;

const MAX_LINES = 400;
const MAX_LINE = 160;

class LineWriter {
  readonly lines: DiffLine[] = [];
  truncated = false;

  push(line: DiffLine): void {
    if (this.lines.length >= MAX_LINES) {
      this.truncated = true;
      return;
    }
    if (line.text.length > MAX_LINE) {
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

function wholeNode(
  out: LineWriter,
  kind: "add" | "del",
  depth: number,
  node: ProseMirrorNode,
  pos: number,
): void {
  out.push({ kind, depth, text: json(node.toJSON()), note: range(pos, node) });
}

function children(fragment: Fragment, start: number): { node: ProseMirrorNode; pos: number }[] {
  const result: { node: ProseMirrorNode; pos: number }[] = [];
  fragment.forEach((node, offset) => result.push({ node, pos: start + offset }));
  return result;
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
  const removed = left.slice(prefix, left.length - suffix);
  const added = right.slice(prefix, right.length - suffix);
  const paired = Math.min(removed.length, added.length);
  for (let index = 0; index < paired; index++) {
    const before = removed[index]!;
    const after = added[index]!;
    if (before.node.type === after.node.type) {
      diffNode(out, depth, before.node, before.pos, after.node, after.pos);
    } else {
      wholeNode(out, "del", depth, before.node, before.pos);
      wholeNode(out, "add", depth, after.node, after.pos);
    }
  }
  for (const { node, pos } of removed.slice(paired)) wholeNode(out, "del", depth, node, pos);
  for (const { node, pos } of added.slice(paired)) wholeNode(out, "add", depth, node, pos);
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
  if (!sameAttrs(a, b)) {
    out.push({ kind: "del", depth: depth + 1, text: `"attrs": ${json(a.attrs)}` });
    out.push({ kind: "add", depth: depth + 1, text: `"attrs": ${json(b.attrs)}` });
  }
  if (!Mark.sameSet(a.marks, b.marks)) {
    out.push({
      kind: "del",
      depth: depth + 1,
      text: `"marks": ${json(a.marks.map((m) => m.toJSON()))}`,
    });
    out.push({
      kind: "add",
      depth: depth + 1,
      text: `"marks": ${json(b.marks.map((m) => m.toJSON()))}`,
    });
  }
  if (a.isText && a.text !== b.text) {
    out.push({ kind: "del", depth: depth + 1, text: `"text": ${JSON.stringify(a.text)}` });
    out.push({ kind: "add", depth: depth + 1, text: `"text": ${JSON.stringify(b.text)}` });
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
    wholeNode(out, "del", 0, before, 0);
    wholeNode(out, "add", 0, after, 0);
  } else if (!before.eq(after)) {
    if (!sameAttrs(before, after)) {
      out.push({ kind: "del", depth: 0, text: `"attrs": ${json(before.attrs)}` });
      out.push({ kind: "add", depth: 0, text: `"attrs": ${json(after.attrs)}` });
    }
    if (!before.content.eq(after.content))
      diffFragment(out, 0, before.content, 0, after.content, 0);
  }
  return { lines: out.lines, range: changedRange(before, after), truncated: out.truncated };
}
