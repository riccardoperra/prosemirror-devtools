import { act as reactAct, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { h as preactH, render as preactRender } from "preact";
import { act as preactAct } from "preact/test-utils";
import { createComponent, createSignal } from "solid-js";
import { render as solidRender } from "solid-js/web";
import { createApp, h as vueH, nextTick, shallowRef } from "vue";
import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DevtoolsExtension } from "../src/core/extensions";
import { createProseMirrorDevtoolsStore } from "../src/core";
import {
  ProseMirrorDevtoolsPanel as ReactPanel,
  type ProseMirrorDevtoolsReactInit,
} from "../src/adapters/react/panel";
import { ProseMirrorDevtoolsPanel as PreactPanel } from "../src/adapters/preact/panel";
import { ProseMirrorDevtoolsPanel as SolidPanel } from "../src/adapters/solid/panel";
import { ProseMirrorDevtoolsPanel as VuePanel } from "../src/adapters/vue/panel";
import { ProseMirrorDevtoolsPanel as SveltePanel } from "../src/adapters/svelte/panel";

function createPanelFixture() {
  const host = document.createElement("div");
  document.body.append(host);
  const dispose = vi.fn();
  const mountPanel = vi.fn(() => dispose);
  const extensions: DevtoolsExtension[] = [
    {
      id: "adapter-test",
      panels: [
        { id: "adapter-panel", title: "Adapter test", requiresInstance: false, mount: mountPanel },
      ],
    },
  ];
  return {
    host,
    dispose,
    mountPanel,
    props: {
      defaultPanel: "adapter-panel",
      extensions,
      store: createProseMirrorDevtoolsStore(),
      theme: "dark" as const,
    },
  };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("framework panel lifecycle", () => {
  it("preserves React panel state across renders and cleans up after refs detach", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const fixture = createPanelFixture();
    const root = createRoot(fixture.host);
    await reactAct(() =>
      root.render(createElement<ProseMirrorDevtoolsReactInit>(ReactPanel, fixture.props)),
    );
    const panel = fixture.host.querySelector(".pm-devtools");

    await reactAct(() =>
      root.render(createElement<ProseMirrorDevtoolsReactInit>(ReactPanel, { ...fixture.props })),
    );
    expect(fixture.mountPanel).toHaveBeenCalledOnce();
    expect(fixture.dispose).not.toHaveBeenCalled();
    await reactAct(() =>
      root.render(
        createElement<ProseMirrorDevtoolsReactInit>(ReactPanel, {
          ...fixture.props,
          theme: "light",
        }),
      ),
    );

    expect(fixture.host.querySelector(".pm-devtools")).toBe(panel);
    expect(panel?.getAttribute("data-theme")).toBe("light");
    // Extension panels receive theme as a mount-context value; only their
    // content remounts, while the host and its navigation remain intact.
    expect(fixture.mountPanel).toHaveBeenCalledTimes(2);
    expect(fixture.dispose).toHaveBeenCalledOnce();
    await reactAct(() => root.unmount());
    expect(fixture.dispose).toHaveBeenCalledTimes(2);
  });

  it("remains usable after React Strict Mode rehearses effect cleanup", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const fixture = createPanelFixture();
    const root = createRoot(fixture.host);
    await reactAct(() =>
      root.render(
        createElement(
          StrictMode,
          null,
          createElement<ProseMirrorDevtoolsReactInit>(ReactPanel, fixture.props),
        ),
      ),
    );
    expect(fixture.host.querySelector(".pm-devtools")).not.toBeNull();
    expect(fixture.mountPanel).toHaveBeenCalledTimes(2);
    expect(fixture.dispose).toHaveBeenCalledOnce();

    await reactAct(() => root.unmount());
    expect(fixture.dispose).toHaveBeenCalledTimes(2);
  });

  it("updates Preact appearance without remounting and disposes on unmount", () => {
    const fixture = createPanelFixture();
    preactAct(() => preactRender(preactH(PreactPanel, fixture.props), fixture.host));
    const panel = fixture.host.querySelector(".pm-devtools");
    preactAct(() =>
      preactRender(preactH(PreactPanel, { ...fixture.props, theme: "light" }), fixture.host),
    );

    expect(fixture.host.querySelector(".pm-devtools")).toBe(panel);
    expect(panel?.getAttribute("data-theme")).toBe("light");
    expect(fixture.mountPanel).toHaveBeenCalledTimes(2);
    preactAct(() => preactRender(null, fixture.host));
    expect(fixture.dispose).toHaveBeenCalledTimes(2);
  });

  it("tracks Solid host getters through the shared renderer", () => {
    const fixture = createPanelFixture();
    const [theme, setTheme] = createSignal<"dark" | "light">("dark");
    const [open, setOpen] = createSignal(true);
    const dispose = solidRender(
      () =>
        createComponent(SolidPanel, {
          ...fixture.props,
          get theme() {
            return theme();
          },
          get devtoolsOpen() {
            return open();
          },
        }),
      fixture.host,
    );
    const panel = fixture.host.querySelector(".pm-devtools");
    setTheme("light");
    expect(fixture.host.querySelector(".pm-devtools")).toBe(panel);
    expect(panel?.getAttribute("data-theme")).toBe("light");
    expect(fixture.mountPanel).toHaveBeenCalledTimes(2);

    setOpen(false);
    expect(fixture.host.querySelector(".pm-devtools")).toBeNull();
    expect(fixture.dispose).toHaveBeenCalledTimes(2);
    setOpen(true);
    expect(fixture.mountPanel).toHaveBeenCalledTimes(3);
    dispose();
    expect(fixture.dispose).toHaveBeenCalledTimes(3);
  });

  it("updates Vue props without remounting and releases its Solid root on unmount", async () => {
    const fixture = createPanelFixture();
    const theme = shallowRef<"dark" | "light">("dark");
    const app = createApp({
      setup: () => () => vueH(VuePanel, { ...fixture.props, theme: theme.value }),
    });
    app.mount(fixture.host);
    await nextTick();
    const panel = fixture.host.querySelector(".pm-devtools");
    theme.value = "light";
    await nextTick();

    expect(fixture.host.querySelector(".pm-devtools")).toBe(panel);
    expect(panel?.getAttribute("data-theme")).toBe("light");
    expect(fixture.mountPanel).toHaveBeenCalledTimes(2);
    app.unmount();
    expect(fixture.dispose).toHaveBeenCalledTimes(2);
  });

  it("cleans up the imperative Svelte wrapper through Svelte 5 unmount", async () => {
    const fixture = createPanelFixture();
    const component = mount(SveltePanel, {
      target: fixture.host,
      props: { devtoolsProps: fixture.props },
    });
    flushSync();
    expect(fixture.mountPanel).toHaveBeenCalledOnce();
    await unmount(component);
    expect(fixture.dispose).toHaveBeenCalledOnce();
    expect(fixture.host.querySelector(".pm-devtools")).toBeNull();
  });
});
