import type { ReactElement } from "react";

import { useTabList } from "../hooks/use-tab-list";
import { usePanelMeta, usePanelNavigation } from "../panel-provider";
import { useActiveInstance } from "../store/selectors";

export function PanelTabList(): ReactElement {
  const { activePanel, panels, selectPanel } = usePanelNavigation();
  const { tabId, tabPanelId } = usePanelMeta();
  const activeInstance = useActiveInstance();
  const { handleKeyDown, registerTab } = useTabList({
    activePanel,
    onSelect: selectPanel,
    tabs: panels,
  });
  const transactionCount = activeInstance?.transactions.length ?? 0;

  return (
    <nav
      aria-label="ProseMirror Devtools panels"
      className="pm-tabs"
      onKeyDown={handleKeyDown}
      role="tablist"
    >
      {panels.map((item, index) => (
        <button
          aria-controls={tabPanelId}
          aria-selected={activePanel === item.id}
          className="pm-tab"
          id={tabId(item.id)}
          key={item.id}
          onClick={() => selectPanel(item.id)}
          ref={(element) => registerTab(index, element)}
          role="tab"
          tabIndex={activePanel === item.id ? 0 : -1}
          type="button"
        >
          {item.title}
          {item.badge === "transactions" ? (
            <span className="pm-tab-count">{transactionCount}</span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}
