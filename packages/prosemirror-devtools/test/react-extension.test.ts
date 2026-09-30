import { act, createElement, StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createProseMirrorDevtoolsStore } from "../src/core";
import type { DevtoolsExtensionContext } from "../src/core/extensions";
import { createReactDevtoolsExtension } from "../src/adapters/react/extension";
import {
  ProseMirrorDevtoolsPanel,
  type ProseMirrorDevtoolsReactInit,
} from "../src/adapters/react/panel";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("React extension lifecycle", () => {
  it("safely disposes nested React roots during host updates and Strict Mode teardown", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const cleanup = vi.fn();
    const signals: AbortSignal[] = [];
    function ExtensionContent({ context }: { context: DevtoolsExtensionContext }) {
      useEffect(() => () => cleanup(context.host.signal.aborted), [context]);
      return createElement("div", { "data-extension-content": true }, context.host.theme);
    }
    const extension = createReactDevtoolsExtension({
      id: "react-lifecycle",
      panels: [
        {
          id: "react-extension",
          title: "React extension",
          requiresInstance: false,
          render(context) {
            signals.push(context.host.signal);
            return createElement(ExtensionContent, { context });
          },
        },
      ],
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const props = {
      defaultPanel: "react-extension",
      extensions: [extension],
      store: createProseMirrorDevtoolsStore(),
    };
    const renderPanel = (theme: "dark" | "light") =>
      createElement(
        StrictMode,
        null,
        createElement<ProseMirrorDevtoolsReactInit>(ProseMirrorDevtoolsPanel, { ...props, theme }),
      );

    await act(async () => root.render(renderPanel("dark")));
    expect(container.querySelector("[data-extension-content]")?.textContent).toBe("dark");
    await act(async () => root.render(renderPanel("light")));
    expect(container.querySelectorAll("[data-extension-content]")).toHaveLength(1);
    expect(container.querySelector("[data-extension-content]")?.textContent).toBe("light");
    expect(signals.slice(0, -1).every((signal) => signal.aborted)).toBe(true);

    await act(async () => root.unmount());
    expect(container.childElementCount).toBe(0);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(cleanup).toHaveBeenCalled();
    expect(cleanup.mock.calls.every(([aborted]) => aborted)).toBe(true);
    expect(errors).not.toHaveBeenCalled();
  });
});
