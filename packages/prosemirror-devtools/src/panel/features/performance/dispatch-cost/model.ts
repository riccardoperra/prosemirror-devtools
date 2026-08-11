import type { DispatchPhaseTiming, PluginHook, TransactionRecord } from "../../../../core/types";
import type { PluginTimingGroup } from "../../../../performance/group-plugin-timings";
import { getTimingCoverage } from "../../../../performance/timing-intervals";

export const FAST_PLUGIN_THRESHOLD_MS = 0.01;
export const MAX_VISIBLE_FAST_PLUGINS = 5;

export type DispatchCostView = "ranking" | "timeline";

export interface DispatchCostCoverage {
  totalDuration: number;
  measuredPluginDuration: number;
  otherSyncDuration: number;
  measuredPluginPercentage: number;
  otherSyncPercentage: number;
}

export interface PluginRankingVisibility {
  visibleGroups: readonly PluginTimingGroup[];
  hiddenFastGroups: readonly PluginTimingGroup[];
}

interface PositionedTiming {
  startOffset: number;
  endOffset: number;
  duration: number;
  startPercentage: number;
  durationPercentage: number;
}

export interface PluginTimelineEntry extends PositionedTiming {
  id: string;
  sequence: number;
  depth: number;
  pluginKey: string;
  pluginLabel: string;
  hook: PluginHook;
}

export interface PhaseTimelineEntry extends PositionedTiming {
  id: string;
  phase: DispatchPhaseTiming["phase"];
  label: string;
}

function positionedTiming(
  startOffset: number,
  duration: number,
  totalDuration: number,
): PositionedTiming {
  const safeTotal = Math.max(totalDuration, 0.001);
  const safeDuration = Math.max(0, duration);
  const start = Math.min(safeTotal, Math.max(0, startOffset));
  const end = Math.min(safeTotal, Math.max(start, startOffset + safeDuration));
  return {
    startOffset: start,
    endOffset: end,
    duration: safeDuration,
    startPercentage: (start / safeTotal) * 100,
    durationPercentage: ((end - start) / safeTotal) * 100,
  };
}

export function buildDispatchCostCoverage(record: TransactionRecord): DispatchCostCoverage {
  const totalDuration = Math.max(0, record.totalDuration);
  const measuredPluginDuration = Math.min(
    totalDuration,
    getTimingCoverage(record.timings, totalDuration),
  );
  const otherSyncDuration = Math.max(0, totalDuration - measuredPluginDuration);
  const divisor = Math.max(totalDuration, 0.001);
  return {
    totalDuration,
    measuredPluginDuration,
    otherSyncDuration,
    measuredPluginPercentage: (measuredPluginDuration / divisor) * 100,
    otherSyncPercentage: (otherSyncDuration / divisor) * 100,
  };
}

export function getPluginRankingVisibility(
  groups: readonly PluginTimingGroup[],
  showAllFastPlugins: boolean,
): PluginRankingVisibility {
  if (showAllFastPlugins) return { visibleGroups: groups, hiddenFastGroups: [] };

  const visibleGroups: PluginTimingGroup[] = [];
  const hiddenFastGroups: PluginTimingGroup[] = [];
  let visibleFastPluginCount = 0;

  for (const group of groups) {
    if (group.duration >= FAST_PLUGIN_THRESHOLD_MS) {
      visibleGroups.push(group);
      continue;
    }
    if (visibleFastPluginCount < MAX_VISIBLE_FAST_PLUGINS) {
      visibleGroups.push(group);
      visibleFastPluginCount += 1;
      continue;
    }
    hiddenFastGroups.push(group);
  }

  return { visibleGroups, hiddenFastGroups };
}

export function buildPluginTimeline(record: TransactionRecord): PluginTimelineEntry[] {
  const sorted = record.timings
    .map((timing, sourceIndex) => ({ timing, sourceIndex }))
    .sort(
      (left, right) =>
        left.timing.startOffset - right.timing.startOffset ||
        right.timing.duration - left.timing.duration ||
        left.sourceIndex - right.sourceIndex,
    );
  const activeEnds: number[] = [];

  return sorted.map(({ timing, sourceIndex }, index) => {
    while (
      activeEnds.length > 0 &&
      timing.startOffset >= (activeEnds.at(-1) ?? 0) - Number.EPSILON
    ) {
      activeEnds.pop();
    }
    const depth = activeEnds.length;
    activeEnds.push(timing.startOffset + Math.max(0, timing.duration));
    return {
      id: `${timing.pluginKey}:${timing.hook}:${sourceIndex}`,
      sequence: index + 1,
      depth,
      pluginKey: timing.pluginKey,
      pluginLabel: timing.pluginLabel,
      hook: timing.hook,
      ...positionedTiming(timing.startOffset, timing.duration, record.totalDuration),
    };
  });
}

function phaseLabel(phase: DispatchPhaseTiming["phase"]): string {
  switch (phase) {
    case "apply":
      return "State apply";
    case "viewUpdate":
      return "View update";
    case "customDispatch":
      return "dispatchTransaction()";
  }
}

export function buildPhaseTimeline(record: TransactionRecord): PhaseTimelineEntry[] {
  return record.phaseTimings
    .map((timing, sourceIndex) => ({ timing, sourceIndex }))
    .sort(
      (left, right) =>
        left.timing.startOffset - right.timing.startOffset ||
        right.timing.duration - left.timing.duration ||
        left.sourceIndex - right.sourceIndex,
    )
    .map(({ timing, sourceIndex }) => ({
      id: `${timing.phase}:${sourceIndex}`,
      phase: timing.phase,
      label: phaseLabel(timing.phase),
      ...positionedTiming(timing.startOffset, timing.duration, record.totalDuration),
    }));
}
