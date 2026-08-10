import type { PluginHook, PluginTiming } from "../core/types";
import { getTimingCoverage } from "./timing-intervals";

export interface PluginHookTimingGroup {
  hook: PluginHook;
  callCount: number;
  duration: number;
  maxDuration: number;
}

export interface PluginTimingGroup {
  pluginKey: string;
  pluginLabel: string;
  callCount: number;
  duration: number;
  hooks: PluginHookTimingGroup[];
}

/**
 * Groups one dispatch's inclusive plugin spans without double-counting nested
 * callbacks. Durations represent synchronous interval coverage, not CPU time.
 */
export function groupPluginTimings(timings: readonly PluginTiming[]): PluginTimingGroup[] {
  const plugins = new Map<
    string,
    {
      pluginKey: string;
      pluginLabel: string;
      timings: PluginTiming[];
      hooks: Map<PluginHook, PluginTiming[]>;
    }
  >();

  for (const timing of timings) {
    const plugin = plugins.get(timing.pluginKey) ?? {
      pluginKey: timing.pluginKey,
      pluginLabel: timing.pluginLabel,
      timings: [] as PluginTiming[],
      hooks: new Map<PluginHook, PluginTiming[]>(),
    };
    plugin.timings.push(timing);
    const hookTimings = plugin.hooks.get(timing.hook) ?? [];
    hookTimings.push(timing);
    plugin.hooks.set(timing.hook, hookTimings);
    plugins.set(timing.pluginKey, plugin);
  }

  return Array.from(plugins.values())
    .map((plugin): PluginTimingGroup => ({
      pluginKey: plugin.pluginKey,
      pluginLabel: plugin.pluginLabel,
      callCount: plugin.timings.length,
      duration: getTimingCoverage(plugin.timings),
      hooks: Array.from(plugin.hooks.entries())
        .map(([hook, hookTimings]): PluginHookTimingGroup => ({
          hook,
          callCount: hookTimings.length,
          duration: getTimingCoverage(hookTimings),
          maxDuration: Math.max(...hookTimings.map((timing) => timing.duration), 0),
        }))
        .sort((a, b) => b.duration - a.duration || a.hook.localeCompare(b.hook)),
    }))
    .sort(
      (a, b) =>
        b.duration - a.duration ||
        a.pluginLabel.localeCompare(b.pluginLabel) ||
        a.pluginKey.localeCompare(b.pluginKey),
    );
}
