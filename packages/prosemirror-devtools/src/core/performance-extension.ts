import type {
  DispatchPhaseTiming,
  DevtoolsMarker,
  DevtoolsMarkerTone,
  DevtoolsPerformanceExtensionOptions,
  PluginHook,
  SerializedValue,
  TransactionRecord,
} from "./types";

type DevToolsColor =
  | "primary"
  | "primary-light"
  | "primary-dark"
  | "secondary"
  | "secondary-light"
  | "secondary-dark"
  | "tertiary"
  | "tertiary-light"
  | "tertiary-dark"
  | "error";

export interface ResolvedPerformanceExtensionOptions {
  trackGroup: string;
  dispatches: boolean;
  phases: boolean;
  customCode: boolean;
  customCodeThresholdMs: number;
  pluginHooks: boolean;
  grouping: "dispatch" | "phase" | "plugin";
  pluginHookThresholdMs: number;
  markers: boolean;
  timelineMarkers: boolean;
}

export type PerformancePhaseTiming = DispatchPhaseTiming;

export interface PerformanceExtensionEntryReference {
  name: string;
  type: "mark" | "measure";
}

export function resolvePerformanceExtensionOptions(
  options: boolean | DevtoolsPerformanceExtensionOptions | undefined,
  instanceLabel: string,
): ResolvedPerformanceExtensionOptions | null {
  if (!options) return null;
  const configured = options === true ? {} : options;
  return {
    trackGroup: configured.trackGroup?.trim() || `ProseMirror Devtools · ${instanceLabel}`,
    dispatches: configured.dispatches ?? true,
    phases: configured.phases ?? true,
    customCode: configured.customCode ?? true,
    customCodeThresholdMs: Math.max(0, configured.customCodeThresholdMs ?? 0),
    pluginHooks: configured.pluginHooks ?? true,
    grouping: configured.grouping ?? "dispatch",
    pluginHookThresholdMs: Math.max(0, configured.pluginHookThresholdMs ?? 0),
    markers: configured.markers ?? true,
    timelineMarkers: configured.timelineMarkers ?? true,
  };
}

function text(value: SerializedValue): string {
  if (typeof value === "string") return value;
  const serialized = JSON.stringify(value);
  return serialized.length > 500 ? `${serialized.slice(0, 497)}…` : serialized;
}

function markerProperties(marker: DevtoolsMarker, record: TransactionRecord): [string, string][] {
  const properties: [string, string][] = [
    ["Editor", record.instanceId],
    ["Dispatch", `#${record.id}`],
  ];
  if (marker.category) properties.push(["Category", marker.category]);
  if (marker.data !== undefined) {
    if (marker.data && typeof marker.data === "object" && !Array.isArray(marker.data)) {
      for (const [key, value] of Object.entries(marker.data)) properties.push([key, text(value)]);
    } else {
      properties.push(["Data", text(marker.data)]);
    }
  }
  return properties;
}

function toneColor(tone: DevtoolsMarkerTone): DevToolsColor {
  switch (tone) {
    case "danger":
      return "error";
    case "warning":
      return "tertiary-dark";
    case "success":
      return "secondary";
    case "info":
      return "primary-light";
    default:
      return "primary";
  }
}

function hookColor(hook: PluginHook): DevToolsColor {
  if (hook.startsWith("view.") || hook.startsWith("props.") || hook.startsWith("nodeView.")) {
    return "secondary-light";
  }
  if (hook === "filterTransaction" || hook === "appendTransaction") return "tertiary-light";
  return "primary-light";
}

function phaseTrack(phase: PerformancePhaseTiming["phase"]): string {
  switch (phase) {
    case "apply":
      return "State apply";
    case "viewUpdate":
      return "View update";
    case "customDispatch":
      return "Dispatches";
  }
}

function hookTrack(hook: PluginHook): string {
  return hook === "state.init" ||
    hook === "state.apply" ||
    hook === "filterTransaction" ||
    hook === "appendTransaction"
    ? "State apply"
    : "View update";
}

interface CustomCodeTiming {
  startOffset: number;
  duration: number;
}

/** Return exact gaps in custom-dispatch intervals not covered by observed apply/view calls. */
export function findCustomCodeTimings(
  phaseTimings: readonly PerformancePhaseTiming[],
): CustomCodeTiming[] {
  const covered = phaseTimings
    .filter((timing) => timing.phase === "apply" || timing.phase === "viewUpdate")
    .map((timing) => ({
      start: timing.startOffset,
      end: timing.startOffset + timing.duration,
    }));
  const gaps: CustomCodeTiming[] = [];

  for (const custom of phaseTimings.filter((timing) => timing.phase === "customDispatch")) {
    const customStart = custom.startOffset;
    const customEnd = custom.startOffset + custom.duration;
    const clipped = covered
      .map((interval) => ({
        start: Math.max(customStart, interval.start),
        end: Math.min(customEnd, interval.end),
      }))
      .filter((interval) => interval.end > interval.start)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    let cursor = customStart;
    for (const interval of clipped) {
      if (interval.start > cursor) {
        gaps.push({ startOffset: cursor, duration: interval.start - cursor });
      }
      cursor = Math.max(cursor, interval.end);
    }
    if (cursor < customEnd) gaps.push({ startOffset: cursor, duration: customEnd - cursor });
  }

  return gaps;
}

function trackDetail(
  track: string,
  trackGroup: string,
  color: DevToolsColor,
  properties: [string, string][],
  tooltipText: string,
): unknown {
  return {
    devtools: {
      dataType: "track-entry",
      track,
      trackGroup,
      color,
      properties,
      tooltipText,
    },
  };
}

function markerDetail(
  color: DevToolsColor,
  properties: [string, string][],
  tooltipText: string,
): unknown {
  return {
    devtools: {
      dataType: "marker",
      color,
      properties,
      tooltipText,
    },
  };
}

/** Emit Chrome DevTools Performance extension entries without affecting editor execution. */
export function emitPerformanceExtensionEntries(
  record: TransactionRecord,
  clockStartedAt: number,
  options: ResolvedPerformanceExtensionOptions | null,
  phaseTimings: readonly PerformancePhaseTiming[],
): PerformanceExtensionEntryReference[] {
  if (!options) return [];
  const performance = globalThis.performance;
  if (
    !performance ||
    typeof performance.mark !== "function" ||
    typeof performance.measure !== "function"
  ) {
    return [];
  }

  const references: PerformanceExtensionEntryReference[] = [];
  const suffix = `${record.instanceId} #${record.id}`;
  const measure = (name: string, start: number, duration: number, detail: unknown): void => {
    try {
      performance.measure(name, {
        start,
        duration: Math.max(0, duration),
        detail,
      });
      references.push({ name, type: "measure" });
    } catch {
      // The extensibility payload is optional and must never affect dispatch.
    }
  };

  if (options.dispatches) {
    const dispatcher = record.customDispatchDuration == null ? "default" : "custom";
    const dispatchProperties: [string, string][] = [
      ["Editor", record.instanceId],
      ["Dispatcher", dispatcher],
      ["Status", record.applicationStatus],
      ["Steps", String(record.stepCount)],
      ["Applied transactions", String(record.appliedTransactionCount ?? "unknown")],
      ["Appended transactions", String(record.appendedTransactionCount ?? "unknown")],
      ["Duration", `${record.totalDuration.toFixed(2)} ms`],
    ];
    if (record.customDispatchDuration != null) {
      dispatchProperties.push([
        "Custom callback duration",
        `${record.customDispatchDuration.toFixed(2)} ms`,
      ]);
    }
    measure(
      `Dispatch #${record.id} · ${record.instanceId}`,
      clockStartedAt,
      record.totalDuration,
      trackDetail(
        "Dispatches",
        options.trackGroup,
        record.error ? "error" : dispatcher === "custom" ? "tertiary" : "primary",
        dispatchProperties,
        `Dispatch #${record.id} · ${dispatcher} · ${record.totalDuration.toFixed(2)} ms`,
      ),
    );
  }

  if (options.phases) {
    for (const [index, timing] of phaseTimings.entries()) {
      if (timing.phase === "customDispatch") continue;
      const track = phaseTrack(timing.phase);
      measure(
        `${track} · ${suffix} · ${index + 1}`,
        clockStartedAt + timing.startOffset,
        timing.duration,
        trackDetail(
          options.grouping === "dispatch" ? "Dispatches" : track,
          options.trackGroup,
          timing.phase === "apply" ? "primary-dark" : "secondary-dark",
          [
            ["Editor", record.instanceId],
            ["Dispatch", `#${record.id}`],
            ["Phase", track],
            ["Duration", `${timing.duration.toFixed(2)} ms`],
          ],
          `${track} · ${timing.duration.toFixed(2)} ms`,
        ),
      );
    }
  }

  if (options.customCode) {
    const customCodeTimings = findCustomCodeTimings(phaseTimings).filter(
      (timing) => timing.duration >= options.customCodeThresholdMs,
    );
    for (const [index, timing] of customCodeTimings.entries()) {
      const endOffset = timing.startOffset + timing.duration;
      measure(
        `Custom code · ${suffix} · ${index + 1}`,
        clockStartedAt + timing.startOffset,
        timing.duration,
        trackDetail(
          options.grouping === "dispatch" ? "Dispatches" : "Custom code",
          options.trackGroup,
          "tertiary-light",
          [
            ["Editor", record.instanceId],
            ["Dispatch", `#${record.id}`],
            ["Start offset", `${timing.startOffset.toFixed(2)} ms`],
            ["End offset", `${endOffset.toFixed(2)} ms`],
            ["Duration", `${timing.duration.toFixed(2)} ms`],
            ["Attribution", "Outside observed state apply and view update"],
          ],
          `Custom code · ${timing.duration.toFixed(2)} ms`,
        ),
      );
    }
  }

  if (options.pluginHooks) {
    for (const [index, timing] of record.timings.entries()) {
      if (timing.duration < options.pluginHookThresholdMs) continue;
      measure(
        `${timing.pluginLabel} · ${timing.hook} · ${suffix} · ${index + 1}`,
        clockStartedAt + timing.startOffset,
        timing.duration,
        trackDetail(
          options.grouping === "dispatch"
            ? "Dispatches"
            : options.grouping === "plugin"
              ? `Plugin · ${timing.pluginLabel}`
              : hookTrack(timing.hook),
          options.trackGroup,
          hookColor(timing.hook),
          [
            ["Plugin key", timing.pluginKey],
            ["Hook", timing.hook],
            ["Dispatch", `#${record.id}`],
            ["Duration", `${timing.duration.toFixed(2)} ms`],
          ],
          `${timing.hook} · ${timing.duration.toFixed(2)} ms`,
        ),
      );
    }
  }

  if (options.markers) {
    for (const [index, marker] of (record.markers ?? []).entries()) {
      const name = `${marker.label} · ${suffix} · ${index + 1}`;
      const properties = markerProperties(marker, record);
      const tooltip =
        marker.duration == null
          ? marker.label
          : `${marker.label} · ${marker.duration.toFixed(2)} ms`;
      if (marker.duration == null) {
        measure(
          `${name} · track`,
          clockStartedAt + marker.startOffset,
          0,
          trackDetail("Markers", options.trackGroup, toneColor(marker.tone), properties, tooltip),
        );
        if (options.timelineMarkers) {
          try {
            performance.mark(name, {
              startTime: clockStartedAt + marker.startOffset,
              detail: markerDetail(toneColor(marker.tone), properties, tooltip),
            });
            references.push({ name, type: "mark" });
          } catch {
            // See the measure guard above.
          }
        }
      } else {
        measure(
          name,
          clockStartedAt + marker.startOffset,
          marker.duration,
          trackDetail("Markers", options.trackGroup, toneColor(marker.tone), properties, tooltip),
        );
      }
    }
  }

  return references;
}

export function clearPerformanceExtensionEntries(
  references: readonly PerformanceExtensionEntryReference[],
): void {
  for (const reference of references) {
    if (reference.type === "mark") globalThis.performance?.clearMarks?.(reference.name);
    else globalThis.performance?.clearMeasures?.(reference.name);
  }
}
