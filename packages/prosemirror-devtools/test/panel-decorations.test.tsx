import { EditorView } from "prosemirror-view";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  DevtoolsDecorationSource,
  DevtoolsDiagnosticsController,
  DevtoolsDiagnosticsSnapshot,
  DevtoolsNodeViewRecord,
} from "../src/core/diagnostics";
import type { RegisteredProseMirrorInstance } from "../src/core/types";
import { mountDecorationOverlay } from "../src/panel/features/decorations/decoration-overlay";
import { DecorationsView } from "../src/panel/features/decorations/decorations-view";
import { createTestState, createTestView } from "./helpers";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function diagnostics(initial: Partial<DevtoolsDiagnosticsSnapshot> = {}) {
  let snapshot: DevtoolsDiagnosticsSnapshot = {
    version: 0,
    events: [],
    decorations: [],
    nodeViews: [],
    ...initial,
  };
  const listeners = new Set<() => void>();
  const controller: DevtoolsDiagnosticsController = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clearEvents() {},
    clearNodeViews() {},
    traceCommand(_name, run) {
      return run();
    },
    dispose() {
      listeners.clear();
    },
  };
  return {
    controller,
    listeners,
    update(next: Partial<DevtoolsDiagnosticsSnapshot>) {
      snapshot = { ...snapshot, ...next, version: snapshot.version + 1 };
      for (const listener of listeners) listener();
    },
  };
}

function instance(
  view: EditorView,
  controller?: DevtoolsDiagnosticsController,
): RegisteredProseMirrorInstance {
  return {
    id: "editor",
    label: "Editor",
    view,
    registeredAt: 0,
    updatedAt: 0,
    dispatchCount: 0,
    transactionLimit: 200,
    transactions: [],
    pluginTimings: [],
    ...(controller ? { diagnostics: controller } : {}),
  };
}

function source(
  pluginKey: string,
  overrides: Partial<DevtoolsDecorationSource> = {},
): DevtoolsDecorationSource {
  return {
    id: pluginKey,
    pluginKey,
    pluginLabel: pluginKey,
    observedAt: 1_700_000_000_000,
    stale: false,
    ranges: [{ from: 1, to: 3, kind: "inline", spec: { class: "highlight" } }],
    ...overrides,
  };
}

function changeSelect(container: Element, name: string, value: string): void {
  const select = container.querySelector<HTMLSelectElement>(`select[aria-label="${name}"]`)!;
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function button(container: Element, text: string): HTMLButtonElement {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((item) =>
    item.textContent?.includes(text),
  )!;
}

describe("Decorations panel", () => {
  it("explains opt-in instrumentation when diagnostics are absent", () => {
    const view = createTestView(createTestState("hello"));
    const container = document.createElement("div");
    const dispose = render(() => <DecorationsView instance={instance(view)} />, container);
    try {
      expect(container.textContent).toContain("Enable decoration diagnostics");
      expect(
        container.querySelector('[aria-label="Decoration diagnostics setup"]')?.textContent,
      ).toContain("diagnostics: true");
      expect(container.textContent).toContain("session.instrumentPlugins(plugins)");
    } finally {
      dispose();
      view.destroy();
    }
  });

  it("filters captured ranges and removes overlays when their source becomes stale", () => {
    const view = createTestView(createTestState("hello"));
    vi.spyOn(view, "coordsAtPos").mockImplementation((pos) => ({
      left: pos * 10,
      right: pos * 10,
      top: 20,
      bottom: 40,
    }));
    const first = source("comments");
    const second = source("search", { ranges: [{ from: 3, to: 3, kind: "widget", spec: {} }] });
    const data = diagnostics({ decorations: [first, second] });
    const container = document.createElement("div");
    document.body.append(container);
    const dispose = render(
      () => <DecorationsView instance={instance(view, data.controller)} />,
      container,
    );
    try {
      expect(data.listeners.size).toBe(1);
      expect(container.querySelectorAll('[aria-label="Observed decorations"] li')).toHaveLength(2);
      changeSelect(container, "Filter diagnostics by plugin", "search");
      expect(container.querySelectorAll('[aria-label="Observed decorations"] li')).toHaveLength(1);
      expect(container.querySelector('[aria-label="Observed decorations"]')?.textContent).toContain(
        "widget",
      );
      button(container, "Show positions in editor").click();
      expect(document.querySelectorAll("[data-prosemirror-decoration-overlay]")).toHaveLength(1);
      expect(button(container, "Hide positions in editor").getAttribute("aria-pressed")).toBe(
        "true",
      );

      data.update({ decorations: [first, { ...second, stale: true }] });
      expect(document.querySelector("[data-prosemirror-decoration-overlay]")).toBeNull();
      expect(button(container, "Show positions in editor").disabled).toBe(true);
      expect(container.textContent).toContain("older document");

      changeSelect(container, "Filter diagnostics by plugin", "");
      changeSelect(container, "Filter decoration type", "inline");
      expect(container.querySelectorAll('[aria-label="Observed decorations"] li')).toHaveLength(1);
      expect(container.querySelector('[aria-label="Observed decorations"]')?.textContent).toContain(
        "comments",
      );
      button(container, "Show positions in editor").click();
      expect(document.querySelector("[data-prosemirror-decoration-overlay]")).not.toBeNull();
      button(container, "Node views").click();
      expect(document.querySelector("[data-prosemirror-decoration-overlay]")).toBeNull();
    } finally {
      dispose();
      view.destroy();
    }
    expect(data.listeners.size).toBe(0);
  });

  it("stops an overlay after document replacement even before fresh diagnostics arrive", () => {
    const view = createTestView(createTestState("hello"));
    vi.spyOn(view, "coordsAtPos").mockReturnValue({ left: 10, right: 10, top: 10, bottom: 30 });
    const data = diagnostics({ decorations: [source("comments")] });
    const [current, setCurrent] = createSignal(instance(view, data.controller));
    const container = document.createElement("div");
    document.body.append(container);
    const dispose = render(() => <DecorationsView instance={current()} />, container);
    try {
      button(container, "Show positions in editor").click();
      expect(document.querySelector("[data-prosemirror-decoration-overlay]")).not.toBeNull();
      view.updateState(view.state.apply(view.state.tr.insertText("x", 1)));
      setCurrent({ ...current() });
      expect(document.querySelector("[data-prosemirror-decoration-overlay]")).toBeNull();
      expect(button(container, "Show positions in editor").getAttribute("aria-pressed")).toBe(
        "false",
      );
      expect(button(container, "Show positions in editor").disabled).toBe(true);
      data.update({ decorations: [source("comments")] });
      expect(button(container, "Show positions in editor").disabled).toBe(false);
    } finally {
      dispose();
      view.destroy();
    }
  });

  it("bounds rendered rows and reacts to NodeView lifecycle observations", () => {
    const view = createTestView(createTestState("hello"));
    const nodeView: DevtoolsNodeViewRecord = {
      id: 1,
      pluginKey: "cards",
      pluginLabel: "Cards",
      nodeType: "paragraph",
      position: 0,
      createdAt: 1,
      updatedAt: 2,
      destroyed: false,
      updates: 2,
      destroys: 0,
      totalDuration: 2,
      lastDuration: 1,
      error: null,
    };
    const data = diagnostics({
      decorations: [
        source("many", {
          ranges: Array.from({ length: 225 }, () => ({ from: 1, to: 2, kind: "inline", spec: {} })),
        }),
      ],
      nodeViews: [nodeView],
    });
    const container = document.createElement("div");
    document.body.append(container);
    const dispose = render(
      () => <DecorationsView instance={instance(view, data.controller)} />,
      container,
    );
    try {
      expect(container.querySelectorAll('[aria-label="Observed decorations"] li')).toHaveLength(
        100,
      );
      const firstRow = container.querySelector('[aria-label="Observed decorations"] li');
      data.update({ events: [] });
      expect(container.querySelector('[aria-label="Observed decorations"] li')).toBe(firstRow);
      button(container, "Show more").click();
      expect(container.querySelectorAll('[aria-label="Observed decorations"] li')).toHaveLength(
        200,
      );
      button(container, "Node views").click();
      expect(
        container.querySelector('[aria-label="Retained NodeView lifecycle counts"]')?.textContent,
      ).toContain("1 live");
      expect(
        container.querySelector('[aria-label="Selected NodeView lifecycle"]')?.textContent,
      ).toContain("Updates2");

      data.update({
        nodeViews: [{ ...nodeView, updates: 4, destroyed: true, destroys: 1, updatedAt: 3 }],
      });
      expect(
        container.querySelector('[aria-label="Retained NodeView lifecycle counts"]')?.textContent,
      ).toContain("0 live");
      expect(
        container.querySelector('[aria-label="Selected NodeView lifecycle"]')?.textContent,
      ).toContain("Updates4");
      expect(container.querySelector('[aria-label="Observed NodeViews"]')?.textContent).toContain(
        "destroyed",
      );
    } finally {
      dispose();
      view.destroy();
    }
  });
});

describe("Decoration position overlays", () => {
  it("uses the editor ownerDocument, redraws on scroll, and removes listeners on teardown", () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const target = iframe.contentDocument!;
    const host = iframe.contentWindow!;
    const mount = target.createElement("div");
    target.body.append(mount);
    const view = new EditorView(mount, { state: createTestState("hello") });
    const removeScroll = vi.spyOn(target, "removeEventListener");
    const removeResize = vi.spyOn(host, "removeEventListener");
    let callback: FrameRequestCallback | undefined;
    host.requestAnimationFrame = (next) => {
      callback = next;
      return 1;
    };
    host.cancelAnimationFrame = vi.fn();
    const coordinates = vi
      .spyOn(view, "coordsAtPos")
      .mockReturnValue({ left: 10, right: 10, top: 20, bottom: 40 });
    const cleanup = mountDecorationOverlay(view, { from: 1, to: 3, kind: "inline" });
    try {
      expect(target.querySelector("[data-prosemirror-decoration-overlay]")).not.toBeNull();
      expect(document.querySelector("[data-prosemirror-decoration-overlay]")).toBeNull();
      expect(coordinates).toHaveBeenCalledTimes(2);
      expect(target.querySelectorAll("[data-prosemirror-decoration-overlay] span")).toHaveLength(1);
      expect(target.querySelector("[data-prosemirror-decoration-overlay]")?.textContent).toBe(
        "inline 1–3",
      );
      coordinates.mockImplementation((pos) => ({
        left: 10,
        right: 10,
        top: pos === 1 ? 20 : 50,
        bottom: pos === 1 ? 40 : 70,
      }));
      target.dispatchEvent(new Event("scroll"));
      expect(callback).toBeDefined();
      callback?.(0);
      expect(coordinates).toHaveBeenCalledTimes(4);
      expect(target.querySelectorAll("[data-prosemirror-decoration-overlay] span")).toHaveLength(2);
      host.dispatchEvent(new Event("resize"));
      cleanup();
      expect(host.cancelAnimationFrame).toHaveBeenCalledWith(1);
      expect(target.querySelector("[data-prosemirror-decoration-overlay]")).toBeNull();
      expect(removeScroll).toHaveBeenCalledWith("scroll", expect.any(Function), true);
      expect(removeResize).toHaveBeenCalledWith("resize", expect.any(Function));
    } finally {
      cleanup();
      view.destroy();
    }
  });

  it("uses nodeDOM geometry and disposes invalid or changed-document ranges", () => {
    const view = createTestView(createTestState("hello"));
    const paragraph = view.dom.querySelector("p")!;
    vi.spyOn(paragraph, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 30, 100, 25));
    const coordinates = vi.spyOn(view, "coordsAtPos");
    const unavailable = vi.fn();
    const cleanup = mountDecorationOverlay(view, { from: 0, to: 7, kind: "node" }, unavailable);
    try {
      const marker = document.querySelector<HTMLElement>(
        "[data-prosemirror-decoration-overlay] > div",
      );
      expect(marker?.style.width).toBe("100px");
      expect(coordinates).not.toHaveBeenCalled();
      cleanup();
      const invalidCleanup = mountDecorationOverlay(
        view,
        { from: 1, to: 100, kind: "inline" },
        unavailable,
      );
      expect(unavailable).toHaveBeenCalledOnce();
      expect(document.querySelector("[data-prosemirror-decoration-overlay]")).toBeNull();
      invalidCleanup();
    } finally {
      cleanup();
      view.destroy();
    }
  });
});
