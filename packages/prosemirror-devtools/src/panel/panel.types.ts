import type { JSX } from "solid-js";

import type { DevtoolsExtension } from "../core/extensions";
import type { ProseMirrorDevtoolsTab } from "../core/panel-types";
import type { DevtoolsTheme, DevtoolsStore } from "../core/types";
import type { ProseMirrorDevtoolsCssVariable } from "../styles";

export type { ProseMirrorDevtoolsTab } from "../core/panel-types";

export type PanelDensity = "compact" | "comfortable";

export type ProseMirrorDevtoolsPanelStyle = JSX.CSSProperties &
  Partial<Record<ProseMirrorDevtoolsCssVariable, string | number>>;

export interface ProseMirrorDevtoolsPanelProps {
  store?: DevtoolsStore;
  theme?: DevtoolsTheme;
  /** @deprecated Use `defaultPanel`. */
  defaultTab?: ProseMirrorDevtoolsTab;
  /** Initial built-in or extension panel id for uncontrolled navigation. */
  defaultPanel?: string;
  /** Controlled built-in or extension panel id. */
  activePanel?: string;
  onActivePanelChange?: (panelId: string) => void;
  /** Per-host panel extensions; no global registry is used. */
  extensions?: readonly DevtoolsExtension[];
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
  style?: ProseMirrorDevtoolsPanelStyle;
  /** Document that receives the panel stylesheet. Defaults to the current document. */
  styleTarget?: Document;
  /** @internal Whether a devtools host already provides the surrounding chrome. */
  embedded?: boolean;
}
