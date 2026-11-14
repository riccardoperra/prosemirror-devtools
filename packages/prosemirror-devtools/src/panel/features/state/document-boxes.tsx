import type { Node as ProseMirrorNode } from "prosemirror-model";
import { createMemo, createSignal, For, Index, Show, type JSX } from "solid-js";

import { panelStyles } from "../../styles";

import type { NodeTarget } from "../inspector/node-picker";
import { getDocumentNodeRange, previewText } from "./document-tree";

type BoxesModel = Readonly<{
  isInspected: (pos: number, isRoot: boolean) => boolean;
  /** Whether the inspected node lies inside the node at `pos`, so its box opens to show it. */
  holdsInspected: (node: ProseMirrorNode, pos: number) => boolean;
  select: (node: ProseMirrorNode, pos: number) => void;
  reveal: (pos: number) => void;
  hover: (target: NodeTarget | null) => void;
}>;

type PositionedNode = Readonly<{ node: ProseMirrorNode; pos: number }>;

function nodeHue(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index++) {
    hash = (hash * 31 + name.charCodeAt(index)) % 360;
  }
  return hash;
}

function childrenOf(node: ProseMirrorNode, contentStart: number): PositionedNode[] {
  const result: PositionedNode[] = [];
  node.forEach((child, offset) => result.push({ node: child, pos: contentStart + offset }));
  return result;
}

function NodeRange(props: { from: number; to: number }): JSX.Element {
  return (
    <span
      aria-label={`Open position ${props.from}, close position ${props.to}`}
      class={panelStyles.pmNodeRange}
    >
      {props.from}–{props.to}
    </span>
  );
}

function Chip(props: { node: ProseMirrorNode; pos: number; model: BoxesModel }): JSX.Element {
  const to = (): number => props.pos + props.node.nodeSize;
  const isInspected = (): boolean => props.model.isInspected(props.pos, false);

  return (
    <span
      class={panelStyles.pmDocBoxChip}
      data-inspected={isInspected()}
      data-node-type={props.node.type.name}
      style={{ "--pm-node-hue": nodeHue(props.node.type.name) } as JSX.CSSProperties}
    >
      <button
        aria-pressed={isInspected()}
        class={panelStyles.pmDocBoxChipMain}
        onClick={() => props.model.select(props.node, props.pos)}
        onMouseEnter={() => props.model.hover({ pos: props.pos, isRoot: false })}
        onMouseLeave={() => props.model.hover(null)}
        onDblClick={() => props.model.reveal(props.pos)}
        title="Inspect this node. Double-click to reveal it in the editor."
        type="button"
      >
        <Show
          when={props.node.isText}
          fallback={<span class={panelStyles.pmNodeName}>{props.node.type.name}</span>}
        >
          <span class={panelStyles.pmDocBoxText}>{previewText(props.node.text ?? "")}</span>
        </Show>
        <For each={props.node.marks}>
          {(mark) => <span class={panelStyles.pmDocBoxMark}>{mark.type.name}</span>}
        </For>
        <NodeRange from={props.pos} to={to()} />
      </button>
      <Show when={props.node.childCount > 0}>
        <span class={panelStyles.pmDocBoxInline}>
          <Index each={childrenOf(props.node, props.pos + 1)}>
            {(child) => <Chip model={props.model} node={child().node} pos={child().pos} />}
          </Index>
        </span>
      </Show>
    </span>
  );
}

function Box(props: {
  node: ProseMirrorNode;
  pos: number;
  depth: number;
  model: BoxesModel;
}): JSX.Element {
  const [toggled, setToggled] = createSignal<boolean>();
  const expanded = (): boolean =>
    toggled() ??
    ((props.depth < 2 && props.node.childCount <= 50) ||
      (!isRoot() && props.model.holdsInspected(props.node, props.pos)));
  const isRoot = (): boolean => props.depth === 0;
  const range = createMemo(() => getDocumentNodeRange(props.node, props.pos, isRoot()));
  const children = createMemo(() =>
    expanded() ? childrenOf(props.node, isRoot() ? 0 : props.pos + 1) : [],
  );
  const isInspected = (): boolean => props.model.isInspected(props.pos, isRoot());
  const collapsedPreview = (): string =>
    !expanded() && props.node.inlineContent ? props.node.textContent : "";

  return (
    <div
      class={panelStyles.pmDocBox}
      data-inspected={isInspected()}
      data-node-type={props.node.type.name}
      style={{ "--pm-node-hue": nodeHue(props.node.type.name) } as JSX.CSSProperties}
    >
      <div
        class={panelStyles.pmDocBoxHeader}
        onMouseEnter={() => props.model.hover({ pos: props.pos, isRoot: isRoot() })}
        onMouseLeave={() => props.model.hover(null)}
      >
        <Show when={props.node.childCount > 0}>
          <button
            aria-expanded={expanded()}
            aria-label={
              expanded() ? `Collapse ${props.node.type.name}` : `Expand ${props.node.type.name}`
            }
            class={panelStyles.pmNodeCaret}
            onClick={() => setToggled(!expanded())}
            type="button"
          >
            {expanded() ? "▾" : "▸"}
          </button>
        </Show>
        <button
          aria-pressed={isInspected()}
          class={panelStyles.pmDocRowMain}
          onClick={() => props.model.select(props.node, props.pos)}
          onDblClick={() => props.model.reveal(props.pos)}
          title="Inspect this node. Double-click to reveal it in the editor."
          type="button"
        >
          <span class={panelStyles.pmNodeName}>{props.node.type.name}</span>
          <Show when={collapsedPreview()}>
            {(text) => <span class={panelStyles.pmNodeText}>{previewText(text())}</span>}
          </Show>
          <For each={props.node.marks}>
            {(mark) => <span class={panelStyles.pmDocBoxMark}>{mark.type.name}</span>}
          </For>
        </button>
        <NodeRange from={range().from} to={range().to} />
      </div>
      <Show when={children().length > 0}>
        <div
          class={
            props.node.inlineContent ? panelStyles.pmDocBoxInline : panelStyles.pmDocBoxContent
          }
        >
          <Index each={children()}>
            {(child) =>
              props.node.inlineContent ? (
                <Chip model={props.model} node={child().node} pos={child().pos} />
              ) : (
                <Box
                  depth={props.depth + 1}
                  model={props.model}
                  node={child().node}
                  pos={child().pos}
                />
              )
            }
          </Index>
        </div>
      </Show>
    </div>
  );
}

export interface DocumentBoxesProps {
  doc: ProseMirrorNode;
  selectedPosition: number;
  selectedRoot: boolean;
  onSelect: (node: ProseMirrorNode, pos: number) => void;
  onReveal: (pos: number) => void;
  onHover: (target: NodeTarget | null) => void;
}

/** Block nodes as nested boxes and inline content as a flat row of chips. */
export function DocumentBoxes(props: DocumentBoxesProps): JSX.Element {
  const model: BoxesModel = {
    isInspected: (pos, isRoot) => props.selectedPosition === pos && props.selectedRoot === isRoot,
    holdsInspected: (node, pos) =>
      !props.selectedRoot &&
      props.selectedPosition > pos &&
      props.selectedPosition < pos + node.nodeSize - 1,
    select: (node, pos) => props.onSelect(node, pos),
    reveal: (pos) => props.onReveal(pos),
    hover: (target) => props.onHover(target),
  };

  return (
    <div class={panelStyles.pmDocBoxes}>
      <Box depth={0} model={model} node={props.doc} pos={0} />
    </div>
  );
}
