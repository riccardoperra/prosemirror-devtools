import { createMemo, For, Show, type JSX } from "solid-js";

import type { PluginTimingSummary } from "../../../../core/types";
import { formatMs } from "../../../formatters";
import { hookLabel } from "../plugin-timing-formatters";

export function PluginPerformanceTable(props: {
  summaries: readonly PluginTimingSummary[];
}): JSX.Element {
  const maximum = createMemo(() => Math.max(...props.summaries.map((item) => item.total), 0.001));

  return (
    <details class="pm-chart-wrap pm-cumulative-hooks">
      <summary class="pm-chart-header">
        <span class="pm-section-title">Cumulative hook time</span>
        <span class="pm-spacer" />
        <span class="pm-row-detail">{props.summaries.length} hooks · since clear</span>
      </summary>
      <table class="pm-table">
        <thead>
          <tr>
            <th>Plugin / hook</th>
            <th>Calls</th>
            <th>Average</th>
            <th>Max</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <Show
            when={props.summaries.length > 0}
            fallback={
              <tr>
                <td class="pm-muted" colSpan={5}>
                  Wrap plugins with instrumentProseMirrorPlugins to attribute their work.
                </td>
              </tr>
            }
          >
            <For each={props.summaries.slice(0, 25)}>
              {(item) => (
                <tr>
                  <td>
                    <span class="pm-row-title">{item.pluginLabel}</span>
                    <div class="pm-row-detail pm-mono">{hookLabel(item.hook)}</div>
                    <div class="pm-meter">
                      <span style={{ width: `${(item.total / maximum()) * 100}%` }} />
                    </div>
                  </td>
                  <td class="pm-mono">{item.count}</td>
                  <td class="pm-mono">{formatMs(item.average)}</td>
                  <td class="pm-mono">{formatMs(item.max)}</td>
                  <td class="pm-mono">{formatMs(item.total)}</td>
                </tr>
              )}
            </For>
          </Show>
        </tbody>
      </table>
    </details>
  );
}
