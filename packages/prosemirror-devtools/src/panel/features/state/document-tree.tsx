import type { Node as ProseMirrorNode } from "prosemirror-model";
import { createMemo, createSignal, Index, Show, type JSX } from "solid-js";

import { panelStyles } from "../../styles";

import { Badge } from "../../ui/badge";
import type { NodeTarget } from "../inspector/node-picker";

export type DocumentSelectionRange = Readonly<{
  empty: boolean;
  from: number;
  to: number;
}>;

type SelectionCoverage = "full" | "partial" | null;

/** Quoted text, truncated so long text nodes keep one row. */
export function previewText(text: string): string {
  return JSON.stringify(text.length > 42 ? `${text.slice(0, 42)}…` : text);
}

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

interface DocumentTreeProps {
  node: ProseMirrorNode;
  pos: number;
  depth: number;
  selectedPosition: number;
  selectedRoot: boolean;
  selection: DocumentSelectionRange;
  onSelect: (node: ProseMirrorNode, pos: number) => void;
  onReveal: (pos: number) => void;
  onSelectNode: (node: ProseMirrorNode, pos: number) => void;
  onHover: (target: NodeTarget | null) => void;
}

export function DocumentTree(props: DocumentTreeProps): JSX.Element {
  const [expanded, setExpanded] = createSignal(props.depth < 2 && props.node.childCount <= 50);
  const isRoot = createMemo(() => props.depth === 0);
  const range = createMemo(() => getDocumentNodeRange(props.node, props.pos, isRoot()));
  const selectionCoverage = createMemo(() =>
    getSelectionCoverage(props.node, props.pos, isRoot(), props.selection),
  );
  const children = createMemo(() => {
    const result: Array<{ node: ProseMirrorNode; pos: number }> = [];
    if (!expanded()) return result;
    props.node.forEach((child, offset) => {
      result.push({ node: child, pos: isRoot() ? offset : props.pos + 1 + offset });
    });
    return result;
  });
  const text = createMemo(() => (props.node.isInline ? props.node.textContent : ""));
  const isInspected = createMemo(
    () => props.selectedPosition === props.pos && props.selectedRoot === isRoot(),
  );

  return (
    <div class={panelStyles.pmDocTreeItem}>
      <div
        class={panelStyles.pmDocRow}
        data-editor-selection={selectionCoverage() ?? undefined}
        data-inspected={isInspected()}
        data-node-type={props.node.type.name}
        onMouseEnter={() => props.onHover({ pos: props.pos, isRoot: isRoot() })}
        onMouseLeave={() => props.onHover(null)}
        style={{ "--depth": props.depth } as JSX.CSSProperties}
      >
        <Show
          when={props.node.childCount > 0}
          fallback={
            <span aria-hidden="true" class={panelStyles.pmNodeCaret}>
              ·
            </span>
          }
        >
          <button
            aria-expanded={expanded()}
            aria-label={
              expanded() ? `Collapse ${props.node.type.name}` : `Expand ${props.node.type.name}`
            }
            class={panelStyles.pmNodeCaret}
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            {expanded() ? "▾" : "▸"}
          </button>
        </Show>
        <button
          aria-pressed={isInspected()}
          class={panelStyles.pmDocRowMain}
          onClick={() => props.onSelect(props.node, props.pos)}
          onDblClick={() => props.onReveal(props.pos)}
          onKeyDown={(event) => {
            if (props.node.childCount > 0 && event.key === "ArrowRight") {
              event.preventDefault();
              setExpanded(true);
            } else if (props.node.childCount > 0 && event.key === "ArrowLeft") {
              event.preventDefault();
              setExpanded(false);
            } else if (event.key.toLowerCase() === "r") {
              event.preventDefault();
              props.onReveal(props.pos);
            }
          }}
          title="Inspect this node. Double-click or press R to reveal it in the editor."
          type="button"
        >
          <span class={panelStyles.pmNodeName}>{props.node.type.name}</span>
          <Show when={text()}>
            <span class={panelStyles.pmNodeText}>{previewText(text())}</span>
          </Show>
          <Show when={props.node.marks.length > 0}>
            <Badge>{props.node.marks.map((mark) => mark.type.name).join("+")}</Badge>
          </Show>
        </button>
        <Show when={selectionCoverage()}>
          {(coverage) => (
            <span class={panelStyles.pmNodeSelectionLabel} data-coverage={coverage()}>
              {coverage() === "full" ? "selected" : "partial"}
            </span>
          )}
        </Show>
        <span
          aria-label={`Open position ${range().from}, close position ${range().to}`}
          class={panelStyles.pmNodeRange}
          title={`Node range [${range().from}, ${range().to})`}
        >
          <span>{range().from}</span>
          <span aria-hidden="true">→</span>
          <span>{range().to}</span>
        </span>
        <button
          aria-label={`Select ${props.node.type.name} node in the editor`}
          class={panelStyles.pmNodeSelectAction}
          onClick={() => {
            props.onSelect(props.node, props.pos);
            props.onSelectNode(props.node, props.pos);
          }}
          title={`Select the entire ${props.node.type.name} node (${range().from}–${range().to})`}
          type="button"
        >
          Select
        </button>
      </div>
      <Show when={expanded()}>
        <Index each={children()}>
          {(child) => (
            <DocumentTree
              depth={props.depth + 1}
              node={child().node}
              onHover={props.onHover}
              onReveal={props.onReveal}
              onSelect={props.onSelect}
              onSelectNode={props.onSelectNode}
              pos={child().pos}
              selectedPosition={props.selectedPosition}
              selectedRoot={props.selectedRoot}
              selection={props.selection}
            />
          )}
        </Index>
      </Show>
    </div>
  );
}
