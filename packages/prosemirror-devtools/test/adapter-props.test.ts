import { describe, expect, it } from "vitest";

import {
  resolveProseMirrorDevtoolsAdapterPanelProps,
  resolveProseMirrorDevtoolsPanelInit,
  resolveProseMirrorDevtoolsPanelProps,
  resolveProseMirrorDevtoolsPluginMetadata,
} from "../src/adapters/panel-props";
import { resolveProseMirrorDevtoolsSolidProps } from "../src/solid/panel";

describe("adapter panel props", () => {
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
