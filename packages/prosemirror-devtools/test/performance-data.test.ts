import {
  buildDispatchPhaseBreakdown,
  buildPerformanceSummary,
  groupPluginTimings,
  type PluginHook,
  type PluginTiming,
} from "../src/performance";
import { describe, expect, it } from "vitest";

function timing(
  pluginKey: string,
  pluginLabel: string,
  hook: PluginHook,
  startOffset: number,
  duration: number,
): PluginTiming {
  return { pluginKey, pluginLabel, hook, startOffset, duration };
}

describe("buildPerformanceSummary", () => {
  it("summarizes retained history beyond the JavaScript argument limit", () => {
    const records = Array.from({ length: 200_000 }, (_, index) => ({ totalDuration: index % 100 }));

    expect(buildPerformanceSummary(records)).toMatchObject({
      average: 49.5,
      percentile95: 94,
      maximum: 99,
    });
  });
});

describe("groupPluginTimings", () => {
  it("returns no groups for no timing samples", () => {
    expect(groupPluginTimings([])).toEqual([]);
  });

  it("uses interval unions for nested, overlapping, and repeated hook spans", () => {
    const timings = [
      timing("alpha$", "Alpha", "state.apply", 2, 3),
      timing("alpha$", "Alpha", "props.decorations", 4, 2),
      timing("alpha$", "Alpha", "state.apply", 0, 10),
      timing("alpha$", "Alpha", "state.apply", 12, 4),
    ];

    expect(groupPluginTimings(timings)).toEqual([
      {
        pluginKey: "alpha$",
        pluginLabel: "Alpha",
        callCount: 4,
        duration: 14,
        hooks: [
          {
            hook: "state.apply",
            callCount: 3,
            duration: 14,
            maxDuration: 10,
          },
          {
            hook: "props.decorations",
            callCount: 1,
            duration: 2,
            maxDuration: 2,
          },
        ],
      },
    ]);
  });

  it("produces the same coverage from nonchronological completion order", () => {
    const chronological = [
      timing("plugin$", "Plugin", "state.apply", 0, 12),
      timing("plugin$", "Plugin", "props.decorations", 2, 4),
      timing("plugin$", "Plugin", "props.handleKeyDown", 14, 3),
    ];
    const completionOrder = [chronological[1], chronological[0], chronological[2]].filter(
      (sample): sample is PluginTiming => sample !== undefined,
    );

    expect(groupPluginTimings(completionOrder)).toEqual(groupPluginTimings(chronological));
    expect(groupPluginTimings(completionOrder)[0]).toMatchObject({
      callCount: 3,
      duration: 15,
    });
  });

  it("keeps equal labels separate and resolves group ties by label then key", () => {
    const timings = [
      timing("zeta$", "Shared label", "state.apply", 0, 4),
      timing("bravo$", "Bravo", "state.apply", 0, 7),
      timing("alpha$", "Shared label", "state.apply", 0, 4),
      timing("omega$", "Earlier label", "state.apply", 0, 4),
    ];

    expect(
      groupPluginTimings(timings).map(({ pluginKey, pluginLabel, duration }) => ({
        pluginKey,
        pluginLabel,
        duration,
      })),
    ).toEqual([
      { pluginKey: "bravo$", pluginLabel: "Bravo", duration: 7 },
      { pluginKey: "omega$", pluginLabel: "Earlier label", duration: 4 },
      { pluginKey: "alpha$", pluginLabel: "Shared label", duration: 4 },
      { pluginKey: "zeta$", pluginLabel: "Shared label", duration: 4 },
    ]);
  });

  it("sorts equal-duration hooks deterministically by hook name", () => {
    const groups = groupPluginTimings([
      timing("plugin$", "Plugin", "state.apply", 0, 3),
      timing("plugin$", "Plugin", "filterTransaction", 4, 3),
      timing("plugin$", "Plugin", "appendTransaction", 8, 1),
    ]);

    expect(groups[0]?.hooks.map(({ hook, duration }) => ({ hook, duration }))).toEqual([
      { hook: "filterTransaction", duration: 3 },
      { hook: "state.apply", duration: 3 },
      { hook: "appendTransaction", duration: 1 },
    ]);
  });

  it("computes overlapping plugin coverage independently for each plugin", () => {
    const groups = groupPluginTimings([
      timing("outer$", "Outer", "state.apply", 0, 10),
      timing("inner$", "Inner", "props.decorations", 2, 4),
      timing("inner$", "Inner", "view.update", 4, 3),
    ]);

    expect(
      groups.map(({ pluginKey, callCount, duration }) => ({
        pluginKey,
        callCount,
        duration,
      })),
    ).toEqual([
      { pluginKey: "outer$", callCount: 1, duration: 10 },
      { pluginKey: "inner$", callCount: 2, duration: 5 },
    ]);
  });

  it("retains zero-duration calls without inflating coverage or maxima", () => {
    expect(
      groupPluginTimings([
        timing("zero$", "Zero", "state.apply", 3, 0),
        timing("zero$", "Zero", "state.apply", 7, 0),
      ]),
    ).toEqual([
      {
        pluginKey: "zero$",
        pluginLabel: "Zero",
        callCount: 2,
        duration: 0,
        hooks: [
          {
            hook: "state.apply",
            callCount: 2,
            duration: 0,
            maxDuration: 0,
          },
        ],
      },
    ]);
  });
});

describe("buildDispatchPhaseBreakdown", () => {
  it("merges nested observations into mutually exclusive phase durations", () => {
    expect(
      buildDispatchPhaseBreakdown({
        totalDuration: 20,
        phaseTimings: [
          { phase: "customDispatch", startOffset: 0, duration: 20 },
          { phase: "apply", startOffset: 2, duration: 6 },
          { phase: "apply", startOffset: 3, duration: 2 },
          { phase: "viewUpdate", startOffset: 6, duration: 6 },
        ],
      }),
    ).toEqual({
      totalDuration: 20,
      applyDuration: 6,
      viewUpdateDuration: 4,
      customCodeDuration: 10,
      otherDuration: 0,
    });
  });
});
