import { render } from "solid-js/web";
import { describe, expect, it } from "vitest";

import {
  createProseMirrorDevtoolsStore,
  ProseMirrorDevtoolsPanel,
  proseMirrorDevtoolsCssVariables,
} from "../src";

describe("panel styling", () => {
  it("exposes stable, unique public CSS custom properties", () => {
    const variables = Object.values(proseMirrorDevtoolsCssVariables);

    expect(new Set(variables).size).toBe(variables.length);
    expect(variables.every((name) => name.startsWith("--prosemirror-devtools-"))).toBe(true);
  });

  it("accepts typed custom-property overrides on the panel root", () => {
    const container = document.createElement("div");
    const dispose = render(
      () => (
        <ProseMirrorDevtoolsPanel
          store={createProseMirrorDevtoolsStore()}
          style={{
            [proseMirrorDevtoolsCssVariables.accent]: "#9b8cff",
            [proseMirrorDevtoolsCssVariables.radius]: "10px",
          }}
        />
      ),
      container,
    );

    try {
      const panel = container.querySelector<HTMLElement>("[data-density][data-theme]");
      expect(panel?.style.getPropertyValue(proseMirrorDevtoolsCssVariables.accent)).toBe("#9b8cff");
      expect(panel?.style.getPropertyValue(proseMirrorDevtoolsCssVariables.radius)).toBe("10px");
    } finally {
      dispose();
    }
  });
});
