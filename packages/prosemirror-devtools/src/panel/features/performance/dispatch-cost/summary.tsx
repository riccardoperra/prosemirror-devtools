import { createMemo, type JSX } from "solid-js";

import type { TransactionRecord } from "../../../../core/types";
import { formatMs } from "../../../formatters";
import { buildDispatchCostCoverage } from "./model";

export function DispatchCostSummary(props: { record: TransactionRecord }): JSX.Element {
  const coverage = createMemo(() => buildDispatchCostCoverage(props.record));

  return (
    <div class="pm-dispatch-cost-summary">
      <div class="pm-dispatch-cost-heading">
        <span>Full synchronous dispatch</span>
        <strong class="pm-mono">{formatMs(coverage().totalDuration)}</strong>
      </div>
      <div
        aria-label={`${formatMs(coverage().measuredPluginDuration)} in measured plugin hooks and ${formatMs(coverage().otherSyncDuration)} in other synchronous dispatch work`}
        class="pm-dispatch-cost-meter"
        role="img"
      >
        <span
          data-segment="plugin"
          style={{ "inline-size": `${coverage().measuredPluginPercentage}%` }}
        />
        <span
          data-segment="other"
          style={{ "inline-size": `${coverage().otherSyncPercentage}%` }}
        />
      </div>
      <div class="pm-dispatch-cost-legend">
        <span>
          <i class="pm-legend-dot" data-segment="plugin" />
          Measured plugin hooks{" "}
          <strong class="pm-mono">{formatMs(coverage().measuredPluginDuration)}</strong>
        </span>
        <span>
          <i class="pm-legend-dot" data-segment="other" />
          Other synchronous work{" "}
          <strong class="pm-mono">{formatMs(coverage().otherSyncDuration)}</strong>
        </span>
      </div>
      <p class="pm-dispatch-cost-note">
        Other work includes ProseMirror core, dispatcher code, and DOM/view work outside wrapped
        plugin hooks. Later browser paint and asynchronous work are not part of this dispatch.
      </p>
    </div>
  );
}
