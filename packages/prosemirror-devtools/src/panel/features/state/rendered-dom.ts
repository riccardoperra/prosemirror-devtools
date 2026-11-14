import type { EditorView } from "prosemirror-view";

export type RenderedDomNodeRef = Readonly<{ name: string; from: number; to: number }>;

export type RenderedDomElement = Readonly<{
  kind: "element";
  tag: string;
  attrs: readonly (readonly [name: string, value: string])[];
  /** The ProseMirror node this element renders, when it renders one. */
  node?: RenderedDomNodeRef;
  children: readonly RenderedDomEntry[];
}>;

export type RenderedDomText = Readonly<{
  kind: "text";
  text: string;
  /** Document position at the start of the text, or null outside editable content. */
  pos: number | null;
}>;

export type RenderedDomEntry = RenderedDomElement | RenderedDomText;

export type RenderedDom = Readonly<{ root: RenderedDomElement; truncated: boolean }>;

const MAX_ATTRIBUTES = 4;
const MAX_ATTRIBUTE_LENGTH = 40;

function readAttributes(element: Element): RenderedDomElement["attrs"] {
  return Array.from(element.attributes)
    .slice(0, MAX_ATTRIBUTES)
    .map(({ name, value }) => [
      name,
      value.length > MAX_ATTRIBUTE_LENGTH ? `${value.slice(0, MAX_ATTRIBUTE_LENGTH)}…` : value,
    ]);
}

function textPosition(view: EditorView, text: Node): number | null {
  try {
    return view.posAtDOM(text, 0);
  } catch {
    return null;
  }
}

/** Reads the editor's rendered DOM, annotated with the document node each element renders. */
export function readRenderedDom(view: EditorView, limit = 2000): RenderedDom {
  const doc = view.state.doc;
  const nodes = new Map<Node, RenderedDomNodeRef>([
    [view.dom, { name: doc.type.name, from: 0, to: doc.content.size }],
  ]);
  let mapped = 0;
  doc.descendants((node, pos) => {
    if (mapped++ >= limit) return false;
    const dom = view.nodeDOM(pos);
    if (dom?.nodeType === 1)
      nodes.set(dom, { name: node.type.name, from: pos, to: pos + node.nodeSize });
    return true;
  });

  let remaining = limit;
  let truncated = false;
  const readElement = (element: Element): RenderedDomElement => {
    const children: RenderedDomEntry[] = [];
    for (const child of element.childNodes) {
      if (child.nodeType !== 1 && child.nodeType !== 3) continue;
      if (remaining <= 0) {
        truncated = true;
        break;
      }
      remaining--;
      children.push(
        child.nodeType === 1
          ? readElement(child as Element)
          : { kind: "text", text: child.nodeValue ?? "", pos: textPosition(view, child) },
      );
    }
    const node = nodes.get(element);
    return {
      kind: "element",
      tag: element.tagName.toLowerCase(),
      attrs: readAttributes(element),
      ...(node ? { node } : {}),
      children,
    };
  };

  return { root: readElement(view.dom), truncated };
}
