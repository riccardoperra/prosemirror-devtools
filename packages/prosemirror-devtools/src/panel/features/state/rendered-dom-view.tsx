import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { createMemo, createSignal, For, Index, Match, Show, Switch, type JSX } from "solid-js";

import { panelStyles } from "../../styles";

import { useOptionalPanelInspection } from "../../panel-provider";
import type { NodeTarget } from "../inspector/node-picker";
import { previewText } from "./document-tree";
import { readRenderedDom, type RenderedDomElement, type RenderedDomEntry } from "./rendered-dom";

const RENDERED_DOM_LIMIT = 2000;

type DomTreeModel = Readonly<{
  isInspected: (pos: number, isRoot: boolean) => boolean;
  select: (pos: number, isRoot: boolean) => void;
  hover: (target: NodeTarget | null) => void;
}>;

function TagLabel(props: { element: RenderedDomElement }): JSX.Element {
  return (
    <span class={panelStyles.pmDomTag}>
      {"<"}
      {props.element.tag}
      <For each={props.element.attrs}>
        {([name, value]) => (
          <span class={panelStyles.pmDomAttr}>
            {" "}
            {name}="{value}"
          </span>
        )}
      </For>
      {">"}
    </span>
  );
}

function DomEntry(props: {
  entry: RenderedDomEntry;
  depth: number;
  model: DomTreeModel;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.entry.kind === "text" && props.entry}>
        {(text) => (
          <div
            class={panelStyles.pmDocRow}
            data-dom-kind="text"
            style={{ "--depth": props.depth } as JSX.CSSProperties}
          >
            <span aria-hidden="true" class={panelStyles.pmNodeCaret}>
              ·
            </span>
            <span class={panelStyles.pmNodeText}>{previewText(text().text)}</span>
            <Show when={text().pos !== null}>
              <span class={panelStyles.pmNodeRange}>pos {text().pos}</span>
            </Show>
          </div>
        )}
      </Match>
      <Match when={props.entry.kind === "element" && props.entry}>
        {(element) => <DomElement depth={props.depth} element={element()} model={props.model} />}
      </Match>
    </Switch>
  );
}

function DomElement(props: {
  element: RenderedDomElement;
  depth: number;
  model: DomTreeModel;
}): JSX.Element {
  const [expanded, setExpanded] = createSignal(
    props.depth < 4 && props.element.children.length <= 50,
  );
  const isRoot = (): boolean => props.depth === 0;
  const isInspected = (): boolean => {
    const node = props.element.node;
    return node !== undefined && props.model.isInspected(node.from, isRoot());
  };

  return (
    <div class={panelStyles.pmDocTreeItem}>
      <div
        class={panelStyles.pmDocRow}
        data-dom-kind="element"
        data-inspected={isInspected()}
        data-node-type={props.element.node?.name}
        onMouseEnter={() => {
          const node = props.element.node;
          props.model.hover(node ? { pos: node.from, isRoot: isRoot() } : null);
        }}
        onMouseLeave={() => props.model.hover(null)}
        style={{ "--depth": props.depth } as JSX.CSSProperties}
      >
        <Show
          when={props.element.children.length > 0}
          fallback={
            <span aria-hidden="true" class={panelStyles.pmNodeCaret}>
              ·
            </span>
          }
        >
          <button
            aria-expanded={expanded()}
            aria-label={
              expanded() ? `Collapse ${props.element.tag}` : `Expand ${props.element.tag}`
            }
            class={panelStyles.pmNodeCaret}
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            {expanded() ? "▾" : "▸"}
          </button>
        </Show>
        <Show
          when={props.element.node}
          fallback={
            <span class={panelStyles.pmDocRowMain}>
              <TagLabel element={props.element} />
            </span>
          }
        >
          {(node) => (
            <button
              aria-pressed={isInspected()}
              class={panelStyles.pmDocRowMain}
              onClick={() => props.model.select(node().from, isRoot())}
              title={`Inspect the ${node().name} node this element renders.`}
              type="button"
            >
              <TagLabel element={props.element} />
              <span class={panelStyles.pmDomNode}>
                {node().name} {node().from}–{node().to}
              </span>
            </button>
          )}
        </Show>
      </div>
      <Show when={expanded()}>
        <Index each={props.element.children}>
          {(child) => <DomEntry depth={props.depth + 1} entry={child()} model={props.model} />}
        </Index>
      </Show>
    </div>
  );
}

export interface RenderedDomViewProps {
  view: EditorView;
  state: EditorState;
  selectedPosition: number;
  selectedRoot: boolean;
  onSelect: (pos: number, isRoot: boolean) => void;
  onHover: (target: NodeTarget | null) => void;
}

/** The editor's rendered DOM, annotated with the document nodes it renders. Live moment only. */
export function RenderedDomView(props: RenderedDomViewProps): JSX.Element {
  const inspection = useOptionalPanelInspection();
  const rendered = createMemo(() => {
    const live =
      !inspection ||
      (inspection.moment().kind === "live" && inspection.instance()?.view === props.view);
    if (!live || props.view.isDestroyed || props.view.state !== props.state) return undefined;
    return readRenderedDom(props.view, RENDERED_DOM_LIMIT);
  });
  const model: DomTreeModel = {
    isInspected: (pos, isRoot) => props.selectedPosition === pos && props.selectedRoot === isRoot,
    select: (pos, isRoot) => props.onSelect(pos, isRoot),
    hover: (target) => props.onHover(target),
  };

  return (
    <Show
      when={rendered()}
      fallback={
        <p role="status" class={panelStyles.pmPerformanceNote}>
          The rendered DOM is only available for the live editor state. Follow live to read it.
        </p>
      }
    >
      {(dom) => (
        <>
          <Show when={dom().truncated}>
            <p role="status" class={panelStyles.pmPerformanceNote}>
              Showing the first {RENDERED_DOM_LIMIT} DOM nodes.
            </p>
          </Show>
          <DomElement depth={0} element={dom().root} model={model} />
        </>
      )}
    </Show>
  );
}
