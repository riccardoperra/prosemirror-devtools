import { describe, expect, it } from "vitest";

import {
  resolveProseMirrorDevtoolsAdapterPanelProps,
  resolveProseMirrorDevtoolsPanelInit,
  resolveProseMirrorDevtoolsPanelProps,
  resolveProseMirrorDevtoolsPluginMetadata,
} from "../src/adapters/panel-props";
import { ProseMirrorDevtoolsCore } from "../src/adapters/core";
import { resolveProseMirrorDevtoolsSolidProps } from "../src/adapters/solid/panel";

describe("adapter panel props", () => {
  it("mounts and disposes the shared Solid panel core", () => {
    const element = document.createElement("div");
    const core = new ProseMirrorDevtoolsCore({ defaultPanel: "state", theme: "light" });

    core.mount(element);
    expect(element.querySelector(".pm-devtools")?.getAttribute("data-theme")).toBe("light");
    expect(() => core.mount(element)).toThrow("already mounted");

    core.unmount();
    expect(element.childElementCount).toBe(0);

    core.mount(element, { theme: "dark" });
    expect(element.querySelector(".pm-devtools")?.getAttribute("data-theme")).toBe("dark");
    core.unmount();
  });

  it("assigns only defined options and lets host props win", () => {
    const onActivePanelChange = () => {};
    const resolved = resolveProseMirrorDevtoolsAdapterPanelProps(
      {
        activePanel: "state",
        devtoolsOpen: true,
        onActivePanelChange,
        performanceDetailThresholdMs: 0,
        theme: "dark",
      },
      {
        activePanel: undefined,
        devtoolsOpen: false,
        theme: "light",
      } as never,
    );

    expect(resolved).toEqual({
      activePanel: "state",
      devtoolsOpen: false,
      onActivePanelChange,
      performanceDetailThresholdMs: 0,
      theme: "light",
    });
  });

  it("keeps selected navigation when the host updates props and releases controlled panels", () => {
    const element = document.createElement("div");
    document.body.append(element);
    const core = new ProseMirrorDevtoolsCore();
    core.mount(element, { defaultPanel: "state" });
    const tabs = Array.from(element.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const schemaTab = tabs.find((tab) => tab.textContent?.includes("Schema"));
    expect(schemaTab).toBeDefined();
    schemaTab!.click();

    core.update({ theme: "light" });
    expect(schemaTab?.getAttribute("aria-selected")).toBe("true");
    core.update({ activePanel: "history" });
    expect(schemaTab?.getAttribute("aria-selected")).toBe("false");
    core.update({});
    expect(schemaTab?.getAttribute("aria-selected")).toBe("true");

    core.unmount();
    element.remove();
    expect(() => core.update({})).toThrow("not mounted");
  });

  it("targets the mount element document and hides a closed panel", () => {
    const foreignDocument = document.implementation.createHTMLDocument("foreign");
    const element = foreignDocument.createElement("div");

    expect(
      resolveProseMirrorDevtoolsPanelProps(element, {
        defaultPanel: "performance",
        theme: "light",
      }),
    ).toEqual({
      defaultPanel: "performance",
      embedded: true,
      styleTarget: foreignDocument,
      theme: "light",
    });
    expect(resolveProseMirrorDevtoolsPanelProps(element, { devtoolsOpen: false })).toBeNull();
  });

  it("separates panel inputs from stable plugin metadata", () => {
    const panelInit = resolveProseMirrorDevtoolsPanelInit({
      activePanel: undefined,
      defaultPanel: "history",
      performanceFrameBudgetMs: 0,
    } as never);

    expect(panelInit).toEqual({
      defaultPanel: "history",
      performanceFrameBudgetMs: 0,
    });
    expect(resolveProseMirrorDevtoolsPluginMetadata({})).toEqual({
      defaultOpen: false,
      id: "prosemirror-devtools",
      name: "ProseMirror",
    });
  });

  it("keeps Solid host props getter-backed", () => {
    let theme: "dark" | "light" = "dark";
    let devtoolsOpen = true;
    const hostProps = {
      get devtoolsOpen() {
        return devtoolsOpen;
      },
      get theme() {
        return theme;
      },
    };
    const props = resolveProseMirrorDevtoolsSolidProps({ defaultPanel: "state" }, hostProps);

    expect(props.theme).toBe("dark");
    expect(props.devtoolsOpen).toBe(true);
    theme = "light";
    devtoolsOpen = false;
    expect(props.theme).toBe("light");
    expect(props.devtoolsOpen).toBe(false);
  });
});
