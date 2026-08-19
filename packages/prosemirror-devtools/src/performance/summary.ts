import type { TransactionRecord } from "../core/types";

export interface PerformanceSummary {
  durations: readonly number[];
  average: number;
  percentile95: number;
  maximum: number;
}

function calculatePercentile95(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}

export function buildPerformanceSummary(
  transactions: readonly Pick<TransactionRecord, "totalDuration">[],
): PerformanceSummary {
  const durations = transactions.map((record) => record.totalDuration);
  const average = durations.reduce((sum, value) => sum + value, 0) / Math.max(1, durations.length);
  return {
    durations,
    average,
    percentile95: calculatePercentile95(durations),
    maximum: Math.max(...durations, 0),
  };
}
