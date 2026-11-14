import { describe, expect, it } from "vitest";

import type { DevtoolsExtension } from "../src/core";
import {
  BUILTIN_PANEL_GROUPS,
  BUILTIN_PANELS,
  resolvePanelRegistry,
} from "../src/panel/panel-registry";

function extensionPanel(id: string, title: string, order?: number): DevtoolsExtension {
  return {
    id: `${id}-extension`,
    panels: [{ id, title, ...(order === undefined ? {} : { order }), mount() {} }],
  };
}

describe("panel registry", () => {
  it("places every built-in panel in exactly one group", () => {
    const grouped = BUILTIN_PANEL_GROUPS.flatMap(({ panels }) => panels);
    expect([...grouped].sort()).toEqual(BUILTIN_PANELS.map(({ id }) => id).sort());
  });

  it("resolves the built-in sections with their views in reading order", () => {
    expect(
      resolvePanelRegistry([]).map(({ title, panels }) => [title, panels.map(({ id }) => id)]),
    ).toEqual([
      ["Document", ["state", "selection", "schema"]],
      ["Timeline", ["history", "events"]],
      ["Snapshots", ["snapshots"]],
      ["Performance", ["performance"]],
      ["Plugins", ["plugins", "decorations"]],
      ["Context", ["inspection-context"]],
    ]);
  });

  it("gives each extension panel its own section ordered by its order", () => {
    const groups = resolvePanelRegistry([
      extensionPanel("integration", "Integration"),
      extensionPanel("webmcp", "WebMCP", 90),
      extensionPanel("overview", "Overview", -1),
    ]);

    expect(groups.map(({ title }) => title)).toEqual([
      "Overview",
      "Document",
      "Timeline",
      "Snapshots",
      "Performance",
      "Plugins",
      "WebMCP",
      "Integration",
      "Context",
    ]);
    expect(groups[0]?.panels.map(({ id }) => id)).toEqual(["overview"]);
  });

  it("keeps extension panel ids that match a section name selectable", () => {
    const groups = resolvePanelRegistry([extensionPanel("document", "Document notes", 200)]);
    const ids = groups.map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(groups.at(-1)?.panels.map(({ id }) => id)).toEqual(["document"]);
  });

  it("rejects an extension panel that reuses a built-in panel id", () => {
    expect(() => resolvePanelRegistry([extensionPanel("schema", "Schema")])).toThrow(
      'Duplicate devtools panel id "schema".',
    );
  });
});
