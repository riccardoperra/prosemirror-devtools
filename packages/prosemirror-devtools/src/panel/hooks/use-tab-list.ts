import { useCallback, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export function useTabList({
  activePanel,
  onSelect,
  tabs,
}: {
  activePanel: string;
  onSelect: (panelId: string) => void;
  tabs: readonly Readonly<{ id: string }>[];
}): {
  handleKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  registerTab: (index: number, element: HTMLButtonElement | null) => void;
} {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const registerTab = useCallback((index: number, element: HTMLButtonElement | null) => {
    tabRefs.current[index] = element;
  }, []);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const focusedIndex = tabRefs.current.findIndex((element) => element === event.target);
      const currentIndex =
        focusedIndex >= 0 ? focusedIndex : tabs.findIndex(({ id }) => id === activePanel);
      let nextIndex: number | null = null;
      if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
      if (event.key === "ArrowLeft") {
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      }
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = tabs.length - 1;
      if (nextIndex == null) return;

      event.preventDefault();
      const nextTab = tabs[nextIndex];
      if (!nextTab) return;
      onSelect(nextTab.id);
      tabRefs.current[nextIndex]?.focus();
    },
    [activePanel, onSelect, tabs],
  );

  return { handleKeyDown, registerTab };
}
