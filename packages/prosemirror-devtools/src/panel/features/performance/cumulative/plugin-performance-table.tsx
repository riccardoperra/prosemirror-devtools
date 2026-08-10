import type { ReactElement } from "react";

import type { PluginTimingSummary } from "../../../../core/types";
import { formatMs } from "../../../formatters";
import { hookLabel } from "../plugin-timing-formatters";

export function PluginPerformanceTable({
  summaries,
}: {
  summaries: readonly PluginTimingSummary[];
}): ReactElement {
  const max = Math.max(...summaries.map((item) => item.total), 0.001);

  return (
    <details className="pm-chart-wrap pm-cumulative-hooks">
      <summary className="pm-chart-header">
        <span className="pm-section-title">Cumulative hook time</span>
        <span className="pm-spacer" />
        <span className="pm-row-detail">{summaries.length} hooks · since clear</span>
      </summary>
      <table className="pm-table">
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
          {summaries.length === 0 ? (
            <tr>
              <td className="pm-muted" colSpan={5}>
                Wrap plugins with instrumentProseMirrorPlugins to attribute their work.
              </td>
            </tr>
          ) : (
            summaries.slice(0, 25).map((item) => (
              <tr key={`${item.pluginKey}-${item.hook}`}>
                <td>
                  <span className="pm-row-title">{item.pluginLabel}</span>
                  <div className="pm-row-detail pm-mono">{hookLabel(item.hook)}</div>
                  <div className="pm-meter">
                    <span style={{ width: `${(item.total / max) * 100}%` }} />
                  </div>
                </td>
                <td className="pm-mono">{item.count}</td>
                <td className="pm-mono">{formatMs(item.average)}</td>
                <td className="pm-mono">{formatMs(item.max)}</td>
                <td className="pm-mono">{formatMs(item.total)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </details>
  );
}
