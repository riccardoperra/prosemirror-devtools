import { describe, expect, it } from "vitest";

import { createProseMirrorDevtoolsPlugin as createAngularPlugin } from "../src/angular/plugin";
import { createProseMirrorDevtoolsPlugin as createPreactPlugin } from "../src/preact/plugin";
import { createProseMirrorDevtoolsPlugin as createReactPlugin } from "../src/react/plugin";
import { createProseMirrorDevtoolsPlugin as createSolidPlugin } from "../src/solid/plugin";
import { createProseMirrorDevtoolsPlugin as createSveltePlugin } from "../src/svelte/plugin";
import { createProseMirrorDevtoolsPlugin as createVuePlugin } from "../src/vue/plugin";

describe("framework plugin adapters", () => {
  it("creates React, Preact, Solid, and Angular plugins with shared metadata", () => {
    const options = {
      defaultOpen: true,
      id: "custom-prosemirror",
      name: "Editor",
    };

    for (const plugin of [
      createReactPlugin(options),
      createPreactPlugin(options),
      createSolidPlugin(options),
      createAngularPlugin(options),
    ]) {
      expect(plugin).toMatchObject({
        defaultOpen: true,
        id: "custom-prosemirror",
        name: "Editor",
      });
    }
  });

  it("preserves the original plugin defaults without overriding host panel props", () => {
    for (const plugin of [createReactPlugin(), createPreactPlugin(), createSolidPlugin()]) {
      expect(plugin).toMatchObject({
        defaultOpen: false,
        id: "prosemirror-devtools",
        name: "ProseMirror",
      });
    }

    const angularPlugin = createAngularPlugin();
    expect(angularPlugin).toMatchObject({
      defaultOpen: false,
      id: "prosemirror-devtools",
      inputs: {},
      name: "ProseMirror",
    });
    expect("inputs" in angularPlugin).toBe(true);
    if ("inputs" in angularPlugin) {
      expect(angularPlugin.inputs).not.toHaveProperty("theme");
      expect(angularPlugin.inputs).not.toHaveProperty("devtoolsOpen");
    }
  });

  it("forwards panel options through Vue and Svelte plugin descriptors", () => {
    const vuePlugin = createVuePlugin({
      defaultPanel: "performance",
      name: "Vue editor",
    });
    expect(vuePlugin).toMatchObject({
      name: "Vue editor",
      props: { defaultPanel: "performance" },
    });

    const sveltePlugin = createSveltePlugin({
      defaultPanel: "history",
      name: "Svelte editor",
    });
    expect(sveltePlugin).toMatchObject({
      name: "Svelte editor",
      props: { devtoolsProps: { defaultPanel: "history" } },
    });
  });
});
