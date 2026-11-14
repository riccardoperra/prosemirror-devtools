import type { Node as ProseMirrorNode } from "prosemirror-model";

import { nodeNames, readLineItem } from "./document";
import { isPageKind, pageKinds, validateLineItem } from "./model";

/** Where a jump puts the selection: a NodeSelection, or the nearest text position. */
export type OutlineTarget =
  | { readonly kind: "node"; readonly pos: number }
  | { readonly kind: "text"; readonly pos: number };

export interface OutlineEntry {
  /** Index path, stable while typing, so React keeps each row. */
  readonly id: string;
  readonly label: string;
  /** The node that the spotlight outlines and the scroll brings into view. */
  readonly pos: number;
  /** Selections in [from, to) belong to this entry. Headings own the blocks up to the next entry. */
  readonly from: number;
  readonly to: number;
  readonly target: OutlineTarget;
  readonly issues: number;
  readonly openComments: number;
  readonly children: readonly OutlineEntry[];
}

interface BlockStats {
  readonly issues: number;
  readonly openCommentIds: readonly string[];
}

/** Typing changes one block, so every other block's stats are reused across documents. */
const statsByBlock = new WeakMap<ProseMirrorNode, BlockStats>();

function blockStats(block: ProseMirrorNode): BlockStats {
  const cached = statsByBlock.get(block);
  if (cached) return cached;
  let issues = 0;
  const openCommentIds = new Set<string>();
  block.descendants((node) => {
    if (node.type.name === nodeNames.lineItem && validateLineItem(readLineItem(node)).length > 0) {
      issues += 1;
    }
    for (const mark of node.marks) {
      if (mark.type.name === "comment" && !mark.attrs.resolved) openCommentIds.add(mark.attrs.id);
    }
    return true;
  });
  const stats = { issues, openCommentIds: [...openCommentIds] };
  statsByBlock.set(block, stats);
  return stats;
}

type SectionRule = {
  readonly label: (node: ProseMirrorNode) => string;
  readonly target: (node: ProseMirrorNode, pos: number) => OutlineTarget;
};

const atom = (_node: ProseMirrorNode, pos: number): OutlineTarget => ({ kind: "node", pos });
const firstChild = (_node: ProseMirrorNode, pos: number): OutlineTarget => ({
  kind: "node",
  pos: pos + 1,
});
const inside = (_node: ProseMirrorNode, pos: number): OutlineTarget => ({
  kind: "text",
  pos: pos + 1,
});

const sectionRules: Readonly<Record<string, SectionRule>> = {
  [nodeNames.meta]: { label: () => "Invoice details", target: atom },
  [nodeNames.parties]: { label: () => "Parties", target: inside },
  [nodeNames.lineItems]: {
    label: (node) => `Line items · ${node.childCount} ${node.childCount === 1 ? "row" : "rows"}`,
    target: firstChild,
  },
  [nodeNames.totals]: { label: () => "Totals", target: atom },
  [nodeNames.timesheet]: { label: () => "Timesheet", target: atom },
  [nodeNames.paymentSchedule]: { label: () => "Schedule", target: atom },
  [nodeNames.signatures]: { label: () => "Signatures", target: firstChild },
  heading: { label: (node) => node.textContent || "Untitled heading", target: inside },
};

function pageLabel(page: ProseMirrorNode, index: number): string {
  const kind = String(page.attrs.kind);
  return `Page ${index + 1} · ${isPageKind(kind) ? pageKinds[kind].title : kind}`;
}

function sumStats(
  blocks: readonly ProseMirrorNode[],
): Pick<OutlineEntry, "issues" | "openComments"> {
  let issues = 0;
  const comments = new Set<string>();
  for (const block of blocks) {
    const stats = blockStats(block);
    issues += stats.issues;
    for (const id of stats.openCommentIds) comments.add(id);
  }
  return { issues, openComments: comments.size };
}

function readPage(page: ProseMirrorNode, pagePos: number, pageIndex: number): OutlineEntry {
  const blocks: { node: ProseMirrorNode; pos: number }[] = [];
  page.forEach((node, offset) => blocks.push({ node, pos: pagePos + 1 + offset }));
  const listed = blocks.flatMap((block, index) =>
    Object.hasOwn(sectionRules, block.node.type.name) ? [index] : [],
  );
  const children = listed.map((blockIndex, order): OutlineEntry => {
    const { node, pos } = blocks[blockIndex]!;
    const rule = sectionRules[node.type.name]!;
    const isHeading = node.type.name === "heading";
    const lastIndex = isHeading ? (listed[order + 1] ?? blocks.length) - 1 : blockIndex;
    const owned = blocks.slice(blockIndex, lastIndex + 1);
    const last = owned.at(-1)!;
    return {
      id: `${pageIndex}.${blockIndex}`,
      label: rule.label(node),
      pos,
      from: pos,
      to: last.pos + last.node.nodeSize,
      target: rule.target(node, pos),
      ...sumStats(owned.map((block) => block.node)),
      children: [],
    };
  });
  return {
    id: String(pageIndex),
    label: pageLabel(page, pageIndex),
    pos: pagePos,
    from: pagePos,
    to: pagePos + page.nodeSize,
    target: { kind: "text", pos: pagePos + 1 },
    ...sumStats(blocks.map((block) => block.node)),
    children,
  };
}

const outlines = new WeakMap<ProseMirrorNode, readonly OutlineEntry[]>();

/** Pages, then the sections and headings inside each, with validation and open-comment counts. */
export function readOutline(doc: ProseMirrorNode): readonly OutlineEntry[] {
  const cached = outlines.get(doc);
  if (cached) return cached;
  const entries: OutlineEntry[] = [];
  doc.forEach((page, pos, index) => entries.push(readPage(page, pos, index)));
  outlines.set(doc, entries);
  return entries;
}

const signatures = new WeakMap<readonly OutlineEntry[], string>();

/** Everything the outline renders, so a view can skip updates where only positions moved. */
export function outlineSignature(outline: readonly OutlineEntry[]): string {
  const cached = signatures.get(outline);
  if (cached !== undefined) return cached;
  const parts: string[] = [];
  const add = (entry: OutlineEntry) =>
    parts.push(`${entry.id}\u0000${entry.label}\u0000${entry.issues}\u0000${entry.openComments}`);
  for (const page of outline) {
    add(page);
    page.children.forEach(add);
  }
  const signature = parts.join("\u0001");
  signatures.set(outline, signature);
  return signature;
}

/** The deepest entry whose range holds the position. */
export function findOutlineEntry(
  outline: readonly OutlineEntry[],
  pos: number,
): OutlineEntry | null {
  const page = outline.find((entry) => pos >= entry.from && pos < entry.to);
  if (!page) return null;
  return page.children.find((entry) => pos >= entry.from && pos < entry.to) ?? page;
}

export function outlineEntryById(
  outline: readonly OutlineEntry[],
  id: string,
): OutlineEntry | null {
  const [pageId] = id.split(".");
  const page = outline[Number(pageId)];
  if (!page) return null;
  return page.id === id ? page : (page.children.find((entry) => entry.id === id) ?? null);
}
