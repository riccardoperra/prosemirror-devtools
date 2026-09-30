import { Plugin, PluginKey } from "prosemirror-state";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createProseMirrorDevtoolsDiagnostics,
  createProseMirrorDevtoolsSession,
  createProseMirrorDevtoolsStore,
} from "../src/core";
import type { RegisteredProseMirrorInstance } from "../src/core/types";
import { EventsView } from "../src/panel/features/events/events-view";
import { createTestState, createTestView, appendTextTransaction } from "./helpers";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function mountEvents(options: { diagnostics?: boolean; plugins?: Plugin[]; limit?: number } = {}) {
  const store = createProseMirrorDevtoolsStore();
  const session = createProseMirrorDevtoolsSession({
    id: "events-editor",
    store,
    diagnostics: options.diagnostics === false ? false : { limit: options.limit ?? 500 },
    performanceMarks: false,
    getPluginLabel: (_plugin, index) =>
      ["First keymap", "Second keymap"][index] ?? `Plugin ${index}`,
  });
  const plugins = session.instrumentPlugins(options.plugins ?? []);
  const view = createTestView(createTestState("", plugins));
  session.attach(view);
  const instance = store.getInstance("events-editor")!;
  const host = document.createElement("div");
  document.body.append(host);
  const dispose = render(() => <EventsView instance={instance} />, host);
  return {
    host,
    store,
    session,
    view,
    plugins,
    rows: () => Array.from(host.querySelectorAll<HTMLButtonElement>("[data-event-id]")),
    destroy() {
      dispose();
      session.dispose();
      view.destroy();
    },
  };
}

function changeSelect(host: HTMLElement, label: string, value: string): void {
  const select = host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Events and commands panel", () => {
  it("explains opt-in setup and explicit command naming when diagnostics are disabled", () => {
    const fixture = mountEvents({ diagnostics: false });
    try {
      expect(fixture.host.textContent).toContain("Enable event and command tracing");
      expect(fixture.host.textContent).toContain("diagnostics: true");
      expect(fixture.host.textContent).toContain("session.instrumentPlugins(plugins)");
      expect(fixture.host.textContent).toContain('traceCommand("Bold"');
    } finally {
      fixture.destroy();
    }
  });

  it("updates for ordered plugin calls without a dispatch and filters by plugin, search and result", () => {
    const fixture = mountEvents({
      plugins: [
        new Plugin({ key: new PluginKey("first"), props: { handleKeyDown: () => false } }),
        new Plugin({ key: new PluginKey("second"), props: { handleKeyDown: () => true } }),
      ],
    });
    try {
      const event = new KeyboardEvent("keydown", { code: "Escape" });
      for (const plugin of fixture.plugins)
        plugin.props.handleKeyDown?.call(plugin, fixture.view, event);
      expect(fixture.store.getInstance("events-editor")?.transactions).toHaveLength(0);
      expect(fixture.rows()).toHaveLength(2);
      expect(fixture.rows().map((row) => row.dataset.eventId)).toEqual(["1", "2"]);
      expect(fixture.rows()[0]?.textContent).toContain("unhandled");
      expect(fixture.rows()[1]?.textContent).toContain("handled");
      expect(fixture.host.textContent).toContain("uninstrumented");

      const pluginKey = fixture.session.diagnostics!.getSnapshot().events[0]!.pluginKey!;
      changeSelect(fixture.host, "Filter event source", `plugin:${pluginKey}`);
      expect(fixture.rows()).toHaveLength(1);
      expect(fixture.rows()[0]?.textContent).toContain("First keymap");
      changeSelect(fixture.host, "Filter handled status", "handled");
      expect(fixture.rows()).toHaveLength(0);
      expect(fixture.host.textContent).toContain("No calls match these filters");

      changeSelect(fixture.host, "Filter event source", "");
      expect(fixture.rows()).toHaveLength(1);
      const search = fixture.host.querySelector<HTMLInputElement>(
        '[aria-label="Search events and commands"]',
      )!;
      search.value = "second";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      expect(fixture.rows()[0]?.textContent).toContain("Second keymap");
      search.value = "absent";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      expect(fixture.rows()).toHaveLength(0);
    } finally {
      fixture.destroy();
    }
  });

  it("shows nested commands, dispatch IDs and errors and clears the independent trace", () => {
    const fixture = mountEvents();
    const diagnostics = fixture.session.diagnostics!;
    try {
      diagnostics.traceCommand("Outer command", () =>
        diagnostics.traceCommand("Insert text", () => {
          fixture.view.dispatch(appendTextTransaction(fixture.view.state, "x"));
          return true;
        }),
      );
      expect(fixture.rows().map((row) => row.dataset.eventId)).toEqual(["1", "2"]);
      const details = fixture.host.querySelector('[aria-label="Event and command details"]')!;
      expect(details.textContent).toContain("events-editor · #1");
      const parent = Array.from(details.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent?.includes("Parent #1"),
      );
      parent?.click();
      expect(details.textContent).toContain("Outer command");
      expect(details.textContent).toContain("Nested #2");

      expect(() =>
        diagnostics.traceCommand("Failed command", () => {
          throw new Error("Cannot insert here");
        }),
      ).toThrow("Cannot insert here");
      changeSelect(fixture.host, "Filter handled status", "error");
      expect(fixture.rows()).toHaveLength(1);
      expect(details.textContent).toContain("Error: Cannot insert here");

      fixture.host
        .querySelector<HTMLButtonElement>('[aria-label="Clear event and command trace"]')!
        .click();
      expect(diagnostics.getSnapshot().events).toHaveLength(0);
      expect(fixture.rows()).toHaveLength(0);
      expect(fixture.store.getInstance("events-editor")?.transactions).toHaveLength(1);
      expect(fixture.host.textContent).toContain("No calls recorded");
    } finally {
      fixture.destroy();
    }
  });

  it("bounds rendered rows with pages and preserves invocation order", () => {
    const fixture = mountEvents({ limit: 500 });
    try {
      for (let index = 0; index < 205; index += 1) {
        fixture.session.diagnostics!.traceCommand(`Command ${index}`, () => false);
      }
      expect(fixture.rows()).toHaveLength(100);
      expect(fixture.rows()[0]?.dataset.eventId).toBe("106");
      expect(fixture.rows().at(-1)?.dataset.eventId).toBe("205");
      const older = Array.from(fixture.host.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent === "Older calls",
      )!;
      older.click();
      expect(fixture.rows()).toHaveLength(100);
      expect(fixture.rows()[0]?.dataset.eventId).toBe("6");
      older.click();
      expect(fixture.rows()).toHaveLength(5);
      expect(fixture.rows()[0]?.dataset.eventId).toBe("1");
      expect(older.disabled).toBe(true);
    } finally {
      fixture.destroy();
    }
  });

  it("rebinds the independent subscription when the controller changes and releases it on teardown", () => {
    const store = createProseMirrorDevtoolsStore();
    const first = createProseMirrorDevtoolsDiagnostics();
    const second = createProseMirrorDevtoolsDiagnostics();
    const view = createTestView();
    const unregister = store.register({ id: "first", view, diagnostics: first });
    const stopFirst = vi.fn();
    const stopSecond = vi.fn();
    for (const [source, stopped] of [
      [first, stopFirst],
      [second, stopSecond],
    ] as const) {
      const subscribe = source.subscribe.bind(source);
      vi.spyOn(source, "subscribe").mockImplementation((listener) => {
        const unsubscribe = subscribe(listener);
        return () => {
          stopped();
          unsubscribe();
        };
      });
    }
    const [instance, setInstance] = createSignal<RegisteredProseMirrorInstance>(
      store.getInstance("first")!,
    );
    const host = document.createElement("div");
    const dispose = render(() => <EventsView instance={instance()} />, host);
    try {
      first.traceCommand("First controller", () => true);
      expect(host.textContent).toContain("First controller");
      setInstance({ ...instance(), id: "second", diagnostics: second });
      expect(stopFirst).toHaveBeenCalledOnce();
      second.traceCommand("Second controller", () => false);
      expect(host.textContent).toContain("Second controller");
      first.traceCommand("Detached controller", () => false);
      expect(host.textContent).not.toContain("Detached controller");
    } finally {
      dispose();
      expect(stopSecond).toHaveBeenCalledOnce();
      unregister();
      first.dispose();
      second.dispose();
      view.destroy();
    }
  });
});
