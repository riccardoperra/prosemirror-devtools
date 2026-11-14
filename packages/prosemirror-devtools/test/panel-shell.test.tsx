import { act, createElement } from "react";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProseMirrorDevtoolsPanel } from "../src";
import { createProseMirrorDevtoolsStore, type DevtoolsExtension } from "../src/core";
import { createReactDevtoolsExtension } from "../src/adapters/react/extension";
import { BUILTIN_PANEL_GROUPS } from "../src/panel/panel-registry";
import { activeViewTab, appendTextTransaction, createTestState, createTestView } from "./helpers";

const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const originalActEnvironment = reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT;

function tabsIn(root: ParentNode, listName: string): HTMLButtonElement[] {
  const list = root.querySelector(`[role="tablist"][aria-label="${listName}"]`);
  return Array.from(list?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
}

function sectionTab(root: ParentNode, title: string): HTMLButtonElement {
  const tab = tabsIn(root, "Inspector sections").find((button) =>
    button.textContent?.startsWith(title),
  );
  if (!tab) throw new Error(`No "${title}" section tab.`);
  return tab;
}

function viewTitles(root: ParentNode, sectionTitle: string): string[] {
  return tabsIn(root, `${sectionTitle} views`).map(({ textContent }) => textContent ?? "");
}

afterEach(() => {
  if (originalActEnvironment === undefined) {
    delete reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT;
  } else {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  }
  document.body.replaceChildren();
});

describe("devtools panel shell", () => {
  it("reacts to direct Solid panel prop updates", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const [className, setClassName] = createSignal("first-class");
    const [color, setColor] = createSignal("red");
    const dispose = render(
      () => <ProseMirrorDevtoolsPanel className={className()} style={{ color: color() }} />,
      container,
    );

    try {
      const panel = container.querySelector<HTMLElement>(".pm-devtools");
      expect(panel?.classList.contains("first-class")).toBe(true);
      expect(panel?.style.color).toBe("red");

      setClassName("second-class");
      setColor("blue");
      expect(panel?.classList.contains("first-class")).toBe(false);
      expect(panel?.classList.contains("second-class")).toBe(true);
      expect(panel?.style.color).toBe("blue");
    } finally {
      dispose();
    }
  });

  it("supports roving tab focus and a standalone theme control", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const [embedded, setEmbedded] = createSignal(false);
    const dispose = render(
      () => <ProseMirrorDevtoolsPanel embedded={embedded()} theme="light" />,
      container,
    );

    try {
      const panel = container.querySelector<HTMLElement>(".pm-devtools");
      const tabs = tabsIn(container, "Inspector sections");
      expect(tabs).toHaveLength(BUILTIN_PANEL_GROUPS.length);
      expect(panel?.dataset.theme).toBe("light");

      tabs[0]?.focus();
      tabs[0]?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
      expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
      expect(document.activeElement).toBe(tabs[1]);

      container.querySelector<HTMLButtonElement>('[aria-label="Cycle color theme"]')?.click();
      expect(panel?.dataset.theme).toBe("dark");
      expect(container.querySelector('[aria-label="Toggle density"]')).toBeNull();

      setEmbedded(true);
      expect(panel?.getAttribute("data-embedded")).toBe("true");
      expect(container.querySelector(".pm-header")?.getAttribute("data-embedded")).toBe("true");
      expect(container.querySelector(".pm-brand")).toBeNull();
      expect(container.querySelector('[aria-label="Cycle color theme"]')).toBeNull();
    } finally {
      dispose();
    }
  });

  it("supports boundary keys, wrapping and right-to-left tab navigation", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const dispose = render(() => <ProseMirrorDevtoolsPanel />, container);

    try {
      const tabs = tabsIn(container, "Inspector sections");
      const first = tabs[0]!;
      const last = tabs.at(-1)!;
      const press = (key: string, options: KeyboardEventInit = {}): KeyboardEvent => {
        const event = new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key,
          ...options,
        });
        document.activeElement?.dispatchEvent(event);
        return event;
      };

      first.focus();
      expect(press("End").defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(last);
      press("ArrowRight");
      expect(document.activeElement).toBe(first);
      press("ArrowLeft");
      expect(document.activeElement).toBe(last);
      press("Home");
      expect(document.activeElement).toBe(first);
      expect(press("ArrowRight", { ctrlKey: true }).defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(first);

      first.style.direction = "rtl";
      press("ArrowRight");
      expect(document.activeElement).toBe(last);
      expect(tabs.filter((tab) => tab.tabIndex === 0)).toEqual([last]);
    } finally {
      dispose();
    }
  });

  it("keeps keyboard navigation aligned when extensions change tab positions", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const [extensions, setExtensions] = createSignal<readonly DevtoolsExtension[]>([]);
    const dispose = render(() => <ProseMirrorDevtoolsPanel extensions={extensions()} />, container);

    try {
      const state = sectionTab(container, "Document");
      setExtensions([
        {
          id: "leading-extension",
          panels: [{ id: "overview", title: "Overview", order: -1, mount() {} }],
        },
      ]);
      const tabs = tabsIn(container, "Inspector sections");
      expect(tabs[1]).toBe(state);
      state.focus();
      state.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
      expect(document.activeElement).toBe(tabs[2]);
      expect(tabs[2]?.getAttribute("aria-selected")).toBe("true");

      setExtensions([]);
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Home" }),
      );
      expect(document.activeElement).toBe(state);
    } finally {
      dispose();
    }
  });

  it("reveals a controlled active tab within its strip without stealing focus", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const [activePanel, setActivePanel] = createSignal("state");
    const dispose = render(
      () => <ProseMirrorDevtoolsPanel activePanel={activePanel()} />,
      container,
    );

    try {
      const tabList = container.querySelector<HTMLElement>('[aria-label="Inspector sections"]')!;
      const tabs = tabsIn(container, "Inspector sections");
      const last = tabs.at(-1)!;
      tabList.getBoundingClientRect = () => new DOMRect(0, 0, 200, 35);
      last.getBoundingClientRect = () => new DOMRect(240, 0, 80, 35);
      tabs[0]!.focus();

      setActivePanel("inspection-context");
      expect(tabList.scrollLeft).toBe(120);
      expect(document.activeElement).toBe(tabs[0]);
      expect(last.getAttribute("aria-selected")).toBe("true");
    } finally {
      dispose();
    }
  });
  it("renders the history-specific inspector composition and clears its records", () => {
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
    const dispose = render(
      () => <ProseMirrorDevtoolsPanel defaultTab="history" store={store} theme="light" />,
      container,
    );

    try {
      const inspector = container.querySelector<HTMLElement>(".pm-dispatch-inspector");
      expect(inspector?.classList.contains("pm-scroll")).toBe(true);
      expect(inspector?.querySelector('[aria-label="Plugin cost"]')).toBeNull();
      expect(inspector?.querySelector('[aria-label="Transaction details"]')).not.toBeNull();
      expect(
        container.querySelector('.pm-history-list button[aria-pressed="true"]'),
      ).not.toBeNull();
      const related = inspector?.querySelector<HTMLDetailsElement>(".pm-dispatch-related");
      expect(related?.open).toBe(false);
      related?.querySelector("summary")?.click();
      expect(related?.open).toBe(true);
      const documentLink = Array.from(related?.querySelectorAll("button") ?? []).find(
        (button) => button.textContent === "Document after dispatch",
      );
      documentLink?.click();
      expect(activeViewTab(container)?.textContent).toBe("State");
      sectionTab(container, "Timeline").click();
      expect(activeViewTab(container)?.textContent).toBe("Transactions");

      container.querySelector<HTMLButtonElement>(".pm-history-list .pm-button")?.click();
      expect(container.querySelector(".pm-body")?.textContent).toContain(
        "Dispatch a transaction to begin recording history.",
      );
    } finally {
      dispose();
      unregister();
      view.destroy();
    }
  });

  it("mounts framework-neutral extensions with reactive data and deterministic cleanup", () => {
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
    const dispose = render(
      () => (
        <ProseMirrorDevtoolsPanel
          defaultPanel="live-state"
          extensions={[extension]}
          store={store}
        />
      ),
      container,
    );
    const view = createTestView(createTestState());
    let unregister = (): void => {};

    try {
      expect(tabsIn(container, "Inspector sections")).toHaveLength(BUILTIN_PANEL_GROUPS.length + 1);
      expect(container.querySelector(".pm-extension-panel")?.textContent).toBe("No active editor");

      unregister = store.register({ id: "editor", view });
      expect(container.querySelector(".pm-extension-panel")?.textContent).toBe("Editor editor: ");

      const transaction = appendTextTransaction(view.state, "x");
      const measurement = store.beginTransaction("editor", transaction, view.state, false);
      const applied = view.state.applyTransaction(transaction);
      view.updateState(applied.state);
      store.finishTransaction(measurement, {
        stateAfter: applied.state,
        appliedTransactions: applied.transactions,
      });
      expect(container.querySelector(".pm-extension-panel")?.textContent).toBe("Editor editor: x");

      sectionTab(container, "Document").click();
      expect(cleanup).toHaveBeenCalledOnce();
      expect(container.querySelector(".pm-extension-panel")).toBeNull();
    } finally {
      dispose();
      unregister();
      view.destroy();
    }
  });

  it("supports controlled extension navigation and the React adapter", async () => {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    const onActivePanelChange = vi.fn();
    const extension = createReactDevtoolsExtension({
      id: "react-example",
      panels: [
        {
          id: "react-panel",
          title: "React panel",
          requiresInstance: false,
          render: () =>
            createElement("div", { "data-testid": "react-extension" }, "React extension content"),
        },
      ],
    });
    const container = document.createElement("div");
    document.body.append(container);
    let dispose = (): void => {};

    try {
      await act(async () => {
        dispose = render(
          () => (
            <ProseMirrorDevtoolsPanel
              activePanel="react-panel"
              extensions={[extension]}
              onActivePanelChange={onActivePanelChange}
            />
          ),
          container,
        );
      });
      expect(container.querySelector('[data-testid="react-extension"]')?.textContent).toBe(
        "React extension content",
      );

      sectionTab(container, "Document").click();
      expect(onActivePanelChange).toHaveBeenLastCalledWith("state");
      expect(container.querySelector('[data-testid="react-extension"]')).not.toBeNull();
    } finally {
      await act(async () => dispose());
    }
  });

  it("aborts React extension lifecycle signals before unmounting", async () => {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    const renderedSignals: AbortSignal[] = [];
    const extension = createReactDevtoolsExtension({
      id: "react-lifecycle-example",
      panels: [
        {
          id: "react-lifecycle-panel",
          title: "React lifecycle panel",
          requiresInstance: false,
          render: (context) => {
            renderedSignals.push(context.host.signal);
            return createElement(
              "div",
              { "data-testid": "react-lifecycle-extension" },
              context.host.signal.aborted ? "disposed" : "mounted",
            );
          },
        },
      ],
    });
    const container = document.createElement("div");
    document.body.append(container);
    let dispose = (): void => {};
    let activeSignal: AbortSignal | undefined;

    try {
      await act(async () => {
        dispose = render(
          () => (
            <ProseMirrorDevtoolsPanel
              defaultPanel="react-lifecycle-panel"
              extensions={[extension]}
            />
          ),
          container,
        );
      });

      expect(
        container.querySelector('[data-testid="react-lifecycle-extension"]')?.textContent,
      ).toBe("mounted");
      activeSignal = renderedSignals.at(-1);
      expect(activeSignal?.aborted).toBe(false);
    } finally {
      await act(async () => dispose());
    }

    expect(activeSignal?.aborted).toBe(true);
  });

  it("groups the views into sections and appends each extension panel as its own section", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const extensions: readonly DevtoolsExtension[] = [
      {
        id: "integration",
        panels: [{ id: "integration", title: "Integration", requiresInstance: false, mount() {} }],
      },
      {
        id: "webmcp",
        panels: [{ id: "webmcp", title: "WebMCP", order: 90, mount() {} }],
      },
    ];
    const dispose = render(() => <ProseMirrorDevtoolsPanel extensions={extensions} />, container);

    try {
      expect(tabsIn(container, "Inspector sections").map(({ textContent }) => textContent)).toEqual(
        [
          "Document",
          "Timeline0",
          "Snapshots",
          "Performance0",
          "Plugins",
          "WebMCP",
          "Integration",
          "Context",
        ],
      );
      expect(viewTitles(container, "Document")).toEqual(["State", "Selection", "Schema"]);

      sectionTab(container, "Timeline").click();
      expect(viewTitles(container, "Timeline")).toEqual(["Transactions", "Events"]);
      expect(activeViewTab(container)?.textContent).toBe("Transactions");
      expect(tabsIn(container, "Document views")).toEqual([]);

      for (const title of ["Snapshots", "Performance"]) {
        sectionTab(container, title).click();
        expect(container.querySelectorAll('[role="tablist"]')).toHaveLength(1);
        expect(activeViewTab(container)).toBe(sectionTab(container, title));
      }

      sectionTab(container, "Integration").click();
      expect(container.querySelectorAll('[role="tablist"]')).toHaveLength(1);
      expect(activeViewTab(container)?.textContent).toBe("Integration");
    } finally {
      dispose();
    }
  });

  it("returns to the view last used in a section", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const onActivePanelChange = vi.fn();
    const dispose = render(
      () => <ProseMirrorDevtoolsPanel onActivePanelChange={onActivePanelChange} />,
      container,
    );

    try {
      sectionTab(container, "Timeline").click();
      tabsIn(container, "Timeline views")
        .find(({ textContent }) => textContent === "Events")!
        .click();
      sectionTab(container, "Plugins").click();
      expect(activeViewTab(container)?.textContent).toBe("Plugins");

      sectionTab(container, "Timeline").click();
      expect(activeViewTab(container)?.textContent).toBe("Events");
      expect(onActivePanelChange.mock.calls.map(([id]) => id)).toEqual([
        "history",
        "events",
        "plugins",
        "events",
      ]);
    } finally {
      dispose();
    }
  });

  it("opens the section of the default view and moves between views with the keyboard", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const onActivePanelChange = vi.fn();
    const dispose = render(
      () => (
        <ProseMirrorDevtoolsPanel defaultPanel="schema" onActivePanelChange={onActivePanelChange} />
      ),
      container,
    );

    try {
      expect(sectionTab(container, "Document").getAttribute("aria-selected")).toBe("true");
      expect(activeViewTab(container)?.textContent).toBe("Schema");

      const views = tabsIn(container, "Document views");
      views[2]!.focus();
      views[2]!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Home" }));
      expect(document.activeElement).toBe(views[0]);
      expect(activeViewTab(container)?.textContent).toBe("State");
      views[0]!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" }));
      expect(document.activeElement).toBe(views[2]);
      expect(onActivePanelChange.mock.calls.map(([id]) => id)).toEqual(["state", "schema"]);
      expect(sectionTab(container, "Document").getAttribute("aria-selected")).toBe("true");
    } finally {
      dispose();
    }
  });
});
