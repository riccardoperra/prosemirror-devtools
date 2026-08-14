import type { ProseMirrorDevtoolsTab } from "./panel.types";

export interface PanelTabDefinition {
  id: ProseMirrorDevtoolsTab;
  label: string;
}

export const DEFAULT_PERFORMANCE_FRAME_BUDGET_MS = 1000 / 60;

export const PANEL_TABS: readonly PanelTabDefinition[] = [
  { id: "state", label: "State" },
  { id: "history", label: "History" },
  { id: "performance", label: "Performance" },
  { id: "plugins", label: "Plugins" },
  { id: "schema", label: "Schema" },
  { id: "snapshots", label: "Snapshots" },
];
