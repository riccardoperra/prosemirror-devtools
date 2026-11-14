import { DOMSerializer } from "prosemirror-model";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

/** What a rendered element is for the document. */
export type RenderedDomRole =
  /** The DOM of a node: `from` is the position before it, `to` the position after it. */
  | Readonly<{ kind: "node"; name: string; from: number; to: number }>
  /** A mark wrapping the content between `from` and `to`. */
  | Readonly<{ kind: "mark"; name: string; from: number; to: number }>
  | Readonly<{ kind: "widget"; from: number }>
  /** Not mapped to the document: NodeView chrome, decoration wrappers, editor UI. */
  | Readonly<{ kind: "outside" }>;

export type RenderedDomElement = Readonly<{
  kind: "element";
  tag: string;
  attrs: readonly (readonly [name: string, value: string])[];
  /** Null when the DOM was not rendered by an editor view, so nothing maps it to positions. */
  role: RenderedDomRole | null;
  children: readonly RenderedDomEntry[];
}>;

export type RenderedDomText = Readonly<{
  kind: "text";
  text: string;
  /** Document positions of the text, or null when it is not document content. */
  range: Readonly<{ from: number; to: number }> | null;
}>;

export type RenderedDomEntry = RenderedDomElement | RenderedDomText;

export type RenderedDom = Readonly<{ entries: readonly RenderedDomEntry[]; truncated: boolean }>;

const MAX_ATTRIBUTES = 4;
const MAX_ATTRIBUTE_LENGTH = 40;
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

type Mapper = Readonly<{
  role: (element: Element) => RenderedDomRole | null;
  textRange: (text: Node) => RenderedDomText["range"];
}>;

function readAttributes(element: Element): RenderedDomElement["attrs"] {
  return Array.from(element.attributes)
    .slice(0, MAX_ATTRIBUTES)
    .map(({ name, value }) => [
      name,
      value.length > MAX_ATTRIBUTE_LENGTH ? `${value.slice(0, MAX_ATTRIBUTE_LENGTH)}…` : value,
    ]);
}

function walk(nodes: Iterable<Node>, mapper: Mapper, limit: number): RenderedDom {
  let remaining = limit;
  let truncated = false;
  const read = (children: Iterable<Node>): RenderedDomEntry[] => {
    const entries: RenderedDomEntry[] = [];
    for (const child of children) {
      if (child.nodeType !== ELEMENT_NODE && child.nodeType !== TEXT_NODE) continue;
      if (remaining <= 0) {
        truncated = true;
        break;
      }
      remaining--;
      if (child.nodeType === TEXT_NODE) {
        entries.push({ kind: "text", text: child.nodeValue ?? "", range: mapper.textRange(child) });
        continue;
      }
      const element = child as Element;
      entries.push({
        kind: "element",
        tag: element.tagName.toLowerCase(),
        attrs: readAttributes(element),
        role: mapper.role(element),
        children: read(element.childNodes),
      });
    }
    return entries;
  };
  return { entries: read(nodes), truncated };
}

/**
 * The parts of prosemirror-view's internal `pmViewDesc` expando this reader relies on. It is not
 * public API, so every read goes through `readViewDesc`, which tolerates its absence.
 */
type ViewDesc = Readonly<{
  dom: Node;
  nodeDOM?: Node;
  node?: Readonly<{ type: Readonly<{ name: string }>; isText: boolean }>;
  mark?: Readonly<{ type: Readonly<{ name: string }> }>;
  widget?: unknown;
  posBefore: number;
  posAfter: number;
  posAtStart: number;
  posAtEnd: number;
}>;

function viewDescOf(dom: Node): ViewDesc | undefined {
  const desc = (dom as { pmViewDesc?: unknown }).pmViewDesc;
  return typeof desc === "object" && desc !== null && "dom" in desc
    ? (desc as ViewDesc)
    : undefined;
}

/** Undefined when the element has no readable view desc of its own. */
function readViewDesc(element: Element): RenderedDomRole | undefined {
  try {
    const desc = viewDescOf(element);
    if (!desc || desc.dom !== element) return undefined;
    if (desc.mark)
      return { kind: "mark", name: desc.mark.type.name, from: desc.posAtStart, to: desc.posAtEnd };
    if (desc.widget) return { kind: "widget", from: desc.posAtStart };
    // A node decoration can wrap the node's own DOM; the wrapper then owns the desc.
    if (desc.node && desc.nodeDOM === element)
      return { kind: "node", name: desc.node.type.name, from: desc.posBefore, to: desc.posAfter };
    return { kind: "outside" };
  } catch {
    return undefined;
  }
}

function readTextRange(text: Node): RenderedDomText["range"] {
  try {
    const desc = viewDescOf(text) ?? (text.parentNode ? viewDescOf(text.parentNode) : undefined);
    if (!desc?.node?.isText || desc.nodeDOM !== text) return null;
    return { from: desc.posAtStart, to: desc.posAtStart + (text.nodeValue ?? "").length };
  } catch {
    return null;
  }
}

/** Reads the editor's DOM, labelling each element with what it renders for the document. */
export function readRenderedDom(view: EditorView, limit = 2000): RenderedDom {
  const doc = view.state.doc;
  const nodeElements = new Map<Node, RenderedDomRole>();
  let mapped = 0;
  doc.descendants((node, pos) => {
    if (mapped++ >= limit) return false;
    const dom = view.nodeDOM(pos);
    if (dom?.nodeType === ELEMENT_NODE)
      nodeElements.set(dom, {
        kind: "node",
        name: node.type.name,
        from: pos,
        to: pos + node.nodeSize,
      });
    return true;
  });

  const mapper: Mapper = {
    role(element) {
      if (element === view.dom)
        return { kind: "node", name: doc.type.name, from: 0, to: doc.content.size };
      return readViewDesc(element) ?? nodeElements.get(element) ?? { kind: "outside" };
    },
    textRange: readTextRange,
  };
  return walk([view.dom], mapper, limit);
}

/** Reads the document as the schema serializes it, without positions. Works for any state. */
export function readSerializedDom(
  state: EditorState,
  document: Document,
  limit = 2000,
): RenderedDom {
  const fragment = DOMSerializer.fromSchema(state.schema).serializeFragment(state.doc.content, {
    document,
  });
  return walk(fragment.childNodes, { role: () => null, textRange: () => null }, limit);
}
