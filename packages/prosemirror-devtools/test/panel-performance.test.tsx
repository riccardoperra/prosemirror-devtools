import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProseMirrorDevtoolsPanel } from "../src";
import { createProseMirrorDevtoolsStore } from "../src/core";
import { appendTextTransaction, createTestState, createTestView } from "./helpers";

const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const originalActEnvironment = reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT;

afterEach(() => {
  if (originalActEnvironment === undefined) {
    delete reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT;
  } else {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  }
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("performance panel", () => {
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
    const root = createRoot(container);
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    try {
      await act(async () => {
        root.render(
          <ProseMirrorDevtoolsPanel defaultTab="performance" store={store} theme="light" />,
        );
      });
      await act(async () => {
        await import("../src/panel/features/performance/performance-view");
      });

      const groups = Array.from(container.querySelectorAll<HTMLElement>(".pm-plugin-timing-group"));
      expect(groups.map((group) => group.dataset.pluginKey)).toEqual(["slow$", "fast$"]);

      const dispatchChart = container.querySelector<SVGElement>(
        'svg[role="img"][aria-label="Dispatch duration bar chart"]',
      );
      expect(dispatchChart).not.toBeNull();
      expect(dispatchChart?.getAttribute("tabindex")).toBe("0");
      expect(
        container.querySelector<HTMLElement>(".pm-dispatch-chart-plot")?.style.inlineSize,
      ).toBe("52px");
      const dispatchSegments = Array.from(dispatchChart?.querySelectorAll("rect") ?? []);
      expect(dispatchSegments.length).toBeGreaterThan(0);
      expect(dispatchSegments.every((segment) => segment.getAttribute("rx") === "0")).toBe(true);
      expect(container.querySelector(".pm-chart-selection")?.textContent).toBe(
        "Selected dispatch #1",
      );
      const pluginChart = container.querySelector<SVGElement>(
        'svg[role="img"][aria-label="Plugin cost ranking"]',
      );
      expect(pluginChart).not.toBeNull();
      expect(pluginChart?.textContent).toContain("14.00 ms");
      expect(container.querySelector(".pm-card-grid")).toBeNull();
      const performanceSummary = container.querySelector('[aria-label="Performance summary"]');
      expect(performanceSummary?.textContent).toContain("Dispatches1");
      expect(performanceSummary?.querySelectorAll(".pm-status-dot")).toHaveLength(5);
      expect(container.querySelector('[aria-label="Dispatch 1 timings"]')?.textContent).toContain(
        "Full dispatch18.0 ms",
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
      await act(async () => {
        documents?.querySelector<HTMLElement>("summary")?.click();
      });
      expect(documents?.open).toBe(true);
      expect(documents?.textContent).toContain("Before");
      expect(documents?.textContent).toContain("After");

      const cumulative = container.querySelector<HTMLDetailsElement>(".pm-cumulative-hooks");
      expect(cumulative?.open).toBe(false);

      const timelineButton = inspector?.querySelector<HTMLButtonElement>(
        '[aria-label="Dispatch cost view"] button:last-child',
      );
      await act(async () => {
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
    } finally {
      await act(async () => {
        root.unmount();
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
    const root = createRoot(container);
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    try {
      await act(async () => {
        root.render(
          <ProseMirrorDevtoolsPanel defaultTab="performance" store={store} theme="light" />,
        );
      });
      await act(async () => {
        await import("../src/panel/features/performance/performance-view");
      });

      const disclosure = container.querySelector<HTMLButtonElement>(
        ".pm-fast-plugin-disclosure > button",
      );
      const collapsedChart = container.querySelector<SVGElement>(
        'svg[aria-label="Plugin cost ranking"]',
      );
      expect(disclosure?.textContent).toContain("3 plugins < 0.01 ms");
      expect(disclosure?.getAttribute("aria-expanded")).toBe("false");
      expect(collapsedChart?.textContent).toContain("Fast 5");
      expect(collapsedChart?.textContent).not.toContain("Fast 6");

      await act(async () => {
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
      await act(async () => {
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
      await act(async () => {
        root.unmount();
      });
      unregister();
      view.destroy();
    }
  });
});
