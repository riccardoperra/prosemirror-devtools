import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createReactDevtoolsExtension, ProseMirrorDevtoolsPanel } from "../src";
import { createProseMirrorDevtoolsStore, type DevtoolsExtension } from "../src/core";
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
  it("supports roving tab focus and a standalone theme control", async () => {
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
      expect(panel?.dataset.theme).toBe("light");

      tabs[0]?.focus();
      await act(async () => {
        tabs[0]?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
      });
      expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
      expect(document.activeElement).toBe(tabs[1]);

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Cycle color theme"]')?.click();
      });
      expect(panel?.dataset.theme).toBe("dark");
      expect(container.querySelector('[aria-label="Toggle density"]')).toBeNull();

      await act(async () => {
        root.render(<ProseMirrorDevtoolsPanel embedded theme="light" />);
      });
      expect(container.querySelector(".pm-header")?.getAttribute("data-embedded")).toBe("true");
      expect(container.querySelector(".pm-brand")).toBeNull();
      expect(container.querySelector('[aria-label="Cycle color theme"]')).toBeNull();
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

  it("mounts framework-neutral extensions with reactive data and deterministic cleanup", async () => {
    const store = createProseMirrorDevtoolsStore();
    const cleanup = vi.fn();
    const extension: DevtoolsExtension = {
      id: "example",
      panels: [
        {
          id: "live-state",
          title: "Live state",
          requiresInstance: false,
          mount(container, context) {
            const update = (): void => {
              const instance = context.data.activeInstance();
              container.textContent = instance
                ? `Editor ${instance.id}: ${instance.view.state.doc.textContent}`
                : "No active editor";
            };
            update();
            const unsubscribe = context.data.activeInstance.subscribe(update);
            return () => {
              unsubscribe();
              cleanup();
            };
          },
        },
      ],
    };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    const view = createTestView(createTestState());
    let unregister = (): void => {};

    try {
      await act(async () => {
        root.render(
          <ProseMirrorDevtoolsPanel
            defaultPanel="live-state"
            extensions={[extension]}
            store={store}
          />,
        );
      });
      expect(container.querySelectorAll('[role="tab"]')).toHaveLength(7);
      expect(container.querySelector(".pm-extension-panel")?.textContent).toBe("No active editor");

      await act(async () => {
        unregister = store.register({ id: "editor", view });
      });
      expect(container.querySelector(".pm-extension-panel")?.textContent).toBe("Editor editor: ");

      await act(async () => {
        const transaction = appendTextTransaction(view.state, "x");
        const measurement = store.beginTransaction("editor", transaction, view.state, false);
        const applied = view.state.applyTransaction(transaction);
        view.updateState(applied.state);
        store.finishTransaction(measurement, {
          stateAfter: applied.state,
          appliedTransactions: applied.transactions,
        });
      });
      expect(container.querySelector(".pm-extension-panel")?.textContent).toBe("Editor editor: x");

      await act(async () => {
        Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
          .find((tab) => tab.textContent === "State")
          ?.click();
      });
      expect(cleanup).toHaveBeenCalledOnce();
      expect(container.querySelector(".pm-extension-panel")).toBeNull();
    } finally {
      await act(async () => root.unmount());
      unregister();
      view.destroy();
    }
  });

  it("supports controlled extension navigation and the React adapter", async () => {
    const onActivePanelChange = vi.fn();
    const extension = createReactDevtoolsExtension({
      id: "react-example",
      panels: [
        {
          id: "react-panel",
          title: "React panel",
          requiresInstance: false,
          render: () => <div data-testid="react-extension">React extension content</div>,
        },
      ],
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    try {
      await act(async () => {
        root.render(
          <ProseMirrorDevtoolsPanel
            activePanel="react-panel"
            extensions={[extension]}
            onActivePanelChange={onActivePanelChange}
          />,
        );
      });
      expect(container.querySelector('[data-testid="react-extension"]')?.textContent).toBe(
        "React extension content",
      );

      await act(async () => {
        Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
          .find((tab) => tab.textContent === "State")
          ?.click();
      });
      expect(onActivePanelChange).toHaveBeenCalledWith("state");
      expect(container.querySelector('[data-testid="react-extension"]')).not.toBeNull();
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("keeps React extension lifecycle signals active under Strict Mode", async () => {
    const renderedSignals: AbortSignal[] = [];
    const extension = createReactDevtoolsExtension({
      id: "strict-react-example",
      panels: [
        {
          id: "strict-react-panel",
          title: "Strict React panel",
          requiresInstance: false,
          render: (context) => {
            renderedSignals.push(context.host.signal);
            return (
              <div data-testid="strict-react-extension">
                {context.host.signal.aborted ? "disposed" : "mounted"}
              </div>
            );
          },
        },
      ],
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    let activeSignal: AbortSignal | undefined;

    try {
      await act(async () => {
        root.render(
          <StrictMode>
            <ProseMirrorDevtoolsPanel defaultPanel="strict-react-panel" extensions={[extension]} />
          </StrictMode>,
        );
      });

      expect(container.querySelector('[data-testid="strict-react-extension"]')?.textContent).toBe(
        "mounted",
      );
      activeSignal = renderedSignals.at(-1);
      expect(activeSignal?.aborted).toBe(false);
    } finally {
      await act(async () => root.unmount());
    }

    expect(activeSignal?.aborted).toBe(true);
  });
});
