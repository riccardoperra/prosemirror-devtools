import { createMemo, For, Show, type JSX } from "solid-js";

import { panelStyles } from "../../../styles";

import type { PluginTimingGroup } from "../../../../performance/group-plugin-timings";
import { formatMs } from "../../../formatters";
import { Badge } from "../../../ui/badge";
import { hookFamily, hookLabel, hookTitle } from "../plugin-timing-formatters";

export interface PluginTimingDetailsProps {
  groups: readonly PluginTimingGroup[];
  dispatchDuration: number;
}

export function PluginTimingDetails(props: PluginTimingDetailsProps): JSX.Element {
  const safeDispatchDuration = createMemo(() => Math.max(props.dispatchDuration, 0.001));

  return (
    <details class={panelStyles.pmPluginBreakdownDetails}>
      <summary>
        <span class={panelStyles.pmSectionTitle}>Exact hook breakdown</span>
        <Badge>{props.groups.reduce((count, group) => count + group.callCount, 0)} calls</Badge>
      </summary>
      <div aria-hidden="true" class={panelStyles.pmPluginTimingColumns}>
        <span>Plugin</span>
        <span>Hook time</span>
        <span>Full sync</span>
      </div>
      <div
        aria-label="Plugins ordered by synchronous cost"
        class={panelStyles.pmPluginTimingList}
        role="list"
      >
        <For each={props.groups}>
          {(group, index) => (
            <div
              class={panelStyles.pmPluginTimingGroup}
              data-plugin-key={group.pluginKey}
              role="listitem"
            >
              <div class={panelStyles.pmPluginTimingIdentity} title={group.pluginKey}>
                <span class={panelStyles.pmPluginTimingRank}>{index() + 1}</span>
                <span class={panelStyles.pmRowMain}>
                  <span class={panelStyles.pmRowTitle}>{group.pluginLabel}</span>
                  <span class={panelStyles.pmRowDetail}>
                    {group.hooks.length} {group.hooks.length === 1 ? "hook" : "hooks"} ·{" "}
                    {group.callCount} {group.callCount === 1 ? "call" : "calls"}
                  </span>
                </span>
              </div>
              <div class={panelStyles.pmPluginHookList}>
                <For each={group.hooks}>
                  {(hook) => (
                    <span
                      aria-label={`${hookLabel(hook.hook)}, ${formatMs(hook.duration)}, ${hook.callCount} ${hook.callCount === 1 ? "call" : "calls"}, maximum call ${formatMs(hook.maxDuration)}`}
                      class={panelStyles.pmPluginHookChip}
                      data-family={hookFamily(hook.hook)}
                      title={hookTitle(hook.hook, hook.callCount, hook.maxDuration)}
                    >
                      <span class={panelStyles.pmPluginHookName}>{hookLabel(hook.hook)}</span>
                      <span class={panelStyles.pmMono}>{formatMs(hook.duration)}</span>
                      <Show when={hook.callCount > 1}>
                        <span class={panelStyles.pmPluginHookCount}>×{hook.callCount}</span>
                      </Show>
                    </span>
                  )}
                </For>
              </div>
              <div class={panelStyles.pmPluginFullTime}>
                <span class={panelStyles.pmPluginFullValue}>{formatMs(group.duration)}</span>
                <span class={panelStyles.pmPluginFullLabel}>full sync</span>
                <span class={panelStyles.pmPluginFullMeter} aria-hidden="true">
                  <span
                    style={{
                      width: `${Math.min(100, (group.duration / safeDispatchDuration()) * 100)}%`,
                    }}
                  />
                </span>
              </div>
            </div>
          )}
        </For>
      </div>
    </details>
  );
}
