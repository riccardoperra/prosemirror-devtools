import { children, createSignal, createUniqueId, onCleanup, onMount, type JSX } from "solid-js";

import { cx, panelStyles } from "../styles";

const MIN_PRIMARY = 180;
const MIN_DETAIL = 240;
const DIVIDER_SIZE = 10;
const KEY_STEP = 24;

interface SplitDrag {
  pointerId: number;
  startX: number;
  startWidth: number;
  direction: 1 | -1;
}

interface ResizableSplitProps {
  label: string;
  children: [JSX.Element, JSX.Element];
  class?: string | undefined;
  style?: JSX.CSSProperties;
}

export function ResizableSplit(props: ResizableSplitProps): JSX.Element {
  const panes = children(() => props.children);
  const primaryId = `pm-split-primary-${createUniqueId()}`;
  const [preferredWidth, setPreferredWidth] = createSignal(300);
  const [maxWidth, setMaxWidth] = createSignal(300);
  const [drag, setDrag] = createSignal<SplitDrag>();
  let container!: HTMLDivElement;

  const clampWidth = (value: number) => Math.max(MIN_PRIMARY, Math.min(maxWidth(), value));
  const currentWidth = () => clampWidth(preferredWidth());
  const direction = () =>
    container.ownerDocument.defaultView?.getComputedStyle(container).direction === "rtl" ? -1 : 1;

  onMount(() => {
    const primary = container.firstElementChild;
    if (primary) primary.id = primaryId;
    const measure = () =>
      setMaxWidth(Math.max(MIN_PRIMARY, container.clientWidth - MIN_DETAIL - DIVIDER_SIZE));
    measure();
    const Observer = container.ownerDocument.defaultView?.ResizeObserver;
    if (!Observer) return;
    const observer = new Observer(measure);
    observer.observe(container);
    onCleanup(() => observer.disconnect());
  });

  return (
    <div
      class={cx(panelStyles.pmSplit, props.class)}
      ref={(element) => {
        container = element;
      }}
      style={{
        ...props.style,
        "--pm-split-min": `${MIN_PRIMARY}px`,
        "--pm-split-detail-min": `${MIN_DETAIL}px`,
        "--pm-split-divider-size": `${DIVIDER_SIZE}px`,
        "--pm-split-width": `${preferredWidth()}px`,
      }}
    >
      {panes.toArray()[0]}
      <div
        aria-controls={primaryId}
        aria-label={props.label}
        aria-orientation="vertical"
        aria-valuemax={maxWidth()}
        aria-valuemin={MIN_PRIMARY}
        aria-valuenow={currentWidth()}
        aria-valuetext={`${currentWidth()} pixels`}
        class={panelStyles.pmSplitDivider}
        data-dragging={drag() !== undefined}
        onKeyDown={(event) => {
          let width: number;
          switch (event.key) {
            case "ArrowLeft":
              width = currentWidth() - KEY_STEP * direction();
              break;
            case "ArrowRight":
              width = currentWidth() + KEY_STEP * direction();
              break;
            case "Home":
              width = MIN_PRIMARY;
              break;
            case "End":
              width = maxWidth();
              break;
            default:
              return;
          }
          event.preventDefault();
          event.stopPropagation();
          setPreferredWidth(clampWidth(width));
        }}
        onLostPointerCapture={(event) => {
          if (drag()?.pointerId === event.pointerId) setDrag(undefined);
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || drag()) return;
          event.preventDefault();
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          setDrag({
            pointerId: event.pointerId,
            startX: event.clientX,
            startWidth: currentWidth(),
            direction: direction(),
          });
        }}
        onPointerMove={(event) => {
          const active = drag();
          if (!active || active.pointerId !== event.pointerId) return;
          setPreferredWidth(
            clampWidth(active.startWidth + (event.clientX - active.startX) * active.direction),
          );
        }}
        role="separator"
        tabIndex={0}
      />
      {panes.toArray()[1]}
    </div>
  );
}
