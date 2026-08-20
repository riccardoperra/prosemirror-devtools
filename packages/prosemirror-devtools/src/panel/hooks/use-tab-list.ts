import type { Accessor } from "solid-js";

export function useTabList({
  activePanel,
  onSelect,
  tabs,
}: {
  activePanel: Accessor<string>;
  onSelect: (panelId: string) => void;
  tabs: Accessor<readonly Readonly<{ id: string }>[]>;
}): {
  handleKeyDown: (event: KeyboardEvent) => void;
  registerTab: (index: number, element: HTMLButtonElement | null) => void;
} {
  const tabRefs: Array<HTMLButtonElement | null> = [];

  const registerTab = (index: number, element: HTMLButtonElement | null): void => {
    tabRefs[index] = element;
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    const currentTabs = tabs();
    const focusedIndex = tabRefs.findIndex((element) => element === event.target);
    const currentIndex =
      focusedIndex >= 0 ? focusedIndex : currentTabs.findIndex(({ id }) => id === activePanel());
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % currentTabs.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + currentTabs.length) % currentTabs.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = currentTabs.length - 1;
    if (nextIndex == null) return;

    event.preventDefault();
    const nextTab = currentTabs[nextIndex];
    if (!nextTab) return;
    onSelect(nextTab.id);
    tabRefs[nextIndex]?.focus();
  };

  return { handleKeyDown, registerTab };
}
