import { For, onCleanup, Show, type JSX } from "solid-js";

import { panelStyles } from "../styles";

import { useTabList } from "../hooks/use-tab-list";
import { usePanelMeta, usePanelNavigation } from "../panel-provider";
import { useActiveInstance } from "../store/selectors";

export function PanelTabList(): JSX.Element {
  const navigation = usePanelNavigation();
  const meta = usePanelMeta();
  const activeInstance = useActiveInstance();
  const { handleKeyDown, registerTab } = useTabList({
    activePanel: navigation.activePanel,
    onSelect: navigation.selectPanel,
    tabs: navigation.panels,
  });
  const transactionCount = (): number => activeInstance()?.transactions.length ?? 0;

  return (
    <nav
      aria-label="ProseMirror Devtools panels"
      aria-orientation="horizontal"
      class={panelStyles.pmTabs}
      onKeyDown={handleKeyDown}
      role="tablist"
    >
      <For each={navigation.panels()}>
        {(item) => {
          onCleanup(() => registerTab(item.id, null));
          return (
            <button
              aria-controls={meta.tabPanelId}
              aria-selected={navigation.activePanel() === item.id}
              class={panelStyles.pmTab}
              id={meta.tabId(item.id)}
              onClick={() => navigation.selectPanel(item.id)}
              ref={(element) => registerTab(item.id, element)}
              role="tab"
              tabIndex={navigation.activePanel() === item.id ? 0 : -1}
              type="button"
            >
              {item.title}
              <Show when={item.badge === "transactions"}>
                <span class={panelStyles.pmTabCount}>{transactionCount()}</span>
              </Show>
            </button>
          );
        }}
      </For>
    </nav>
  );
}
