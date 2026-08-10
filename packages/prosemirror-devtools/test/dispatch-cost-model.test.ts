import type { PluginTiming, TransactionRecord } from "../src/core";
import type { PluginTimingGroup } from "../src/performance";
import {
  buildDispatchCostCoverage,
  buildPhaseTimeline,
  buildPluginTimeline,
  getPluginRankingVisibility,
} from "../src/panel/features/performance/dispatch-cost/model";
import { buildPluginTimelineModel } from "../src/panel/features/performance/timeline/model";
import { describe, expect, it } from "vitest";

function group(pluginKey: string, duration: number): PluginTimingGroup {
  return {
    pluginKey,
    pluginLabel: pluginKey,
    callCount: 1,
    duration,
    hooks: [
      {
        hook: "state.apply",
        callCount: 1,
        duration,
        maxDuration: duration,
      },
    ],
  };
}

function record(
  totalDuration: number,
  timings: readonly PluginTiming[],
  phaseTimings: TransactionRecord["phaseTimings"] = [],
): TransactionRecord {
  return {
    totalDuration,
    timings,
    phaseTimings,
  } as unknown as TransactionRecord;
}

describe("dispatch cost model", () => {
  it("reconciles full dispatch time without double-counting nested plugin hooks", () => {
    const value = buildDispatchCostCoverage(
      record(10, [
        {
          pluginKey: "outer$",
          pluginLabel: "Outer",
          hook: "state.apply",
          startOffset: 1,
          duration: 4,
        },
        {
          pluginKey: "inner$",
          pluginLabel: "Inner",
          hook: "props.decorations",
          startOffset: 2,
          duration: 1,
        },
        {
          pluginKey: "later$",
          pluginLabel: "Later",
          hook: "view.update",
          startOffset: 6,
          duration: 2,
        },
      ]),
    );

    expect(value).toEqual({
      totalDuration: 10,
      measuredPluginDuration: 6,
      otherSyncDuration: 4,
      measuredPluginPercentage: 60,
      otherSyncPercentage: 40,
    });
  });

  it("keeps five sub-0.01 ms plugins visible and collapses the rest", () => {
    const groups = [
      group("slow", 0.5),
      ...Array.from({ length: 8 }, (_, i) => group(`fast-${i}`, 0.005)),
    ];
    const collapsed = getPluginRankingVisibility(groups, false);

    expect(collapsed.visibleGroups.map((item) => item.pluginKey)).toEqual([
      "slow",
      "fast-0",
      "fast-1",
      "fast-2",
      "fast-3",
      "fast-4",
    ]);
    expect(collapsed.hiddenFastGroups.map((item) => item.pluginKey)).toEqual([
      "fast-5",
      "fast-6",
      "fast-7",
    ]);
    expect(getPluginRankingVisibility(groups, true).visibleGroups).toBe(groups);
  });

  it("sorts plugin calls by start time and identifies synchronous nesting", () => {
    const entries = buildPluginTimeline(
      record(10, [
        {
          pluginKey: "inner$",
          pluginLabel: "Inner",
          hook: "props.decorations",
          startOffset: 2,
          duration: 2,
        },
        {
          pluginKey: "outer$",
          pluginLabel: "Outer",
          hook: "state.apply",
          startOffset: 1,
          duration: 5,
        },
        {
          pluginKey: "later$",
          pluginLabel: "Later",
          hook: "view.update",
          startOffset: 7,
          duration: 1,
        },
      ]),
    );

    expect(
      entries.map(({ pluginKey, sequence, depth, startPercentage, durationPercentage }) => ({
        pluginKey,
        sequence,
        depth,
        startPercentage,
        durationPercentage,
      })),
    ).toEqual([
      {
        pluginKey: "outer$",
        sequence: 1,
        depth: 0,
        startPercentage: 10,
        durationPercentage: 50,
      },
      {
        pluginKey: "inner$",
        sequence: 2,
        depth: 1,
        startPercentage: 20,
        durationPercentage: 20,
      },
      {
        pluginKey: "later$",
        sequence: 3,
        depth: 0,
        startPercentage: 70,
        durationPercentage: 10,
      },
    ]);
  });

  it("positions recorded phase spans on the same dispatch scale", () => {
    const value = record(
      8,
      [],
      [
        { phase: "apply", startOffset: 1, duration: 2 },
        { phase: "viewUpdate", startOffset: 4, duration: 3 },
      ],
    );

    expect(
      buildPhaseTimeline(value).map(({ label, startPercentage, durationPercentage }) => ({
        label,
        startPercentage,
        durationPercentage,
      })),
    ).toEqual([
      { label: "State apply", startPercentage: 12.5, durationPercentage: 25 },
      { label: "View update", startPercentage: 50, durationPercentage: 37.5 },
    ]);
  });

  it("builds lanes with overview first and plugin calls in strict chronological order", () => {
    const value = record(
      8,
      [
        {
          pluginKey: "third$",
          pluginLabel: "Third",
          hook: "view.update",
          startOffset: 5,
          duration: 1,
        },
        {
          pluginKey: "second$",
          pluginLabel: "Second",
          hook: "props.decorations",
          startOffset: 2,
          duration: 1,
        },
        {
          pluginKey: "first$",
          pluginLabel: "First",
          hook: "state.apply",
          startOffset: 1,
          duration: 4,
        },
      ],
      [
        { phase: "viewUpdate", startOffset: 4, duration: 3 },
        { phase: "apply", startOffset: 0.5, duration: 3 },
      ],
    );

    const lanes = buildPluginTimelineModel(value).lanes;
    const calls = lanes.filter((lane) => lane.kind === "plugin");

    expect(lanes.map((lane) => lane.kind)).toEqual([
      "dispatch",
      "phase",
      "phase",
      "plugin",
      "plugin",
      "plugin",
    ]);
    expect(calls.map((lane) => lane.label)).toEqual(["First", "Second", "Third"]);
    expect(calls.map((lane) => lane.sequence)).toEqual([1, 2, 3]);
    expect(calls.map((lane) => lane.startOffset)).toEqual([1, 2, 5]);
  });
});
