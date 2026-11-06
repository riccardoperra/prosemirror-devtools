import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProseMirrorDevtoolsPanel } from "../src";
import { attachProseMirrorDevtools, createProseMirrorDevtoolsStore } from "../src/core";
import {
  buildInitializationTimelineEntry,
  calculateFrameRate,
  createDispatchDurationScale,
  resolveAdaptiveDetailThreshold,
  resolveDispatchTimelineScale,
} from "../src/panel/features/performance/overview/dispatch-timeline";
import { appendTextTransaction, createTestState, createTestView } from "./helpers";

async function flush(callback: () => void | Promise<void>): Promise<void> {
  await callback();
  await Promise.resolve();
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("performance panel", () => {
  it("uses the configured frame budget as the timeline scale floor", () => {
    const fastScale = resolveDispatchTimelineScale(0.5, 20, 0.5);
    const slowScale = resolveDispatchTimelineScale(40, 20, 0.5);
    const fallbackScale = resolveDispatchTimelineScale(0.5, Number.NaN, 0.5);
    const adaptiveDetail = resolveAdaptiveDetailThreshold(
      [0.1, 0.2, 0.3, 0.4, 1, 2, 3, 4, 5, 6],
      20,
    );

    expect(fastScale.frameBudgetMs).toBe(20);
    expect(fastScale.frameRate).toBe(50);
    expect(fastScale.detailThresholdMs).toBe(0.5);
    expect(fastScale.maximum).toBeCloseTo(23);
    expect(slowScale.maximum).toBeCloseTo(46);
    expect(fallbackScale.frameBudgetMs).toBeCloseTo(1000 / 60);
    expect(adaptiveDetail.sampleSize).toBe(2);
    expect(adaptiveDetail.shortAverageMs).toBeCloseTo(0.15);
    expect(adaptiveDetail.thresholdMs).toBeCloseTo(0.6);
    expect(calculateFrameRate(0)).toBe(60);
    expect(calculateFrameRate(17.7)).toBe(56);

    const detailScale = createDispatchDurationScale(fastScale.maximum, 0.5).range([0, 114]);
    expect(detailScale(Number.EPSILON)).toBeCloseTo(6);
    expect(detailScale(0.1)).toBeGreaterThan(6);
    expect(detailScale(0.2)).toBeGreaterThan(detailScale(0.1));
    expect(detailScale(0.5)).toBeCloseTo(42);
  });

  it("shows dispatches below timer resolution and keeps bars tightly packed", async () => {
    vi.spyOn(performance, "now").mockReturnValue(100);
    const store = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState());
    const attachment = attachProseMirrorDevtools({
      id: "editor",
      performanceMarks: false,
      store,
      view,
    });

    // Real state application and view update work occurs, but a quantized clock can return the
    // same value at every boundary.
    view.dispatch(appendTextTransaction(view.state, "x"));
    expect(store.getInstance("editor")?.transactions[0]).toMatchObject({
      totalDuration: 0,
      applyDuration: 0,
      viewUpdateDuration: 0,
    });

    const container = document.createElement("div");
    document.body.append(container);
    let dispose = (): void => {};

    try {
      await flush(async () => {
        dispose = render(
          () => <ProseMirrorDevtoolsPanel defaultTab="performance" store={store} theme="light" />,
          container,
        );
      });
      await flush(async () => {
        await import("../src/panel/features/performance/performance-view");
      });

      const chart = container.querySelector<SVGElement>(
        'svg[aria-label="Dispatch duration bar chart"]',
      );
      const markers = Array.from(
        chart?.querySelectorAll<SVGRectElement>(".ts-chart__bar-y > rect") ?? [],
      );

      // State application and view update are both present in one unified stack even though their
      // individual clock deltas are zero.
      expect(markers).toHaveLength(2);
      expect(markers.map((marker) => marker.getAttribute("fill"))).toEqual([
        "var(--pm-accent)",
        "var(--pm-green)",
      ]);
      expect(
        markers.reduce((height, marker) => height + Number(marker.getAttribute("height")), 0),
      ).toBeGreaterThanOrEqual(5.9);
      // The band itself controls width. A fixed 22px cap previously created large gaps as the
      // panel widened while bars stayed narrow.
      expect(markers.every((marker) => Number(marker.getAttribute("width")) > 22)).toBe(true);
      expect(chart?.textContent).toContain("below the browser timer resolution");
    } finally {
      await flush(async () => {
        dispose();
      });
      attachment.detach();
      view.destroy();
    }
  });

  it("follows newly recorded dispatches until the user selects history", async () => {
    const store = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState());
    const attachment = attachProseMirrorDevtools({
      id: "editor",
      performanceMarks: false,
      store,
      view,
    });
    view.dispatch(appendTextTransaction(view.state, "a"));

    const container = document.createElement("div");
    document.body.append(container);
    let dispose = (): void => {};

    try {
      await flush(async () => {
        dispose = render(
          () => <ProseMirrorDevtoolsPanel defaultTab="performance" store={store} theme="light" />,
          container,
        );
      });
      await flush(async () => {
        await import("../src/panel/features/performance/performance-view");
      });

      const selection = () =>
        container.querySelector<HTMLOutputElement>('[aria-label="Dispatch selection"] output');
      const chart = () => container.querySelector<HTMLElement>(".pm-dispatch-chart");
      expect(selection()?.textContent).toBe("1 / 1");
      expect(chart()?.dataset.selectedId).toBe("1");

      await flush(async () => {
        view.dispatch(appendTextTransaction(view.state, "b"));
      });
      expect(selection()?.textContent).toBe("2 / 2");
      expect(chart()?.dataset.selectedId).toBe("2");

      // An explicit historical selection is sticky, so live recording does not pull the user's
      // inspection away. Returning to the newest item resumes follow mode.
      await flush(async () => {
        container
          .querySelector<HTMLButtonElement>('[aria-label="Select previous dispatch"]')
          ?.click();
      });
      expect(selection()?.textContent).toBe("1 / 2");

      await flush(async () => {
        view.dispatch(appendTextTransaction(view.state, "c"));
      });
      expect(selection()?.textContent).toBe("1 / 3");
      expect(chart()?.dataset.selectedId).toBe("1");
    } finally {
      await flush(async () => {
        dispose();
      });
      attachment.detach();
      view.destroy();
    }
  });

  it("shows initialization before the first dispatch and keeps sparse timeline entries packed", async () => {
    let clock = 100;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const store = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState());

    store.measurePluginHook("editor", "startup$", "Startup plugin", "state.init", () => {
      clock += 3;
    });
    store.measurePluginHook("editor", "startup$", "Startup plugin", "view.create", () => {
      clock += 2;
    });
    const unregister = store.register({ id: "editor", label: "Editor", view });
    const instance = store.getInstance("editor");
    if (!instance) throw new Error("Expected the editor to be registered");
    expect(buildInitializationTimelineEntry(instance)).toMatchObject({
      instanceId: "editor",
      instanceLabel: "Editor",
      duration: 5,
      stateInitDuration: 3,
      viewCreateDuration: 2,
      pluginCount: 1,
      hookCount: 2,
    });

    const container = document.createElement("div");
    document.body.append(container);
    let dispose = (): void => {};

    try {
      await flush(async () => {
        dispose = render(
          () => <ProseMirrorDevtoolsPanel defaultTab="performance" store={store} theme="light" />,
          container,
        );
      });
      await flush(async () => {
        await import("../src/panel/features/performance/performance-view");
      });

      const chartContainer = container.querySelector<HTMLElement>(".pm-dispatch-chart");
      const chart = container.querySelector<SVGElement>(
        'svg[aria-label="Dispatch duration bar chart"]',
      );
      expect(container.querySelector(".pm-empty")).toBeNull();
      expect(chart).not.toBeNull();
      expect(chart?.textContent).toContain("first yellow bar");
      expect(chartContainer?.dataset.hasInitialization).toBe("true");
      expect(chartContainer?.dataset.slotCount).toBe("61");
      expect(container.querySelector(".pm-chart-legend")?.textContent).toContain("initialization");
      expect(container.querySelector('[aria-label="Dispatch selection"] output')?.textContent).toBe(
        "0 / 0",
      );

      await flush(async () => {
        const transaction = appendTextTransaction(view.state, "x");
        const measurement = store.beginTransaction("editor", transaction, view.state, false);
        clock += 1;
        const applied = view.state.applyTransaction(transaction);
        view.updateState(applied.state);
        store.finishTransaction(measurement, {
          stateAfter: applied.state,
          appliedTransactions: applied.transactions,
        });
      });

      const updatedChart = container.querySelector<SVGElement>(
        'svg[aria-label="Dispatch duration bar chart"]',
      );
      const barPositions = [
        ...new Set(
          Array.from(updatedChart?.querySelectorAll(".ts-chart__bar-y > rect") ?? [], (rect) =>
            Number(rect.getAttribute("x")),
          ),
        ),
      ].sort((left, right) => left - right);
      expect(barPositions).toHaveLength(2);
      expect((barPositions[1] ?? 0) - (barPositions[0] ?? 0)).toBeLessThan(40);

      const widestHorizontalLine = Math.max(
        ...Array.from(updatedChart?.querySelectorAll("line") ?? [], (line) => {
          if (line.getAttribute("y1") !== line.getAttribute("y2")) return 0;
          return Math.abs(Number(line.getAttribute("x2")) - Number(line.getAttribute("x1")));
        }),
        0,
      );
      expect(widestHorizontalLine).toBeGreaterThan(1_500);
    } finally {
      await flush(async () => {
        dispose();
      });
      unregister();
      view.destroy();
    }
  });

  it("renders the selected dispatch grouped by slowest synchronous plugin cost", async () => {
    let clock = 100;
    vi.spyOn(performance, "now").mockImplementation(() => clock);

    const store = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState());
    const unregister = store.register({ id: "editor", view });
    const transaction = appendTextTransaction(view.state, "x");
    const measurement = store.beginTransaction("editor", transaction, view.state, false);

    store.measurePluginHook("editor", "slow$", "Slow plugin", "state.apply", () => {
      clock += 2;
      store.measurePluginHook("editor", "slow$", "Slow plugin", "props.decorations", () => {
        clock += 2;
      });
      clock += 2;
    });
    store.measurePluginHook("editor", "fast$", "Fast plugin", "filterTransaction", () => {
      clock += 4;
    });
    store.measurePluginHook("editor", "slow$", "Slow plugin", "state.apply", () => {
      clock += 3;
    });
    store.measurePluginHook("editor", "slow$", "Slow plugin", "view.update", () => {
      clock += 5;
    });
    store.addMarker("editor", "Collaboration rebase", {
      category: "collaboration",
      tone: "info",
      data: { version: 7 },
    });

    const applied = view.state.applyTransaction(transaction);
    view.updateState(applied.state);
    store.finishTransaction(measurement, {
      stateAfter: applied.state,
      appliedTransactions: applied.transactions,
    });

    const container = document.createElement("div");
    document.body.append(container);
    let dispose = (): void => {};

    try {
      await flush(async () => {
        dispose = render(
          () => <ProseMirrorDevtoolsPanel defaultTab="performance" store={store} theme="light" />,
          container,
        );
      });
      await flush(async () => {
        await import("../src/panel/features/performance/performance-view");
      });

      const groups = Array.from(container.querySelectorAll<HTMLElement>(".pm-plugin-timing-group"));
      expect(groups.map((group) => group.dataset.pluginKey)).toEqual(["slow$", "fast$"]);

      const dispatchChart = container.querySelector<SVGElement>(
        'svg[role="img"][aria-label="Dispatch duration bar chart"]',
      );
      expect(dispatchChart).not.toBeNull();
      expect(dispatchChart?.getAttribute("tabindex")).toBe("0");
      expect(container.querySelector(".pm-frame-budget-label")?.textContent).toBe(
        "Frame budget: 16.7 ms (60 FPS target)",
      );
      expect(container.querySelector(".pm-duration-scale-note")).toBeNull();
      expect(container.querySelector(".pm-chart-axis-unit")).toBeNull();
      expect(dispatchChart?.textContent).not.toContain("Dispatch time (ms)");
      expect(dispatchChart?.textContent).toContain("recent dispatches");
      const dispatchChartContainer = container.querySelector<HTMLElement>(".pm-dispatch-chart");
      expect(Number(dispatchChartContainer?.dataset.frameBudgetMs)).toBeCloseTo(1000 / 60);
      expect(dispatchChartContainer?.dataset.detailThresholdMode).toBe("auto");
      expect(Number(dispatchChartContainer?.dataset.detailThresholdMs)).toBeCloseTo(
        (1000 / 60) * 0.25,
      );
      expect(Number(dispatchChartContainer?.dataset.scaleMaximumMs)).toBeCloseTo(18 * 1.15);
      const dispatchSegments = Array.from(dispatchChart?.querySelectorAll("rect") ?? []);
      expect(dispatchSegments.length).toBeGreaterThan(0);
      expect(dispatchSegments.every((segment) => segment.getAttribute("rx") === "0")).toBe(true);
      const dispatchSelection = container.querySelector('[aria-label="Dispatch selection"]');
      expect(dispatchSelection?.querySelector("output")?.textContent).toBe("1 / 1");
      expect(
        Array.from(dispatchSelection?.querySelectorAll("button") ?? []).every(
          (button) => button.disabled,
        ),
      ).toBe(true);
      const pluginChart = container.querySelector<SVGElement>(
        'svg[role="img"][aria-label="Plugin cost ranking"]',
      );
      expect(pluginChart).not.toBeNull();
      expect(pluginChart?.textContent).toContain("14.00 ms");
      expect(container.querySelector(".pm-card-grid")).toBeNull();
      const performanceSummary = container.querySelector('[aria-label="Performance summary"]');
      expect(performanceSummary?.textContent).toContain("Dispatches1");
      expect(performanceSummary?.textContent).toContain("Average18.0 ms");
      expect(performanceSummary?.textContent).not.toContain("retained");
      expect(performanceSummary?.querySelectorAll(".pm-chart-summary-metric")).toHaveLength(4);
      expect(container.querySelectorAll(".pm-performance-toolbar")).toHaveLength(1);
      expect(container.querySelector(".pm-performance-view > .pm-compact-metrics")).toBeNull();
      expect(container.querySelector('[aria-label="Dispatch 1 timings"]')?.textContent).toContain(
        "Synchronous dispatch18.0 ms",
      );

      const slowGroup = groups[0];
      if (!slowGroup) throw new Error("Expected the slow plugin timing group");
      expect(slowGroup.getAttribute("aria-label")).toBeNull();
      expect(slowGroup.querySelector(".pm-row-title")?.textContent).toBe("Slow plugin");
      expect(slowGroup.querySelector(".pm-row-detail")?.textContent).toContain("3 hooks · 4 calls");
      expect(slowGroup.querySelector(".pm-plugin-full-value")?.textContent).toBe("14.0 ms");
      expect(slowGroup.querySelector(".pm-plugin-full-label")?.textContent).toBe("full sync");
      const slowMeter = slowGroup.querySelector<HTMLElement>(".pm-plugin-full-meter > span");
      expect(Number.parseFloat(slowMeter?.style.width ?? "")).toBeCloseTo((14 / 18) * 100);

      const hookChips = Array.from(slowGroup.querySelectorAll<HTMLElement>(".pm-plugin-hook-chip"));
      expect(
        hookChips.map((chip) => ({
          hook: chip.querySelector(".pm-plugin-hook-name")?.textContent,
          duration: chip.querySelector(".pm-mono")?.textContent,
          count: chip.querySelector(".pm-plugin-hook-count")?.textContent ?? null,
          family: chip.dataset.family,
          ariaLabel: chip.getAttribute("aria-label"),
          title: chip.title,
        })),
      ).toEqual([
        {
          hook: "state.apply",
          duration: "9.00 ms",
          count: "×2",
          family: "state",
          ariaLabel: "state.apply, 9.00 ms, 2 calls, maximum call 6.00 ms",
          title: "2 calls; max 6.00 ms",
        },
        {
          hook: "view.update",
          duration: "5.00 ms",
          count: null,
          family: "view",
          ariaLabel: "view.update, 5.00 ms, 1 call, maximum call 5.00 ms",
          title: "1 call; max 5.00 ms",
        },
        {
          hook: "Decoration change",
          duration: "2.00 ms",
          count: null,
          family: "view",
          ariaLabel: "Decoration change, 2.00 ms, 1 call, maximum call 2.00 ms",
          title:
            "DecorationSet producer (props.decorations); later mapping and reconciliation stay in view update. 1 call; max 2.00 ms",
        },
      ]);

      const fastGroup = groups[1];
      expect(fastGroup?.querySelector(".pm-row-title")?.textContent).toBe("Fast plugin");
      expect(fastGroup?.querySelector(".pm-plugin-full-value")?.textContent).toBe("4.00 ms");

      const inspector = container.querySelector<HTMLElement>('[aria-label="Dispatch 1 inspector"]');
      expect(inspector?.querySelector('[role="tablist"]')).toBeNull();
      expect(inspector?.querySelector('[aria-label="Dispatch cost"]')).not.toBeNull();
      expect(inspector?.querySelector('[aria-label="Transaction details"]')).not.toBeNull();
      expect(inspector?.querySelector(".pm-dispatch-cost-meter")?.getAttribute("aria-label")).toBe(
        "18.0 ms in measured plugin hooks and <0.01 ms in other synchronous dispatch work",
      );
      expect(inspector?.querySelector('[aria-label="Dispatch cost view"]')).not.toBeNull();
      expect(inspector?.textContent).not.toContain("Steps / applied");
      expect(inspector?.textContent).toContain("Steps1");
      expect(inspector?.textContent).toContain("Applied transactions1");
      const markers = inspector?.querySelector('[aria-label="Custom markers"]');
      expect(markers?.textContent).toContain("Collaboration rebase");
      expect(markers?.textContent).toContain("collaboration · at 18.0 ms");
      expect(markers?.textContent).toContain("version");
      const appliedTransaction =
        inspector?.querySelector<HTMLDetailsElement>(".pm-transaction-record");
      expect(appliedTransaction?.open).toBe(true);
      expect(appliedTransaction?.querySelector(".pm-transaction-kind")?.textContent).toBe("Root");
      expect(appliedTransaction?.textContent).toContain("Transaction 1");
      expect(appliedTransaction?.textContent).toContain("Steps1");
      expect(inspector?.querySelector(".pm-plugin-timing-group")).not.toBeNull();
      expect(
        inspector?.querySelector<HTMLDetailsElement>(".pm-plugin-breakdown-details")?.open,
      ).toBe(false);

      const stepsSection = appliedTransaction?.querySelector(
        ".pm-transaction-payload > section:first-child",
      );
      expect(
        stepsSection?.querySelectorAll('[aria-label="Collapse value"]').length,
      ).toBeGreaterThanOrEqual(4);
      expect(inspector?.textContent).not.toContain("Changed ranges");
      expect(inspector?.textContent).toContain("Selection");

      const documents = inspector?.querySelector<HTMLDetailsElement>(".pm-document-disclosure");
      expect(documents?.open).toBe(false);
      await flush(async () => {
        documents?.querySelector<HTMLElement>("summary")?.click();
      });
      expect(documents?.open).toBe(true);
      await vi.waitFor(() => expect(documents?.querySelector(".pm-detail-columns")).not.toBeNull());
      expect(documents?.textContent).toContain("Before");
      expect(documents?.textContent).toContain("After");

      const cumulative = container.querySelector<HTMLDetailsElement>(".pm-cumulative-hooks");
      expect(cumulative?.open).toBe(false);

      const timelineButton = inspector?.querySelector<HTMLButtonElement>(
        '[aria-label="Dispatch cost view"] button:last-child',
      );
      await flush(async () => {
        timelineButton?.click();
      });
      expect(timelineButton?.getAttribute("aria-pressed")).toBe("true");
      const timelineCalls = Array.from(
        inspector?.querySelectorAll<HTMLElement>('.pm-timeline-lane-label[data-kind="plugin"]') ??
          [],
      );
      expect(timelineCalls).toHaveLength(5);
      expect(timelineCalls.map((row) => row.dataset.depth)).toEqual(["0", "1", "0", "0", "0"]);
      expect(timelineCalls.map((row) => Number(row.dataset.sequence))).toEqual([1, 2, 3, 4, 5]);
      expect(timelineCalls.map((row) => Number(row.dataset.startOffset))).toEqual([
        0, 2, 6, 10, 13,
      ]);
      expect(timelineCalls[0]?.textContent).toContain("Slow pluginstate.apply");
      expect(timelineCalls[1]?.textContent).toContain("Slow plugin");
      expect(timelineCalls[1]?.textContent).toContain("↳ Decoration change");
      expect(
        inspector?.querySelector('.pm-timeline-lane-label[data-kind="dispatch"]')?.textContent,
      ).toContain("Full dispatchSynchronous boundary · 18.0 ms");
      const orderedTimeline = inspector?.querySelector<SVGElement>(
        'svg[aria-label="Ordered synchronous dispatch timeline"]',
      );
      expect(orderedTimeline).not.toBeNull();
      expect(orderedTimeline?.getAttribute("tabindex")).toBe("0");
      expect(orderedTimeline?.querySelectorAll("rect").length).toBeGreaterThanOrEqual(6);
      expect(
        inspector?.querySelector<HTMLElement>(".pm-timeline-chart-surface")?.style.minInlineSize,
      ).toBe("960px");

      await flush(async () => {
        const nextTransaction = appendTextTransaction(view.state, "y");
        const nextMeasurement = store.beginTransaction(
          "editor",
          nextTransaction,
          view.state,
          false,
        );
        clock += 1;
        const nextApplied = view.state.applyTransaction(nextTransaction);
        view.updateState(nextApplied.state);
        store.finishTransaction(nextMeasurement, {
          stateAfter: nextApplied.state,
          appliedTransactions: nextApplied.transactions,
        });
      });

      const previousButton = container.querySelector<HTMLButtonElement>(
        '[aria-label="Select previous dispatch"]',
      );
      const nextButton = container.querySelector<HTMLButtonElement>(
        '[aria-label="Select next dispatch"]',
      );
      expect(previousButton?.disabled).toBe(false);
      expect(nextButton?.disabled).toBe(true);
      expect(dispatchSelection?.querySelector("output")?.textContent).toBe("2 / 2");
      expect(container.querySelector('[aria-label="Dispatch 2 inspector"]')).not.toBeNull();
      await flush(async () => {
        previousButton?.click();
      });
      expect(dispatchSelection?.querySelector("output")?.textContent).toBe("1 / 2");
      expect(container.querySelector('[aria-label="Dispatch 1 inspector"]')).not.toBeNull();
    } finally {
      await flush(async () => {
        dispose();
      });
      unregister();
      view.destroy();
    }
  });

  it("collapses very fast plugins in the ranking and expands them on demand", async () => {
    let clock = 200;
    vi.spyOn(performance, "now").mockImplementation(() => clock);

    const store = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState());
    const unregister = store.register({ id: "editor", view });
    const transaction = appendTextTransaction(view.state, "x");
    const measurement = store.beginTransaction("editor", transaction, view.state, false);

    for (let index = 0; index < 8; index += 1) {
      store.measurePluginHook(
        "editor",
        `fast-${index}$`,
        `Fast ${index + 1}`,
        "state.apply",
        () => {
          clock += 0.005;
        },
      );
    }
    clock += 10;
    store.finishTransaction(measurement, {
      stateAfter: view.state,
      appliedTransactions: [],
    });

    const container = document.createElement("div");
    document.body.append(container);
    let dispose = (): void => {};

    try {
      await flush(async () => {
        dispose = render(
          () => (
            <ProseMirrorDevtoolsPanel
              defaultTab="performance"
              performanceDetailThresholdMs={0.25}
              performanceFrameBudgetMs={8}
              store={store}
              theme="light"
            />
          ),
          container,
        );
      });
      await flush(async () => {
        await import("../src/panel/features/performance/performance-view");
      });

      const disclosure = container.querySelector<HTMLButtonElement>(
        ".pm-fast-plugin-disclosure > button",
      );
      expect(container.querySelector(".pm-frame-budget-label")?.textContent).toBe(
        "Frame budget: 8.00 ms (125 FPS target)",
      );
      expect(container.querySelector(".pm-duration-scale-note")).toBeNull();
      expect(
        container.querySelector<HTMLElement>(".pm-dispatch-chart")?.dataset.detailThresholdMode,
      ).toBe("fixed");
      const collapsedChart = container.querySelector<SVGElement>(
        'svg[aria-label="Plugin cost ranking"]',
      );
      expect(disclosure?.textContent).toContain("3 plugins < 0.01 ms");
      expect(disclosure?.getAttribute("aria-expanded")).toBe("false");
      expect(collapsedChart?.textContent).toContain("Fast 5");
      expect(collapsedChart?.textContent).not.toContain("Fast 6");

      await flush(async () => {
        disclosure?.click();
      });

      const expandedChart = container.querySelector<SVGElement>(
        'svg[aria-label="Plugin cost ranking"]',
      );
      expect(disclosure?.getAttribute("aria-expanded")).toBe("true");
      expect(disclosure?.textContent).toContain("Hide 3 plugins under 0.01 ms");
      expect(expandedChart?.textContent).toContain("Fast 8");

      const timelineButton = container.querySelector<HTMLButtonElement>(
        '[aria-label="Dispatch cost view"] button:last-child',
      );
      await flush(async () => {
        timelineButton?.click();
      });

      const tinyCallLanes = Array.from(
        container.querySelectorAll<HTMLElement>('.pm-timeline-lane-label[data-kind="plugin"]'),
      );
      const timeline = container.querySelector<SVGElement>(
        'svg[aria-label="Ordered synchronous dispatch timeline"]',
      );
      const allIntervals = Array.from(timeline?.querySelectorAll(".ts-chart__rect rect") ?? []);
      const tinyCallIntervals = allIntervals.slice(-8);
      expect(tinyCallLanes.map((lane) => Number(lane.dataset.sequence))).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8,
      ]);
      expect(tinyCallIntervals).toHaveLength(8);
      expect(
        tinyCallIntervals.every((interval) => {
          const width = Number(interval.getAttribute("width"));
          const height = Number(interval.getAttribute("height"));
          return width >= 1.9 && width <= 2.1 && height > width;
        }),
      ).toBe(true);
      expect(timeline?.querySelector(".ts-chart__dot")).toBeNull();
    } finally {
      await flush(async () => {
        dispose();
      });
      unregister();
      view.destroy();
    }
  });
});
