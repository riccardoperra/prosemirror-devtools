import type { ReactElement } from "react";

import { useTabList } from "../hooks/use-tab-list";
import { PANEL_TABS } from "../panel.constants";
import { usePanelMeta, usePanelNavigation } from "../panel-provider";
import { useActiveInstance } from "../store/selectors";

export function PanelTabList(): ReactElement {
  const { activeTab, selectTab } = usePanelNavigation();
  const { panelId, tabPanelId } = usePanelMeta();
  const activeInstance = useActiveInstance();
  const { handleKeyDown, registerTab } = useTabList({
    activeTab,
    onSelect: selectTab,
    tabs: PANEL_TABS,
  });
  const transactionCount = activeInstance?.transactions.length ?? 0;

  return (
    <nav
      aria-label="ProseMirror Devtools panels"
      className="pm-tabs"
      onKeyDown={handleKeyDown}
      role="tablist"
    >
      {PANEL_TABS.map((item, index) => (
        <button
          aria-controls={tabPanelId}
          aria-selected={activeTab === item.id}
          className="pm-tab"
          id={`${panelId}-tab-${item.id}`}
          key={item.id}
          onClick={() => selectTab(item.id)}
          ref={(element) => registerTab(index, element)}
          role="tab"
          tabIndex={activeTab === item.id ? 0 : -1}
          type="button"
        >
          {item.label}
          {item.id === "history" || item.id === "performance" ? (
            <span className="pm-tab-count">{transactionCount}</span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}
