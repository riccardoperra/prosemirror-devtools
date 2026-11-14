import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { createMemo, createSignal, For, Index, Match, Show, Switch, type JSX } from "solid-js";

import { panelStyles } from "../../styles";

import { useOptionalPanelInspection } from "../../panel-provider";
import type { NodeTarget } from "../inspector/node-picker";
import { nodeHue } from "./document-boxes";
import { previewText } from "./document-tree";
import {
  readRenderedDom,
  readSerializedDom,
  type RenderedDom,
  type RenderedDomElement,
  type RenderedDomEntry,
  type RenderedDomRole,
  type RenderedDomText,
} from "./rendered-dom";

const RENDERED_DOM_LIMIT = 2000;

type DomSource =
  | Readonly<{ kind: "live"; dom: RenderedDom }>
  | Readonly<{ kind: "serialized"; dom: RenderedDom }>
  | Readonly<{ kind: "unavailable"; reason: string }>;

type DomTreeModel = Readonly<{
  /** The text node a text or mark row stands for, from a position inside it. */
  textNodeAt: (pos: number) => NodeTarget;
  isInspected: (target: NodeTarget) => boolean;
  select: (target: NodeTarget) => void;
  hover: (target: NodeTarget | null) => void;
}>;

function roleTarget(
  role: RenderedDomRole | null,
  isRoot: boolean,
  model: DomTreeModel,
): NodeTarget | null {
  if (role?.kind === "node") return { pos: role.from, isRoot };
  if (role?.kind === "mark") return model.textNodeAt(role.from);
  return null;
}

function textTarget(text: RenderedDomText, model: DomTreeModel): NodeTarget | null {
  return text.range ? model.textNodeAt(text.range.from) : null;
}

function nodeRangeTitle(role: Readonly<{ from: number; to: number }>, isRoot: boolean): string {
  if (isRoot) return `Document content ${role.from}–${role.to}`;
  const content = role.to - role.from >= 2 ? `; content ${role.from + 1}–${role.to - 1}` : "";
  return `Position before ${role.from}, after ${role.to}${content}`;
}

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

function RoleBadge(props: { role: RenderedDomRole; isRoot: boolean }): JSX.Element {
  return (
    <Switch>
      <Match when={props.role.kind === "node" && props.role}>
        {(node) => (
          <span
            class={panelStyles.pmDomRole}
            data-role="node"
            style={{ "--pm-node-hue": nodeHue(node().name) } as JSX.CSSProperties}
            title={nodeRangeTitle(node(), props.isRoot)}
          >
            {node().name} {node().from}–{node().to}
          </span>
        )}
      </Match>
      <Match when={props.role.kind === "mark" && props.role}>
        {(mark) => (
          <span
            class={panelStyles.pmDomRole}
            data-role="mark"
            title={`Mark ${mark().name} wraps ${mark().from}–${mark().to}`}
          >
            {mark().name} {mark().from}–{mark().to}
          </span>
        )}
      </Match>
      <Match when={props.role.kind === "widget" && props.role}>
        {(widget) => (
          <span
            class={panelStyles.pmDomRole}
            data-role="widget"
            title={`Widget decoration at position ${widget().from}`}
          >
            widget @{widget().from}
          </span>
        )}
      </Match>
      <Match when={props.role.kind === "outside"}>
        <span
          class={panelStyles.pmDomRole}
          data-role="outside"
          title="Not part of the document: NodeView chrome, a decoration wrapper or editor UI"
        >
          outside
        </span>
      </Match>
    </Switch>
  );
}

function DomRow(props: {
  depth: number;
  target: NodeTarget | null;
  role: RenderedDomRole["kind"] | "text" | undefined;
  model: DomTreeModel;
  caret: JSX.Element;
  children: JSX.Element;
}): JSX.Element {
  const isInspected = (): boolean => !!props.target && props.model.isInspected(props.target);
  return (
    <div
      class={panelStyles.pmDocRow}
      data-dom-role={props.role}
      data-inspected={isInspected()}
      onMouseEnter={() => props.model.hover(props.target)}
      onMouseLeave={() => props.model.hover(null)}
      style={{ "--depth": props.depth } as JSX.CSSProperties}
    >
      {props.caret}
      <Show
        when={props.target}
        fallback={<span class={panelStyles.pmDocRowMain}>{props.children}</span>}
      >
        {(target) => (
          <button
            aria-pressed={isInspected()}
            class={panelStyles.pmDocRowMain}
            onClick={() => props.model.select(target())}
            type="button"
          >
            {props.children}
          </button>
        )}
      </Show>
    </div>
  );
}

const leafCaret = (): JSX.Element => (
  <span aria-hidden="true" class={panelStyles.pmNodeCaret}>
    ·
  </span>
);

function DomEntry(props: {
  entry: RenderedDomEntry;
  depth: number;
  model: DomTreeModel;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.entry.kind === "text" && props.entry}>
        {(text) => (
          <DomRow
            caret={leafCaret()}
            depth={props.depth}
            model={props.model}
            role="text"
            target={textTarget(text(), props.model)}
          >
            <span class={panelStyles.pmNodeText}>{previewText(text().text)}</span>
            <Show when={text().range}>
              {(range) => (
                <span class={panelStyles.pmNodeRange}>
                  {range().from}–{range().to}
                </span>
              )}
            </Show>
          </DomRow>
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
  const isRoot = (): boolean => props.depth === 0 && props.element.role?.kind === "node";

  return (
    <div class={panelStyles.pmDocTreeItem}>
      <DomRow
        caret={
          <Show when={props.element.children.length > 0} fallback={leafCaret()}>
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
        }
        depth={props.depth}
        model={props.model}
        role={props.element.role?.kind}
        target={roleTarget(props.element.role, isRoot(), props.model)}
      >
        <TagLabel element={props.element} />
        <Show when={props.element.role}>
          {(role) => <RoleBadge isRoot={isRoot()} role={role()} />}
        </Show>
      </DomRow>
      <Show when={expanded()}>
        <Index each={props.element.children}>
          {(child) => <DomEntry depth={props.depth + 1} entry={child()} model={props.model} />}
        </Index>
      </Show>
    </div>
  );
}

function Legend(): JSX.Element {
  return (
    <p class={panelStyles.pmDomLegend}>
      <span class={panelStyles.pmDomRole} data-role="node">
        node
      </span>
      <span class={panelStyles.pmDomRole} data-role="mark">
        mark
      </span>
      <span class={panelStyles.pmDomRole} data-role="widget">
        widget
      </span>
      <span class={panelStyles.pmDomRole} data-role="outside">
        outside the document
      </span>
      <span>ranges are document positions</span>
    </p>
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

/**
 * The editor's DOM with what each element renders for the document. A state the editor does not
 * render has no DOM to read, so it shows the schema's HTML export instead.
 */
export function RenderedDomView(props: RenderedDomViewProps): JSX.Element {
  const inspection = useOptionalPanelInspection();
  const source = createMemo<DomSource>(() => {
    const live =
      (!inspection ||
        (inspection.moment().kind === "live" && inspection.instance()?.view === props.view)) &&
      !props.view.isDestroyed &&
      props.view.state === props.state;
    try {
      return live
        ? { kind: "live", dom: readRenderedDom(props.view, RENDERED_DOM_LIMIT) }
        : {
            kind: "serialized",
            dom: readSerializedDom(props.state, props.view.dom.ownerDocument, RENDERED_DOM_LIMIT),
          };
    } catch (error) {
      return {
        kind: "unavailable",
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  });
  const model: DomTreeModel = {
    textNodeAt: (pos) => ({ pos: pos - props.state.doc.resolve(pos).textOffset, isRoot: false }),
    isInspected: (target) =>
      props.selectedPosition === target.pos && props.selectedRoot === target.isRoot,
    select: (target) => props.onSelect(target.pos, target.isRoot),
    hover: (target) => props.onHover(target),
  };

  const readable = () => {
    const current = source();
    return current.kind === "unavailable" ? undefined : current;
  };
  const unavailableReason = () => {
    const current = source();
    return current.kind === "unavailable" ? current.reason : "";
  };

  return (
    <Show
      when={readable()}
      fallback={
        <p role="status" class={panelStyles.pmPerformanceNote}>
          DOM unavailable: {unavailableReason()}
        </p>
      }
    >
      {(readable) => (
        <>
          <Show
            when={readable().kind === "live"}
            fallback={
              <p role="status" class={panelStyles.pmPerformanceNote}>
                Not the live editor state: schema HTML export, positions are only shown for the live
                editor.
              </p>
            }
          >
            <Legend />
          </Show>
          <Show when={readable().dom.truncated}>
            <p role="status" class={panelStyles.pmPerformanceNote}>
              Showing the first {RENDERED_DOM_LIMIT} DOM nodes.
            </p>
          </Show>
          <Index each={readable().dom.entries}>
            {(entry) => <DomEntry depth={0} entry={entry()} model={model} />}
          </Index>
        </>
      )}
    </Show>
  );
}
