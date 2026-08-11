import type { CSSProperties, ReactElement } from "react";

import type { TransactionRecord } from "../../../../core/types";
import { formatMs } from "../../../formatters";
import { buildDispatchCostCoverage } from "./model";

export function DispatchCostSummary({ record }: { record: TransactionRecord }): ReactElement {
  const coverage = buildDispatchCostCoverage(record);
  const pluginStyle = {
    inlineSize: `${coverage.measuredPluginPercentage}%`,
  } satisfies CSSProperties;
  const otherStyle = {
    inlineSize: `${coverage.otherSyncPercentage}%`,
  } satisfies CSSProperties;

  return (
    <div className="pm-dispatch-cost-summary">
      <div className="pm-dispatch-cost-heading">
        <span>Dispatch time</span>
        <strong className="pm-mono">{formatMs(coverage.totalDuration)}</strong>
      </div>
      <div
        aria-label={`${formatMs(coverage.measuredPluginDuration)} in measured plugin hooks and ${formatMs(coverage.otherSyncDuration)} in other synchronous dispatch work`}
        className="pm-dispatch-cost-meter"
        role="img"
      >
        <span data-segment="plugin" style={pluginStyle} />
        <span data-segment="other" style={otherStyle} />
      </div>
      <div className="pm-dispatch-cost-legend">
        <span>
          <i className="pm-legend-dot" data-segment="plugin" />
          Plugin hooks{" "}
          <strong className="pm-mono">{formatMs(coverage.measuredPluginDuration)}</strong>
        </span>
        <span>
          <i className="pm-legend-dot" data-segment="other" />
          Other work <strong className="pm-mono">{formatMs(coverage.otherSyncDuration)}</strong>
        </span>
      </div>
    </div>
  );
}
