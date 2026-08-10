import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

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
});

describe("devtools panel shell", () => {
  it("supports roving tab focus and local appearance controls", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    try {
      await act(async () => {
        root.render(<ProseMirrorDevtoolsPanel theme="light" />);
      });

      const panel = container.querySelector<HTMLElement>(".pm-devtools");
      const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
      expect(tabs).toHaveLength(6);
      expect(panel?.dataset.density).toBe("compact");
      expect(panel?.dataset.theme).toBe("light");

      tabs[0]?.focus();
      await act(async () => {
        tabs[0]?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
      });
      expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
      expect(document.activeElement).toBe(tabs[1]);

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Toggle density"]')?.click();
        container.querySelector<HTMLButtonElement>('[aria-label="Cycle color theme"]')?.click();
      });
      expect(panel?.dataset.density).toBe("comfortable");
      expect(panel?.dataset.theme).toBe("dark");
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("renders the history-specific inspector composition and clears its records", async () => {
    const store = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState());
    const unregister = store.register({ id: "editor", view });
    const transaction = appendTextTransaction(view.state, "x");
    const measurement = store.beginTransaction("editor", transaction, view.state, false);
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
        root.render(<ProseMirrorDevtoolsPanel defaultTab="history" store={store} theme="light" />);
      });

      const inspector = container.querySelector<HTMLElement>(".pm-dispatch-inspector");
      expect(inspector?.classList.contains("pm-scroll")).toBe(true);
      expect(inspector?.querySelector('[aria-label="Plugin cost"]')).toBeNull();
      expect(inspector?.querySelector('[aria-label="Transaction details"]')).not.toBeNull();

      await act(async () => {
        container.querySelector<HTMLButtonElement>(".pm-history-list .pm-button")?.click();
      });
      expect(container.querySelector(".pm-body")?.textContent).toContain(
        "Dispatch a transaction to begin recording history.",
      );
    } finally {
      await act(async () => root.unmount());
      unregister();
      view.destroy();
    }
  });
});
