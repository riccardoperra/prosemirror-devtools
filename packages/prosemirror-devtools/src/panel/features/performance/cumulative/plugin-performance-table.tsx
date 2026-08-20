import { createMemo, For, Show, type JSX } from "solid-js";

import { cx, panelStyles } from "../../../styles";

import type { PluginTimingSummary } from "../../../../core/types";
import { formatMs } from "../../../formatters";
import { hookLabel } from "../plugin-timing-formatters";

export interface PluginPerformanceTableProps {
  summaries: readonly PluginTimingSummary[];
}

export function PluginPerformanceTable(props: PluginPerformanceTableProps): JSX.Element {
  const maximum = createMemo(() => Math.max(...props.summaries.map((item) => item.total), 0.001));

  return (
    <details class={cx(panelStyles.pmChartWrap, panelStyles.pmCumulativeHooks)}>
      <summary class={panelStyles.pmChartHeader}>
        <span class={panelStyles.pmSectionTitle}>Cumulative hook time</span>
        <span class={panelStyles.pmSpacer} />
        <span class={panelStyles.pmRowDetail}>{props.summaries.length} hooks · since clear</span>
      </summary>
      <table class={panelStyles.pmTable}>
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
                <td class={panelStyles.pmMuted} colSpan={5}>
                  Wrap plugins with instrumentProseMirrorPlugins to attribute their work.
                </td>
              </tr>
            }
          >
            <For each={props.summaries.slice(0, 25)}>
              {(item) => (
                <tr>
                  <td>
                    <span class={panelStyles.pmRowTitle}>{item.pluginLabel}</span>
                    <div class={cx(panelStyles.pmRowDetail, panelStyles.pmMono)}>
                      {hookLabel(item.hook)}
                    </div>
                    <div class={panelStyles.pmMeter}>
                      <span style={{ width: `${(item.total / maximum()) * 100}%` }} />
                    </div>
                  </td>
                  <td class={panelStyles.pmMono}>{item.count}</td>
                  <td class={panelStyles.pmMono}>{formatMs(item.average)}</td>
                  <td class={panelStyles.pmMono}>{formatMs(item.max)}</td>
                  <td class={panelStyles.pmMono}>{formatMs(item.total)}</td>
                </tr>
              )}
            </For>
          </Show>
        </tbody>
      </table>
    </details>
  );
}
