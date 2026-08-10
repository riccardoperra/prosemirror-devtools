import type { ReactElement } from "react";

import type { PluginTimingGroup } from "../../../../performance/group-plugin-timings";
import { formatMs } from "../../../formatters";
import { Badge } from "../../../ui/badge";
import { hookFamily, hookLabel, hookTitle } from "../plugin-timing-formatters";

export function PluginTimingDetails({
  groups,
  dispatchDuration,
}: {
  groups: readonly PluginTimingGroup[];
  dispatchDuration: number;
}): ReactElement {
  const safeDispatchDuration = Math.max(dispatchDuration, 0.001);

  return (
    <details className="pm-plugin-breakdown-details">
      <summary>
        <span className="pm-section-title">Exact hook breakdown</span>
        <Badge>{groups.reduce((count, group) => count + group.callCount, 0)} calls</Badge>
      </summary>
      <div aria-hidden="true" className="pm-plugin-timing-columns">
        <span>Plugin</span>
        <span>Hook time</span>
        <span>Full sync</span>
      </div>
      <div
        aria-label="Plugins ordered by synchronous cost"
        className="pm-plugin-timing-list"
        role="list"
      >
        {groups.map((group, index) => (
          <div
            className="pm-plugin-timing-group"
            data-plugin-key={group.pluginKey}
            key={group.pluginKey}
            role="listitem"
          >
            <div className="pm-plugin-timing-identity" title={group.pluginKey}>
              <span className="pm-plugin-timing-rank">{index + 1}</span>
              <span className="pm-row-main">
                <span className="pm-row-title">{group.pluginLabel}</span>
                <span className="pm-row-detail">
                  {group.hooks.length} {group.hooks.length === 1 ? "hook" : "hooks"} ·{" "}
                  {group.callCount} {group.callCount === 1 ? "call" : "calls"}
                </span>
              </span>
            </div>
            <div className="pm-plugin-hook-list">
              {group.hooks.map((hook) => (
                <span
                  aria-label={`${hookLabel(hook.hook)}, ${formatMs(hook.duration)}, ${hook.callCount} ${hook.callCount === 1 ? "call" : "calls"}, maximum call ${formatMs(hook.maxDuration)}`}
                  className="pm-plugin-hook-chip"
                  data-family={hookFamily(hook.hook)}
                  key={hook.hook}
                  title={hookTitle(hook.hook, hook.callCount, hook.maxDuration)}
                >
                  <span className="pm-plugin-hook-name">{hookLabel(hook.hook)}</span>
                  <span className="pm-mono">{formatMs(hook.duration)}</span>
                  {hook.callCount > 1 ? (
                    <span className="pm-plugin-hook-count">×{hook.callCount}</span>
                  ) : null}
                </span>
              ))}
            </div>
            <div className="pm-plugin-full-time">
              <span className="pm-plugin-full-value">{formatMs(group.duration)}</span>
              <span className="pm-plugin-full-label">full sync</span>
              <span className="pm-plugin-full-meter" aria-hidden="true">
                <span
                  style={{
                    width: `${Math.min(100, (group.duration / safeDispatchDuration) * 100)}%`,
                  }}
                />
              </span>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
