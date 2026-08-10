import type { CSSProperties } from "react";

import type { DevtoolsTheme, DevtoolsStore } from "../core/types";

export type ProseMirrorDevtoolsTab =
  "state" | "history" | "performance" | "plugins" | "schema" | "snapshots";

export type PanelDensity = "compact" | "comfortable";

export interface ProseMirrorDevtoolsPanelProps {
  store?: DevtoolsStore;
  theme?: DevtoolsTheme;
  defaultTab?: ProseMirrorDevtoolsTab;
  className?: string;
  style?: CSSProperties;
  /** Document that receives the panel stylesheet. Defaults to the current document. */
  styleTarget?: Document;
}
