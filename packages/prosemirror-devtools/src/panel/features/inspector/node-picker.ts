import type { EditorView } from "prosemirror-view";

import { clipToEditor } from "../decorations/decoration-overlay";

export type NodeTarget = Readonly<{ pos: number; isRoot: boolean }>;

export interface NodePickerHandlers {
  onPick: (pos: number, isRoot: boolean) => void;
  onCancel: () => void;
}

type Rect = Readonly<{ left: number; top: number; width: number; height: number }>;

const OVERLAY_COLOR = "#2775c9";
const ELEMENT_NODE = 1;

function nodeRects(view: EditorView, target: NodeTarget): Rect[] {
  if (target.isRoot) return [view.dom.getBoundingClientRect()];
  const node = view.state.doc.nodeAt(target.pos);
  if (!node) throw new RangeError(`No node at ${target.pos}.`);
  if (!node.isText) {
    const dom = view.nodeDOM(target.pos);
    // nodeType instead of instanceof: the editor may live in another window.
    if (dom?.nodeType === ELEMENT_NODE) return [(dom as Element).getBoundingClientRect()];
  }
  const start = view.domAtPos(target.pos, 1);
  const end = view.domAtPos(target.pos + node.nodeSize, -1);
  const range = view.dom.ownerDocument.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return Array.from(range.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0);
}

function describeNode(view: EditorView, target: NodeTarget): string | undefined {
  const doc = view.state.doc;
  if (target.isRoot) return `${doc.type.name} 0–${doc.content.size}`;
  const node =
    target.pos >= 0 && target.pos < doc.content.size ? doc.nodeAt(target.pos) : undefined;
  return node ? `${node.type.name} ${target.pos}–${target.pos + node.nodeSize}` : undefined;
}

/** Outlines a document node in the editor until the returned function is called. */
export function showNodeOverlay(view: EditorView, pos: number, isRoot: boolean): () => void {
  const target = view.dom.ownerDocument;
  const host = target.defaultView;
  const label = describeNode(view, { pos, isRoot });
  if (!host || !label) return () => {};

  const observedDocument = view.state.doc;
  const layer = target.createElement("div");
  layer.setAttribute("data-prosemirror-node-overlay", "");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483646;";
  target.body.append(layer);
  let hidden = false;
  let frame: number | undefined;
  let drawnRects = "";

  const hide = (): void => {
    if (hidden) return;
    hidden = true;
    if (frame !== undefined) host.cancelAnimationFrame(frame);
    layer.remove();
  };

  const render = (rects: readonly Rect[]): void => {
    clipToEditor(layer, view, host);
    const editor = view.dom.getBoundingClientRect();
    const boxes = rects.map((rect) => {
      const box = target.createElement("div");
      box.style.cssText = `position:absolute;box-sizing:border-box;border:1px solid ${OVERLAY_COLOR};background:rgba(39,117,201,.14);`;
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${Math.max(2, rect.width)}px`;
      box.style.height = `${Math.max(2, rect.height)}px`;
      return box;
    });
    const caption = target.createElement("span");
    caption.textContent = label;
    caption.style.cssText = `position:absolute;padding:1px 4px;border-radius:3px;background:${OVERLAY_COLOR};color:#fff;white-space:nowrap;font:11px/16px ui-monospace,monospace;`;
    const first = rects[0];
    if (first) {
      caption.style.left = `${first.left}px`;
      // The editor clips the layer: keep the label within it, covering the node only as a last resort.
      const above = first.top - 18;
      const below = first.top + first.height + 1;
      caption.style.top = `${above >= editor.top ? above : below + 18 <= editor.bottom ? below : first.top}px`;
    }
    layer.replaceChildren(...boxes, caption);
  };

  const follow = (): void => {
    frame = undefined;
    if (hidden) return;
    if (view.isDestroyed || !view.dom.isConnected || view.state.doc !== observedDocument) {
      hide();
      return;
    }
    let rects: Rect[];
    try {
      rects = nodeRects(view, { pos, isRoot });
    } catch {
      hide();
      return;
    }
    const key = rects.map((rect) => `${rect.left},${rect.top},${rect.width},${rect.height}`).join();
    if (key !== drawnRects || layer.childElementCount === 0) {
      drawnRects = key;
      render(rects);
    }
    frame = host.requestAnimationFrame(follow);
  };

  follow();
  return hide;
}

function containsPoint(rects: readonly Rect[], x: number, y: number): boolean {
  return rects.some(
    (rect) =>
      x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height,
  );
}

function parentAcrossShadow(element: Element): Element | undefined {
  const root = element.getRootNode();
  return element.parentElement ?? ("host" in root ? (root as ShadowRoot).host : undefined);
}

/** The innermost node whose own DOM element contains the event target. */
function nodeFromEventTarget(view: EditorView, event: Event): NodeTarget {
  const doc = view.state.doc;
  let element = event.composedPath().find((node) => (node as Node).nodeType === ELEMENT_NODE) as
    | Element
    | undefined;
  for (; element && element !== view.dom; element = parentAcrossShadow(element)) {
    let pos: number;
    try {
      pos = view.posAtDOM(element, 0);
    } catch {
      continue;
    }
    const $pos = doc.resolve(pos);
    for (let depth = $pos.depth; depth > 0; depth--) {
      if (view.nodeDOM($pos.before(depth)) === element) {
        return { pos: $pos.before(depth), isRoot: false };
      }
    }
    if ($pos.nodeAfter && view.nodeDOM(pos) === element) return { pos, isRoot: false };
    const before = $pos.nodeBefore;
    if (before && view.nodeDOM(pos - before.nodeSize) === element) {
      return { pos: pos - before.nodeSize, isRoot: false };
    }
  }
  return { pos: 0, isRoot: true };
}

/**
 * The inline child of `parent` under the pointer, so text leaves can be picked even though
 * they have no element of their own.
 */
function inlineChildAtPointer(
  view: EditorView,
  event: MouseEvent,
  parent: NodeTarget,
): NodeTarget | undefined {
  const doc = view.state.doc;
  const parentNode = parent.isRoot ? doc : doc.nodeAt(parent.pos);
  if (!parentNode?.inlineContent) return undefined;
  let hit: ReturnType<EditorView["posAtCoords"]>;
  try {
    hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
  } catch {
    return undefined;
  }
  if (!hit) return undefined;
  const $pos = doc.resolve(hit.pos);
  if ($pos.start() !== (parent.isRoot ? 0 : parent.pos + 1)) return undefined;
  if ($pos.textOffset > 0) return { pos: hit.pos - $pos.textOffset, isRoot: false };
  // At a boundary the position belongs to the parent: take the side the pointer is over.
  const candidates: NodeTarget[] = [];
  if ($pos.nodeAfter) candidates.push({ pos: hit.pos, isRoot: false });
  if ($pos.nodeBefore) candidates.push({ pos: hit.pos - $pos.nodeBefore.nodeSize, isRoot: false });
  return candidates.find((candidate) => {
    try {
      return containsPoint(nodeRects(view, candidate), event.clientX, event.clientY);
    } catch {
      return false;
    }
  });
}

function pickTarget(view: EditorView, event: MouseEvent): NodeTarget {
  const element = nodeFromEventTarget(view, event);
  return inlineChildAtPointer(view, event, element) ?? element;
}

const SWALLOWED_EVENTS = [
  "pointerdown",
  "mousedown",
  "mouseup",
  "pointerup",
  "dblclick",
  "contextmenu",
] as const;

/**
 * Lets the user pick a node by pointing at it in the editor. Pointer events inside the editor are
 * swallowed so it does not move the selection; events elsewhere pass through.
 */
export function startNodePicker(view: EditorView, handlers: NodePickerHandlers): () => void {
  const host = view.dom.ownerDocument.defaultView;
  if (!host) return () => {};

  let hideOverlay: (() => void) | undefined;
  let outlined: string | undefined;
  let stopped = false;
  const previousCursor = view.dom.style.cursor;

  const inEditor = (event: Event): boolean => event.composedPath().includes(view.dom);
  const clearOverlay = (): void => {
    hideOverlay?.();
    hideOverlay = undefined;
    outlined = undefined;
  };
  const swallow = (event: Event): void => {
    if (!inEditor(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const onMove = (event: Event): void => {
    if (!inEditor(event)) {
      clearOverlay();
      return;
    }
    const target = pickTarget(view, event as MouseEvent);
    const key = `${target.pos}:${target.isRoot}`;
    if (key === outlined) return;
    clearOverlay();
    hideOverlay = showNodeOverlay(view, target.pos, target.isRoot);
    outlined = key;
  };
  const onClick = (event: Event): void => {
    if (!inEditor(event)) return;
    swallow(event);
    const target = pickTarget(view, event as MouseEvent);
    stop();
    handlers.onPick(target.pos, target.isRoot);
  };
  const onKeyDown = (event: Event): void => {
    if ((event as KeyboardEvent).key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    stop();
    handlers.onCancel();
  };

  const listeners: ReadonlyArray<readonly [string, (event: Event) => void]> = [
    ...SWALLOWED_EVENTS.map((type) => [type, swallow] as const),
    ["mousemove", onMove],
    ["click", onClick],
    ["keydown", onKeyDown],
  ];
  for (const [type, listener] of listeners) host.addEventListener(type, listener, true);
  view.dom.style.cursor = "crosshair";

  function stop(): void {
    if (stopped) return;
    stopped = true;
    for (const [type, listener] of listeners) host!.removeEventListener(type, listener, true);
    view.dom.style.cursor = previousCursor;
    clearOverlay();
  }

  return stop;
}
