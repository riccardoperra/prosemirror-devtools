import type { DevtoolsExtension, DevtoolsPanelExtension } from "../core/extensions";
import type { ProseMirrorDevtoolsTab } from "./panel.types";

export type BuiltinPanelDefinition = Readonly<{
  id: ProseMirrorDevtoolsTab;
  title: string;
  requiresInstance: true;
  badge: "transactions" | null;
  kind: "builtin";
}>;

export type ExternalPanelDefinition = Readonly<{
  id: string;
  title: string;
  requiresInstance: boolean;
  badge: null;
  kind: "extension";
  extensionId: string;
  panel: DevtoolsPanelExtension;
}>;

export type ResolvedPanelDefinition = BuiltinPanelDefinition | ExternalPanelDefinition;

export const BUILTIN_PANELS: readonly BuiltinPanelDefinition[] = [
  {
    id: "state",
    title: "State",
    requiresInstance: true,
    badge: null,
    kind: "builtin",
  },
  {
    id: "selection",
    title: "Selection",
    requiresInstance: true,
    badge: null,
    kind: "builtin",
  },
  {
    id: "history",
    title: "Transactions",
    requiresInstance: true,
    badge: "transactions",
    kind: "builtin",
  },
  {
    id: "events",
    title: "Events",
    requiresInstance: true,
    badge: null,
    kind: "builtin",
  },
  {
    id: "decorations",
    title: "Rendering",
    requiresInstance: true,
    badge: null,
    kind: "builtin",
  },
  {
    id: "performance",
    title: "Performance",
    requiresInstance: true,
    badge: "transactions",
    kind: "builtin",
  },
  {
    id: "plugins",
    title: "Plugins",
    requiresInstance: true,
    badge: null,
    kind: "builtin",
  },
  {
    id: "schema",
    title: "Schema",
    requiresInstance: true,
    badge: null,
    kind: "builtin",
  },
  {
    id: "snapshots",
    title: "Snapshots",
    requiresInstance: true,
    badge: null,
    kind: "builtin",
  },
  {
    id: "inspection-context",
    title: "Context",
    requiresInstance: true,
    badge: null,
    kind: "builtin",
  },
];

export type BuiltinPanelGroupDefinition = Readonly<{
  id: "document" | "timeline" | "snapshots" | "performance" | "plugins" | "context";
  title: string;
  order: number;
  panels: readonly [ProseMirrorDevtoolsTab, ...ProseMirrorDevtoolsTab[]];
}>;

export const BUILTIN_PANEL_GROUPS: readonly BuiltinPanelGroupDefinition[] = [
  { id: "document", title: "Document", order: 0, panels: ["state", "selection", "schema"] },
  { id: "timeline", title: "Timeline", order: 10, panels: ["history", "events"] },
  { id: "snapshots", title: "Snapshots", order: 15, panels: ["snapshots"] },
  { id: "performance", title: "Performance", order: 20, panels: ["performance"] },
  { id: "plugins", title: "Plugins", order: 30, panels: ["plugins", "decorations"] },
  { id: "context", title: "Context", order: 110, panels: ["inspection-context"] },
];

export type ResolvedPanelGroup = Readonly<{
  id: string;
  title: string;
  order: number;
  panels: readonly [ResolvedPanelDefinition, ...ResolvedPanelDefinition[]];
}>;

function builtinPanel(id: ProseMirrorDevtoolsTab): BuiltinPanelDefinition {
  const panel = BUILTIN_PANELS.find((candidate) => candidate.id === id);
  if (!panel) throw new Error(`Unknown built-in panel "${id}".`);
  return panel;
}

function builtinGroup({
  id,
  title,
  order,
  panels,
}: BuiltinPanelGroupDefinition): ResolvedPanelGroup {
  const [first, ...rest] = panels;
  return { id, title, order, panels: [builtinPanel(first), ...rest.map(builtinPanel)] };
}

const RESOLVED_BUILTIN_GROUPS = BUILTIN_PANEL_GROUPS.map(builtinGroup);

export function resolvePanelRegistry(
  extensions: readonly DevtoolsExtension[],
): readonly ResolvedPanelGroup[] {
  const seenExtensionIds = new Set<string>();
  const seenPanelIds = new Set<string>(BUILTIN_PANELS.map(({ id }) => id));
  const groups: ResolvedPanelGroup[] = [...RESOLVED_BUILTIN_GROUPS];

  for (const extension of extensions) {
    if (!extension.id.trim()) throw new Error("A devtools extension id cannot be empty.");
    if (seenExtensionIds.has(extension.id)) {
      throw new Error(`Duplicate devtools extension id "${extension.id}".`);
    }
    seenExtensionIds.add(extension.id);
    for (const panel of extension.panels) {
      if (!panel.id.trim()) throw new Error(`Extension "${extension.id}" has an empty panel id.`);
      if (!panel.title.trim()) {
        throw new Error(`Extension "${extension.id}" has an empty panel title.`);
      }
      if (seenPanelIds.has(panel.id)) {
        throw new Error(`Duplicate devtools panel id "${panel.id}".`);
      }
      seenPanelIds.add(panel.id);
      const order = panel.order !== undefined && Number.isFinite(panel.order) ? panel.order : 100;
      groups.push({
        // Prefixed so an extension panel id can never collide with a built-in group id.
        id: `extension:${panel.id}`,
        title: panel.title,
        order,
        panels: [
          {
            id: panel.id,
            title: panel.title,
            requiresInstance: panel.requiresInstance ?? true,
            badge: null,
            kind: "extension",
            extensionId: extension.id,
            panel,
          },
        ],
      });
    }
  }

  return groups.sort(
    (left, right) => left.order - right.order || left.title.localeCompare(right.title),
  );
}
