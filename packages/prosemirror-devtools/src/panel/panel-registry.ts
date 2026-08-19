import type { DevtoolsExtension, DevtoolsPanelExtension } from "../core/extensions";
import type { ProseMirrorDevtoolsTab } from "./panel.types";

export type BuiltinPanelDefinition = Readonly<{
  id: ProseMirrorDevtoolsTab;
  title: string;
  order: number;
  requiresInstance: true;
  badge: "transactions" | null;
  kind: "builtin";
}>;

export type ExternalPanelDefinition = Readonly<{
  id: string;
  title: string;
  order: number;
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
    order: 0,
    requiresInstance: true,
    badge: null,
    kind: "builtin",
  },
  {
    id: "history",
    title: "History",
    order: 10,
    requiresInstance: true,
    badge: "transactions",
    kind: "builtin",
  },
  {
    id: "performance",
    title: "Performance",
    order: 20,
    requiresInstance: true,
    badge: "transactions",
    kind: "builtin",
  },
  {
    id: "plugins",
    title: "Plugins",
    order: 30,
    requiresInstance: true,
    badge: null,
    kind: "builtin",
  },
  {
    id: "schema",
    title: "Schema",
    order: 40,
    requiresInstance: true,
    badge: null,
    kind: "builtin",
  },
  {
    id: "snapshots",
    title: "Snapshots",
    order: 50,
    requiresInstance: true,
    badge: null,
    kind: "builtin",
  },
];

export function resolvePanelRegistry(
  extensions: readonly DevtoolsExtension[],
): readonly ResolvedPanelDefinition[] {
  const seenExtensionIds = new Set<string>();
  const seenPanelIds = new Set<string>(BUILTIN_PANELS.map(({ id }) => id));
  const panels: ResolvedPanelDefinition[] = [...BUILTIN_PANELS];

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
      panels.push({
        id: panel.id,
        title: panel.title,
        order: panel.order !== undefined && Number.isFinite(panel.order) ? panel.order : 100,
        requiresInstance: panel.requiresInstance ?? true,
        badge: null,
        kind: "extension",
        extensionId: extension.id,
        panel,
      });
    }
  }

  return panels.sort(
    (left, right) => left.order - right.order || left.title.localeCompare(right.title),
  );
}
