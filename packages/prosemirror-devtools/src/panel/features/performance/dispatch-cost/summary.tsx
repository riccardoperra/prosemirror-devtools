import { createMemo, type JSX } from "solid-js";

import { panelStyles } from "../../../styles";

import type { TransactionRecord } from "../../../../core/types";
import { formatMs } from "../../../formatters";
import { buildDispatchCostCoverage } from "./model";

export interface DispatchCostSummaryProps {
  record: TransactionRecord;
}

export function DispatchCostSummary(props: DispatchCostSummaryProps): JSX.Element {
  const coverage = createMemo(() => buildDispatchCostCoverage(props.record));

  return (
    <div class={panelStyles.pmDispatchCostSummary}>
      <div class={panelStyles.pmDispatchCostHeading}>
        <span>Full synchronous dispatch</span>
        <strong class={panelStyles.pmMono}>{formatMs(coverage().totalDuration)}</strong>
      </div>
      <div
        aria-label={`${formatMs(coverage().measuredPluginDuration)} in measured plugin hooks and ${formatMs(coverage().otherSyncDuration)} in other synchronous dispatch work`}
        class={panelStyles.pmDispatchCostMeter}
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
      <div class={panelStyles.pmDispatchCostLegend}>
        <span>
          <i class={panelStyles.pmLegendDot} data-segment="plugin" />
          Measured plugin hooks{" "}
          <strong class={panelStyles.pmMono}>{formatMs(coverage().measuredPluginDuration)}</strong>
        </span>
        <span>
          <i class={panelStyles.pmLegendDot} data-segment="other" />
          Other synchronous work{" "}
          <strong class={panelStyles.pmMono}>{formatMs(coverage().otherSyncDuration)}</strong>
        </span>
      </div>
      <p class={panelStyles.pmDispatchCostNote}>
        Other work includes ProseMirror core, dispatcher code, and DOM/view work outside wrapped
        plugin hooks. Later browser paint and asynchronous work are not part of this dispatch.
      </p>
    </div>
  );
}
