import type { PluginHook, TransactionRecord } from "../../../../core/types";
import {
  buildPhaseTimeline,
  buildPluginTimeline,
  type PhaseTimelineEntry,
  type PluginTimelineEntry,
} from "../dispatch-cost/model";
import { hookFamily, hookLabel, type PluginHookFamily } from "../plugin-timing-formatters";

export type PluginTimelineColor =
  "dispatch" | "apply" | "viewUpdate" | "customDispatch" | PluginHookFamily;

interface TimelineLaneBase {
  id: string;
  laneKey: string;
  label: string;
  startOffset: number;
  endOffset: number;
  duration: number;
  colorKey: PluginTimelineColor;
}

export interface DispatchTimelineLane extends TimelineLaneBase {
  kind: "dispatch";
}

export interface PhaseTimelineLane extends TimelineLaneBase {
  kind: "phase";
  phase: PhaseTimelineEntry["phase"];
}

export interface PluginCallTimelineLane extends TimelineLaneBase {
  kind: "plugin";
  sequence: number;
  depth: number;
  pluginKey: string;
  hook: PluginHook;
}

export type PluginTimelineLane = DispatchTimelineLane | PhaseTimelineLane | PluginCallTimelineLane;

export interface PluginTimelineModel {
  lanes: readonly PluginTimelineLane[];
  pluginCallCount: number;
}

function phaseLane(entry: PhaseTimelineEntry): PhaseTimelineLane {
  return {
    id: `phase:${entry.id}`,
    laneKey: `phase:${entry.id}`,
    kind: "phase",
    phase: entry.phase,
    label: entry.label,
    startOffset: entry.startOffset,
    endOffset: entry.endOffset,
    duration: entry.duration,
    colorKey: entry.phase,
  };
}

function pluginLane(entry: PluginTimelineEntry): PluginCallTimelineLane {
  return {
    id: `call:${entry.id}`,
    laneKey: `call:${entry.sequence}:${entry.id}`,
    kind: "plugin",
    sequence: entry.sequence,
    depth: entry.depth,
    pluginKey: entry.pluginKey,
    hook: entry.hook,
    label: entry.pluginLabel,
    startOffset: entry.startOffset,
    endOffset: entry.endOffset,
    duration: entry.duration,
    colorKey: hookFamily(entry.hook),
  };
}

export function buildPluginTimelineModel(record: TransactionRecord): PluginTimelineModel {
  const phaseLanes = buildPhaseTimeline(record).map(phaseLane);
  const pluginLanes = buildPluginTimeline(record).map(pluginLane);

  return {
    lanes: [
      {
        id: "dispatch",
        laneKey: "dispatch",
        kind: "dispatch",
        label: "Full dispatch",
        startOffset: 0,
        endOffset: Math.max(0, record.totalDuration),
        duration: Math.max(0, record.totalDuration),
        colorKey: "dispatch",
      },
      ...phaseLanes,
      ...pluginLanes,
    ],
    pluginCallCount: pluginLanes.length,
  };
}

export function timelineLaneDetail(lane: PluginTimelineLane): string {
  if (lane.kind === "dispatch") return "Synchronous boundary";
  if (lane.kind === "phase") return "Observed phase";
  return hookLabel(lane.hook);
}
