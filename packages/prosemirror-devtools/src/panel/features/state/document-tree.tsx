import type { Node as ProseMirrorNode } from "prosemirror-model";
import { memo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import { Badge } from "../../ui/badge";

export type DocumentSelectionRange = Readonly<{
  empty: boolean;
  from: number;
  to: number;
}>;

type SelectionCoverage = "full" | "partial" | null;

export function getDocumentNodeRange(
  node: ProseMirrorNode,
  pos: number,
  isRoot = false,
): { from: number; to: number } {
  return {
    from: pos,
    to: isRoot ? node.content.size : pos + node.nodeSize,
  };
}

function getSelectionCoverage(
  node: ProseMirrorNode,
  pos: number,
  isRoot: boolean,
  selection: DocumentSelectionRange,
): SelectionCoverage {
  if (selection.empty) return null;

  const range = getDocumentNodeRange(node, pos, isRoot);
  if (selection.to <= range.from || selection.from >= range.to) return null;

  const contentFrom = isRoot || node.isText || node.isLeaf ? range.from : range.from + 1;
  const contentTo = isRoot || node.isText || node.isLeaf ? range.to : range.to - 1;

  return selection.from <= contentFrom && selection.to >= contentTo ? "full" : "partial";
}

export const DocumentTree = memo(function DocumentTree({
  node,
  pos,
  depth,
  selectedPosition,
  selectedRoot,
  selection,
  onSelect,
  onReveal,
  onSelectNode,
}: {
  node: ProseMirrorNode;
  pos: number;
  depth: number;
  selectedPosition: number;
  selectedRoot: boolean;
  selection: DocumentSelectionRange;
  onSelect: (node: ProseMirrorNode, pos: number) => void;
  onReveal: (pos: number) => void;
  onSelectNode: (node: ProseMirrorNode, pos: number) => void;
}): ReactElement {
  const [expanded, setExpanded] = useState(depth < 2 && node.childCount <= 50);
  const children: ReactElement[] = [];
  const isRoot = depth === 0;
  const range = getDocumentNodeRange(node, pos, isRoot);
  const selectionCoverage = getSelectionCoverage(node, pos, isRoot, selection);

  if (expanded) {
    node.forEach((child, offset, index) => {
      const childPos = isRoot ? offset : pos + 1 + offset;
      children.push(
        <DocumentTree
          depth={depth + 1}
          key={`${childPos}-${index}-${child.type.name}`}
          node={child}
          onReveal={onReveal}
          onSelect={onSelect}
          onSelectNode={onSelectNode}
          pos={childPos}
          selectedPosition={selectedPosition}
          selectedRoot={selectedRoot}
          selection={selection}
        />,
      );
    });
  }

  const text = node.isInline ? node.textContent : "";
  const isInspected = selectedPosition === pos && selectedRoot === isRoot;

  return (
    <div className="pm-doc-tree-item">
      <div
        className="pm-doc-row"
        data-editor-selection={selectionCoverage ?? undefined}
        data-inspected={isInspected}
        data-node-type={node.type.name}
        style={{ "--depth": depth } as CSSProperties}
      >
        {node.childCount > 0 ? (
          <button
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${node.type.name}` : `Expand ${node.type.name}`}
            className="pm-node-caret"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span aria-hidden="true" className="pm-node-caret">
            ·
          </span>
        )}
        <button
          aria-selected={isInspected}
          className="pm-doc-row-main"
          onClick={() => onSelect(node, pos)}
          onDoubleClick={() => onReveal(pos)}
          onKeyDown={(event) => {
            if (node.childCount > 0 && event.key === "ArrowRight") {
              event.preventDefault();
              setExpanded(true);
            } else if (node.childCount > 0 && event.key === "ArrowLeft") {
              event.preventDefault();
              setExpanded(false);
            } else if (event.key.toLowerCase() === "r") {
              event.preventDefault();
              onReveal(pos);
            }
          }}
          title="Inspect this node. Double-click or press R to reveal it in the editor."
          type="button"
        >
          <span className="pm-node-name">{node.type.name}</span>
          {text ? (
            <span className="pm-node-text">
              {JSON.stringify(text.length > 42 ? `${text.slice(0, 42)}…` : text)}
            </span>
          ) : null}
          {node.marks.length > 0 ? (
            <Badge>{node.marks.map((mark) => mark.type.name).join("+")}</Badge>
          ) : null}
        </button>
        {selectionCoverage ? (
          <span className="pm-node-selection-label" data-coverage={selectionCoverage}>
            {selectionCoverage === "full" ? "selected" : "partial"}
          </span>
        ) : null}
        <span
          aria-label={`Open position ${range.from}, close position ${range.to}`}
          className="pm-node-range"
          title={`Node range [${range.from}, ${range.to})`}
        >
          <span>{range.from}</span>
          <span aria-hidden="true">→</span>
          <span>{range.to}</span>
        </span>
        <button
          aria-label={`Select ${node.type.name} node in the editor`}
          className="pm-node-select-action"
          onClick={() => {
            onSelect(node, pos);
            onSelectNode(node, pos);
          }}
          title={`Select the entire ${node.type.name} node (${range.from}–${range.to})`}
          type="button"
        >
          Select
        </button>
      </div>
      {children}
    </div>
  );
});
