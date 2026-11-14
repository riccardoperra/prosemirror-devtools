import type { EditorView } from "prosemirror-view";

export interface DecorationOverlayRange {
  from: number;
  to: number;
  kind: "inline" | "node" | "widget";
}

type Rect = { left: number; right: number; top: number; bottom: number };

/** Clips a fixed overlay layer to the editor and its scrolling ancestors. */
export function clipToEditor(layer: HTMLElement, view: EditorView, host: Window): void {
  const clip = { left: 0, top: 0, right: host.innerWidth, bottom: host.innerHeight };
  let element: Element | null = view.dom;
  while (element) {
    const style = host.getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    if (element === view.dom || /auto|scroll|hidden|clip/.test(style.overflowX)) {
      clip.left = Math.max(clip.left, bounds.left);
      clip.right = Math.min(clip.right, bounds.right);
    }
    if (element === view.dom || /auto|scroll|hidden|clip/.test(style.overflowY)) {
      clip.top = Math.max(clip.top, bounds.top);
      clip.bottom = Math.min(clip.bottom, bounds.bottom);
    }
    const root = element.getRootNode();
    element = element.parentElement ?? ("host" in root ? (root as ShadowRoot).host : null);
  }
  layer.style.clipPath = `inset(${Math.max(0, clip.top)}px ${Math.max(0, host.innerWidth - clip.right)}px ${Math.max(0, host.innerHeight - clip.bottom)}px ${Math.max(0, clip.left)}px)`;
}

/** Draws observed positions in the editor's document without modifying its content. */
export function mountDecorationOverlay(
  view: EditorView,
  range: DecorationOverlayRange,
  onUnavailable: () => void = () => {},
): () => void {
  const observedDocument = view.state.doc;
  const target = view.dom.ownerDocument;
  const host = target.defaultView;
  if (!host) return () => {};

  const layer = target.createElement("div");
  layer.setAttribute("data-prosemirror-decoration-overlay", "");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483646;";
  target.body.append(layer);
  let disposed = false;
  let frame: number | undefined;

  const draw = (rect: Rect, label?: string): void => {
    if (![rect.left, rect.right, rect.top, rect.bottom].every(Number.isFinite)) return;
    const marker = target.createElement("div");
    marker.style.cssText =
      "position:absolute;box-sizing:border-box;border:2px solid #6758d7;background:rgba(103,88,215,.13);";
    marker.style.left = `${rect.left}px`;
    marker.style.top = `${rect.top}px`;
    marker.style.width = `${Math.max(2, rect.right - rect.left)}px`;
    marker.style.height = `${Math.max(2, rect.bottom - rect.top)}px`;
    if (label) {
      const caption = target.createElement("span");
      caption.textContent = label;
      caption.style.cssText =
        "position:absolute;left:-2px;bottom:100%;padding:2px 4px;border-radius:3px;background:#6758d7;color:#fff;white-space:nowrap;font:11px/1.3 ui-monospace,monospace;";
      marker.append(caption);
    }
    layer.append(marker);
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    if (frame !== undefined) host.cancelAnimationFrame(frame);
    target.removeEventListener("scroll", schedule, true);
    host.removeEventListener("resize", schedule);
    observer?.disconnect();
    layer.remove();
  };

  const update = (): void => {
    frame = undefined;
    if (disposed) return;
    if (view.isDestroyed || !view.dom.isConnected || view.state.doc !== observedDocument) {
      dispose();
      onUnavailable();
      return;
    }
    layer.replaceChildren();
    try {
      clipToEditor(layer, view, host);
      if (range.from < 0 || range.to < range.from || range.to > observedDocument.content.size) {
        throw new RangeError("Decoration positions are outside the observed document.");
      }
      if (range.kind === "node") {
        const node = view.nodeDOM(range.from);
        // nodeType works for elements from popup/iframe documents as well.
        const element = node?.nodeType === 1 ? (node as Element) : node?.parentElement;
        if (element) {
          draw(element.getBoundingClientRect(), `${range.from}–${range.to}`);
          return;
        }
      }
      const from = view.coordsAtPos(range.from, 1);
      const to = range.from === range.to ? from : view.coordsAtPos(range.to, -1);
      if (range.from !== range.to && Math.abs(from.top - to.top) < 2) {
        draw(
          {
            left: Math.min(from.left, to.left),
            right: Math.max(from.right, to.right),
            top: Math.min(from.top, to.top),
            bottom: Math.max(from.bottom, to.bottom),
          },
          `${range.kind} ${range.from}–${range.to}`,
        );
        draw({ ...from, right: from.left + 2 });
        draw({ ...to, right: to.left + 2 });
        return;
      }
      draw({ ...from, right: from.left + 2 }, `${range.kind} ${range.from}`);
      if (range.from !== range.to) draw({ ...to, right: to.left + 2 }, `to ${range.to}`);
    } catch {
      dispose();
      onUnavailable();
    }
  };

  function schedule(): void {
    if (!disposed && frame === undefined) frame = host!.requestAnimationFrame(update);
  }

  const observer = host.ResizeObserver ? new host.ResizeObserver(schedule) : undefined;
  observer?.observe(view.dom);
  target.addEventListener("scroll", schedule, true);
  host.addEventListener("resize", schedule);
  update();
  return dispose;
}
