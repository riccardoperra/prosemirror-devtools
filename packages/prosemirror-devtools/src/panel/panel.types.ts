import type { CSSProperties } from "react";

import type { DevtoolsTheme, DevtoolsStore } from "../core/types";

export type ProseMirrorDevtoolsTab =
  "state" | "history" | "performance" | "plugins" | "schema" | "snapshots";

export type PanelDensity = "compact" | "comfortable";

export interface ProseMirrorDevtoolsPanelProps {
  store?: DevtoolsStore;
  theme?: DevtoolsTheme;
  defaultTab?: ProseMirrorDevtoolsTab;
  /**
   * Dispatch-time reference shown in the performance timeline, in milliseconds.
   * It also provides the minimum upper bound for the timeline scale. Defaults to
   * the 60 FPS frame budget (`1000 / 60`).
   */
  performanceFrameBudgetMs?: number;
  /**
   * Optional fixed upper edge of the expanded low-duration region, in milliseconds.
   * When omitted, the timeline derives it from the average of the fastest visible
   * dispatches. Set to `0` to use a fully linear scale.
   */
  performanceDetailThresholdMs?: number;
  className?: string;
  style?: CSSProperties;
  /** Document that receives the panel stylesheet. Defaults to the current document. */
  styleTarget?: Document;
}
