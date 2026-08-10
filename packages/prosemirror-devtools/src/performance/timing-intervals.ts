export interface TimingInterval {
  startOffset: number;
  duration: number;
}

export interface MergedTimingInterval {
  startOffset: number;
  duration: number;
}

export function mergeTimingIntervals(
  timings: readonly TimingInterval[],
  maximum = Number.POSITIVE_INFINITY,
): MergedTimingInterval[] {
  const intervals = timings
    .map((timing) => {
      const start = Math.min(maximum, Math.max(0, timing.startOffset));
      const end = Math.min(maximum, Math.max(start, timing.startOffset + timing.duration));
      return { start, end };
    })
    .filter((interval) => interval.end > interval.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const merged: MergedTimingInterval[] = [];
  for (const interval of intervals) {
    const active = merged.at(-1);
    if (!active || interval.start > active.startOffset + active.duration) {
      merged.push({
        startOffset: interval.start,
        duration: interval.end - interval.start,
      });
      continue;
    }
    active.duration =
      Math.max(active.startOffset + active.duration, interval.end) - active.startOffset;
  }
  return merged;
}

export function getTimingCoverage(
  timings: readonly TimingInterval[],
  maximum = Number.POSITIVE_INFINITY,
): number {
  return mergeTimingIntervals(timings, maximum).reduce(
    (total, interval) => total + interval.duration,
    0,
  );
}
