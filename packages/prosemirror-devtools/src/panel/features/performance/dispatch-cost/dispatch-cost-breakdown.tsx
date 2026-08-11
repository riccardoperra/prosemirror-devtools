import { useCallback, useMemo, useState } from "react";
import type { ReactElement } from "react";

import type { TransactionRecord } from "../../../../core/types";
import { groupPluginTimings } from "../../../../performance/group-plugin-timings";
import { Badge } from "../../../ui/badge";
import { PluginTimingTimeline } from "../timeline/plugin-timing-timeline";
import { getPluginRankingVisibility, type DispatchCostView } from "./model";
import { PluginCostRanking } from "./plugin-cost-ranking";
import { DispatchCostSummary } from "./summary";

function DispatchCoverageWarning({ record }: { record: TransactionRecord }): ReactElement | null {
  if (
    record.customDispatchDuration == null ||
    (record.applicationStatus !== "unknown" &&
      record.applyDuration != null &&
      record.viewUpdateDuration != null)
  ) {
    return null;
  }

  return (
    <div className="pm-warning">
      {record.applicationStatus === "unknown"
        ? "Could not match this transaction to the final editor state. Transaction counts are unavailable."
        : "dispatchTransaction() did not expose synchronous state apply and view update calls."}
    </div>
  );
}

function DispatchCostViewSwitch({
  value,
  onChange,
}: {
  value: DispatchCostView;
  onChange: (view: DispatchCostView) => void;
}): ReactElement {
  return (
    <div aria-label="Dispatch cost view" className="pm-view-switch" role="group">
      <button aria-pressed={value === "ranking"} onClick={() => onChange("ranking")} type="button">
        Ranking
      </button>
      <button
        aria-pressed={value === "timeline"}
        onClick={() => onChange("timeline")}
        type="button"
      >
        Timeline
      </button>
    </div>
  );
}

export function DispatchCostBreakdown({ record }: { record: TransactionRecord }): ReactElement {
  const groups = useMemo(() => groupPluginTimings(record.timings), [record.timings]);
  const collapsedRanking = useMemo(() => getPluginRankingVisibility(groups, false), [groups]);
  const [view, selectView] = useState<DispatchCostView>("ranking");
  const [showAllFastPlugins, setShowAllFastPlugins] = useState(false);
  const toggleFastPlugins = useCallback(() => {
    setShowAllFastPlugins((current) => !current);
  }, []);
  const visibleGroups = showAllFastPlugins ? groups : collapsedRanking.visibleGroups;
  const hiddenFastPluginCount = collapsedRanking.hiddenFastGroups.length;

  return (
    <>
      <div className="pm-workspace-heading">
        <span className="pm-section-title">Dispatch cost</span>
        <Badge>{groups.length} plugins</Badge>
        <span className="pm-spacer" />
        <DispatchCostViewSwitch value={view} onChange={selectView} />
      </div>
      <DispatchCoverageWarning record={record} />
      <DispatchCostSummary record={record} />
      {view === "ranking" ? (
        groups.length > 0 ? (
          <PluginCostRanking
            dispatchDuration={record.totalDuration}
            groups={groups}
            hiddenFastPluginCount={hiddenFastPluginCount}
            onToggleFastPlugins={toggleFastPlugins}
            showAllFastPlugins={showAllFastPlugins}
            visibleGroups={visibleGroups}
          />
        ) : (
          <div className="pm-plugin-timing-empty">
            No instrumented plugin hooks in this dispatch.
          </div>
        )
      ) : (
        <PluginTimingTimeline record={record} />
      )}
    </>
  );
}
