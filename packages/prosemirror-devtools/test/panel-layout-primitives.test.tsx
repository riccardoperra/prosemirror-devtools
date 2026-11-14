import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmptyState, NoInstancesState } from "../src/panel/ui/empty-state";
import {
  defaultPrimaryWidth,
  DIVIDER_SIZE,
  MIN_DETAIL,
  MIN_PRIMARY,
  ResizableSplit,
} from "../src/panel/ui/resizable-split";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function mount(component: () => import("solid-js").JSX.Element) {
  const container = document.createElement("div");
  document.body.append(container);
  const dispose = render(component, container);
  return { container, dispose };
}

describe("EmptyState", () => {
  it("renders one centered message with optional detail and action", () => {
    const { container, dispose } = mount(() => (
      <EmptyState
        action={
          <button class="pm-button" type="button">
            Save current
          </button>
        }
        detail="Save the document to compare it later."
      >
        No checkpoints yet.
      </EmptyState>
    ));
    try {
      const root = container.querySelector(".pm-empty-state");
      expect(root).not.toBeNull();
      expect(root?.getAttribute("role")).toBeNull();
      expect(root?.querySelector(".pm-empty-state-text")?.textContent).toBe("No checkpoints yet.");
      expect(root?.querySelector(".pm-empty-state-detail")?.textContent).toBe(
        "Save the document to compare it later.",
      );
      expect(root?.querySelector(".pm-empty-state-action button")?.textContent).toBe(
        "Save current",
      );
    } finally {
      dispose();
    }
  });

  it("omits the detail and action and announces loading states", () => {
    const { container, dispose } = mount(() => (
      <EmptyState role="status">Loading performance tools…</EmptyState>
    ));
    try {
      const root = container.querySelector(".pm-empty-state");
      expect(root?.getAttribute("role")).toBe("status");
      expect(root?.textContent).toBe("Loading performance tools…");
      expect(root?.querySelector(".pm-empty-state-detail")).toBeNull();
      expect(root?.querySelector(".pm-empty-state-action")).toBeNull();
    } finally {
      dispose();
    }
  });

  it("builds the no-instances screen on the shared component", () => {
    const { container, dispose } = mount(() => <NoInstancesState />);
    try {
      const root = container.querySelector(".pm-empty-state");
      expect(root?.querySelector(".pm-empty-mark")?.getAttribute("aria-hidden")).toBe("true");
      expect(root?.querySelector(".pm-empty-state-text")?.textContent).toBe(
        "No ProseMirror instances are registered.",
      );
      expect(root?.querySelector(".pm-empty-state-detail")?.textContent).toBe(
        "Call attachProseMirrorDevtools({ view, id }).",
      );
    } finally {
      dispose();
    }
  });
});

describe("ResizableSplit", () => {
  it("defaults the list to 40% of the container, clamped by both pane minimums", () => {
    expect(defaultPrimaryWidth(1000)).toBe(400);
    expect(defaultPrimaryWidth(1280)).toBe(512);
    // Too narrow for 40%: the list keeps its minimum.
    expect(defaultPrimaryWidth(300)).toBe(MIN_PRIMARY);
    expect(defaultPrimaryWidth(450)).toBe(MIN_PRIMARY);
    // The detail pane always keeps its minimum once the container is wide enough for both.
    for (const width of [430, 500, 640, 800]) {
      expect(width - defaultPrimaryWidth(width) - DIVIDER_SIZE).toBeGreaterThanOrEqual(MIN_DETAIL);
    }
  });

  it("follows the container proportionally until the user resizes it", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
    const { container, dispose } = mount(() => (
      <ResizableSplit label="Test list width">
        <div>List</div>
        <div>Detail</div>
      </ResizableSplit>
    ));
    try {
      const split = container.querySelector<HTMLElement>(".pm-split")!;
      const divider = container.querySelector<HTMLElement>('[role="separator"]')!;
      expect(split.style.getPropertyValue("--pm-split-width")).toBe("40%");
      expect(divider.getAttribute("aria-valuenow")).toBe("400");

      divider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      expect(split.style.getPropertyValue("--pm-split-width")).toBe("424px");
      expect(divider.getAttribute("aria-valuenow")).toBe("424");

      divider.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
      expect(split.style.getPropertyValue("--pm-split-width")).toBe(`${MIN_PRIMARY}px`);
    } finally {
      dispose();
    }
  });
});
