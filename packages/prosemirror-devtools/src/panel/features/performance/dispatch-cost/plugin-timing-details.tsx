import { createMemo, For, Show, type JSX } from "solid-js";

import type { PluginTimingGroup } from "../../../../performance/group-plugin-timings";
import { formatMs } from "../../../formatters";
import { Badge } from "../../../ui/badge";
import { hookFamily, hookLabel, hookTitle } from "../plugin-timing-formatters";

export function PluginTimingDetails(props: {
  groups: readonly PluginTimingGroup[];
  dispatchDuration: number;
}): JSX.Element {
  const safeDispatchDuration = createMemo(() => Math.max(props.dispatchDuration, 0.001));

  return (
    <details class="pm-plugin-breakdown-details">
      <summary>
        <span class="pm-section-title">Exact hook breakdown</span>
        <Badge>{props.groups.reduce((count, group) => count + group.callCount, 0)} calls</Badge>
      </summary>
      <div aria-hidden="true" class="pm-plugin-timing-columns">
        <span>Plugin</span>
        <span>Hook time</span>
        <span>Full sync</span>
      </div>
      <div
        aria-label="Plugins ordered by synchronous cost"
        class="pm-plugin-timing-list"
        role="list"
      >
        <For each={props.groups}>
          {(group, index) => (
            <div class="pm-plugin-timing-group" data-plugin-key={group.pluginKey} role="listitem">
              <div class="pm-plugin-timing-identity" title={group.pluginKey}>
                <span class="pm-plugin-timing-rank">{index() + 1}</span>
                <span class="pm-row-main">
                  <span class="pm-row-title">{group.pluginLabel}</span>
                  <span class="pm-row-detail">
                    {group.hooks.length} {group.hooks.length === 1 ? "hook" : "hooks"} ·{" "}
                    {group.callCount} {group.callCount === 1 ? "call" : "calls"}
                  </span>
                </span>
              </div>
              <div class="pm-plugin-hook-list">
                <For each={group.hooks}>
                  {(hook) => (
                    <span
                      aria-label={`${hookLabel(hook.hook)}, ${formatMs(hook.duration)}, ${hook.callCount} ${hook.callCount === 1 ? "call" : "calls"}, maximum call ${formatMs(hook.maxDuration)}`}
                      class="pm-plugin-hook-chip"
                      data-family={hookFamily(hook.hook)}
                      title={hookTitle(hook.hook, hook.callCount, hook.maxDuration)}
                    >
                      <span class="pm-plugin-hook-name">{hookLabel(hook.hook)}</span>
                      <span class="pm-mono">{formatMs(hook.duration)}</span>
                      <Show when={hook.callCount > 1}>
                        <span class="pm-plugin-hook-count">×{hook.callCount}</span>
                      </Show>
                    </span>
                  )}
                </For>
              </div>
              <div class="pm-plugin-full-time">
                <span class="pm-plugin-full-value">{formatMs(group.duration)}</span>
                <span class="pm-plugin-full-label">full sync</span>
                <span class="pm-plugin-full-meter" aria-hidden="true">
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
