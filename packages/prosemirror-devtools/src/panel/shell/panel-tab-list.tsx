import { createEffect, createMemo, For, onCleanup, Show, type JSX } from "solid-js";

import { cx, panelStyles } from "../styles";

import { useTabList } from "../hooks/use-tab-list";
import { usePanelMeta, usePanelNavigation } from "../panel-provider";
import type { ResolvedPanelGroup } from "../panel-registry";
import { useActiveInstance } from "../store/selectors";

export function PanelTabList(): JSX.Element {
  const navigation = usePanelNavigation();
  const meta = usePanelMeta();
  const activeInstance = useActiveInstance();
  const transactionCount = (): number => activeInstance()?.transactions.length ?? 0;
  const activeGroup = createMemo(() =>
    navigation
      .groups()
      .find(({ panels }) => panels.some(({ id }) => id === navigation.activePanel())),
  );
  const lastPanelByGroup = new Map<string, string>();
  createEffect(() => {
    const group = activeGroup();
    if (group) lastPanelByGroup.set(group.id, navigation.activePanel());
  });
  const selectGroup = (groupId: string): void => {
    const group = navigation.groups().find(({ id }) => id === groupId);
    if (!group) return;
    const remembered = group.panels.find(({ id }) => id === lastPanelByGroup.get(groupId));
    navigation.selectPanel((remembered ?? group.panels[0]).id);
  };
  const groupTabs = useTabList({
    activeId: () => activeGroup()?.id ?? "",
    onSelect: selectGroup,
    tabs: navigation.groups,
  });
  const viewTabs = useTabList({
    activeId: navigation.activePanel,
    onSelect: navigation.selectPanel,
    tabs: () => activeGroup()?.panels ?? [],
  });
  const groupWithViews = (): ResolvedPanelGroup | undefined => {
    const group = activeGroup();
    return group && group.panels.length > 1 ? group : undefined;
  };

  return (
    <>
      <nav
        aria-label="Inspector sections"
        aria-orientation="horizontal"
        class={panelStyles.pmTabs}
        onKeyDown={groupTabs.handleKeyDown}
        role="tablist"
      >
        <For each={navigation.groups()}>
          {(group) => {
            onCleanup(() => groupTabs.registerTab(group.id, null));
            const selected = (): boolean => activeGroup()?.id === group.id;
            return (
              <button
                aria-controls={meta.tabPanelId}
                aria-selected={selected()}
                class={panelStyles.pmTab}
                // A single-view section is that view's tab, so the tab panel stays labelled by it.
                id={
                  group.panels.length === 1
                    ? meta.tabId(group.panels[0].id)
                    : meta.groupTabId(group.id)
                }
                onClick={() => selectGroup(group.id)}
                ref={(element) => groupTabs.registerTab(group.id, element)}
                role="tab"
                tabIndex={selected() ? 0 : -1}
                type="button"
              >
                {group.title}
                <Show when={group.panels.some(({ badge }) => badge === "transactions")}>
                  <span class={panelStyles.pmTabCount}>{transactionCount()}</span>
                </Show>
              </button>
            );
          }}
        </For>
      </nav>
      <Show when={groupWithViews()}>
        {(group) => (
          <div
            aria-label={`${group().title} views`}
            aria-orientation="horizontal"
            class={cx(panelStyles.pmTabs, panelStyles.pmSubTabs)}
            onKeyDown={viewTabs.handleKeyDown}
            role="tablist"
          >
            <For each={group().panels}>
              {(item) => {
                onCleanup(() => viewTabs.registerTab(item.id, null));
                const selected = (): boolean => navigation.activePanel() === item.id;
                return (
                  <button
                    aria-controls={meta.tabPanelId}
                    aria-selected={selected()}
                    class={cx(panelStyles.pmTab, panelStyles.pmSubTab)}
                    id={meta.tabId(item.id)}
                    onClick={() => navigation.selectPanel(item.id)}
                    ref={(element) => viewTabs.registerTab(item.id, element)}
                    role="tab"
                    tabIndex={selected() ? 0 : -1}
                    type="button"
                  >
                    {item.title}
                  </button>
                );
              }}
            </For>
          </div>
        )}
      </Show>
    </>
  );
}
