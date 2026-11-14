import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";
import { useEffect, useId, useRef, type ReactNode } from "react";

interface MoreMenuProps {
  readonly label: string;
  readonly children: (close: () => void) => ReactNode;
}

/** A native popover gives light dismiss and Escape for free; floating-ui only places it under the trigger. */
export function MoreMenu({ label, children }: MoreMenuProps) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const anchor = trigger.current;
    const floating = menu.current;
    if (!anchor || !floating) return;
    let stop: (() => void) | undefined;
    const onToggle = (event: Event) => {
      stop?.();
      stop = undefined;
      if ((event as ToggleEvent).newState !== "open") return;
      stop = autoUpdate(anchor, floating, () => {
        void computePosition(anchor, floating, {
          strategy: "fixed",
          placement: "bottom-end",
          middleware: [offset(6), flip(), shift({ padding: 8 })],
        }).then(({ x, y }) => {
          floating.style.left = `${x}px`;
          floating.style.top = `${y}px`;
        });
      });
    };
    floating.addEventListener("toggle", onToggle);
    return () => {
      floating.removeEventListener("toggle", onToggle);
      stop?.();
    };
  }, []);
  const close = () => menu.current?.hidePopover();
  return (
    <>
      <button ref={trigger} type="button" popoverTarget={id} aria-haspopup="menu">
        {label}
        <span className="chevron" aria-hidden="true" />
      </button>
      <div ref={menu} id={id} popover="auto" role="menu" aria-label={label} className="menu">
        {children(close)}
      </div>
    </>
  );
}
