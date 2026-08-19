import type { PluginHook, PluginTimingSummary } from "../types";

export type MutablePluginTimingSummary = {
  pluginKey: string;
  pluginLabel: string;
  hook: PluginHook;
  count: number;
  total: number;
  max: number;
  last: number;
};

export type PluginTimingAggregates = Map<string, MutablePluginTimingSummary>;

export function recordPluginTiming(
  aggregates: PluginTimingAggregates,
  pluginKey: string,
  pluginLabel: string,
  hook: PluginHook,
  duration: number,
): void {
  const aggregateKey = JSON.stringify([pluginKey, hook]);
  const aggregate = aggregates.get(aggregateKey) ?? {
    pluginKey,
    pluginLabel,
    hook,
    count: 0,
    total: 0,
    max: 0,
    last: 0,
  };
  aggregate.count += 1;
  aggregate.total += duration;
  aggregate.max = Math.max(aggregate.max, duration);
  aggregate.last = duration;
  aggregates.set(aggregateKey, aggregate);
}

export function readPluginTimingSummaries(
  aggregates: PluginTimingAggregates,
): readonly PluginTimingSummary[] {
  return Array.from(aggregates.values(), (value): PluginTimingSummary => ({
    ...value,
    average: value.count === 0 ? 0 : value.total / value.count,
  })).sort((a, b) => b.total - a.total);
}
