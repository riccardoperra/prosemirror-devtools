import { createEffect, type Accessor } from "solid-js";

function revealTab(element: HTMLButtonElement | undefined): void {
  const tabList = element?.parentElement;
  if (!element || !tabList) return;
  const tabRect = element.getBoundingClientRect();
  const listRect = tabList.getBoundingClientRect();
  const offset =
    tabRect.width > listRect.width || tabRect.left < listRect.left
      ? tabRect.left - listRect.left
      : Math.max(0, tabRect.right - listRect.right);
  // Scroll only the tab strip, without moving the editor or its hosting page.
  if (offset !== 0) tabList.scrollLeft += offset;
}

export function useTabList({
  activeId,
  onSelect,
  tabs,
}: {
  activeId: Accessor<string>;
  onSelect: (id: string) => void;
  tabs: Accessor<readonly Readonly<{ id: string }>[]>;
}): {
  handleKeyDown: (event: KeyboardEvent) => void;
  registerTab: (panelId: string, element: HTMLButtonElement | null) => void;
} {
  const tabRefs = new Map<string, HTMLButtonElement>();

  const registerTab = (panelId: string, element: HTMLButtonElement | null): void => {
    if (element) tabRefs.set(panelId, element);
    else tabRefs.delete(panelId);
  };

  createEffect(() => {
    // Registry updates can move an already selected extension out of view.
    tabs();
    revealTab(tabRefs.get(activeId()));
  });

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const currentTabs = tabs();
    if (currentTabs.length === 0) return;
    const focusedIndex = currentTabs.findIndex(({ id }) => tabRefs.get(id) === event.target);
    const currentIndex =
      focusedIndex >= 0 ? focusedIndex : currentTabs.findIndex(({ id }) => id === activeId());
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      const currentElement = tabRefs.get(currentTabs[currentIndex]?.id ?? "");
      const direction =
        currentElement?.ownerDocument.defaultView?.getComputedStyle(currentElement).direction;
      const forward = (event.key === "ArrowRight") !== (direction === "rtl");
      nextIndex = (currentIndex + (forward ? 1 : -1) + currentTabs.length) % currentTabs.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = currentTabs.length - 1;
    if (nextIndex == null) return;

    event.preventDefault();
    const nextTab = currentTabs[nextIndex];
    if (!nextTab) return;
    onSelect(nextTab.id);
    const element = tabRefs.get(nextTab.id);
    element?.focus({ preventScroll: true });
    revealTab(element);
  };

  return { handleKeyDown, registerTab };
}
