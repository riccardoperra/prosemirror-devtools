import type { DispatchPhaseTiming, TransactionRecord } from "../core/types";
import { getTimingCoverage, mergeTimingIntervals, type TimingInterval } from "./timing-intervals";

export interface CustomCodeTiming {
  startOffset: number;
  duration: number;
}

export interface DispatchPhaseBreakdown {
  totalDuration: number;
  applyDuration: number;
  viewUpdateDuration: number;
  customCodeDuration: number;
  otherDuration: number;
}

function phaseIntervals(
  timings: readonly DispatchPhaseTiming[],
  phase: DispatchPhaseTiming["phase"],
  maximum: number,
): TimingInterval[] {
  return mergeTimingIntervals(
    timings.filter((timing) => timing.phase === phase),
    maximum,
  );
}

function subtractIntervals(
  source: readonly TimingInterval[],
  covered: readonly TimingInterval[],
): TimingInterval[] {
  const output: TimingInterval[] = [];
  for (const interval of source) {
    const end = interval.startOffset + interval.duration;
    let cursor = interval.startOffset;
    for (const blocker of covered) {
      const blockerEnd = blocker.startOffset + blocker.duration;
      if (blockerEnd <= cursor) continue;
      if (blocker.startOffset >= end) break;
      if (blocker.startOffset > cursor) {
        output.push({ startOffset: cursor, duration: blocker.startOffset - cursor });
      }
      cursor = Math.max(cursor, blockerEnd);
      if (cursor >= end) break;
    }
    if (cursor < end) output.push({ startOffset: cursor, duration: end - cursor });
  }
  return output;
}

/** Return exact custom-dispatch gaps not covered by observed apply/view calls. */
export function findCustomCodeTimings(
  phaseTimings: readonly DispatchPhaseTiming[],
): CustomCodeTiming[] {
  const maximum = Math.max(
    ...phaseTimings.map((timing) => timing.startOffset + timing.duration),
    0,
  );
  const custom = phaseIntervals(phaseTimings, "customDispatch", maximum);
  const covered = mergeTimingIntervals(
    phaseTimings.filter((timing) => timing.phase === "apply" || timing.phase === "viewUpdate"),
    maximum,
  );
  return subtractIntervals(custom, covered);
}

/**
 * Produces mutually exclusive synchronous phase durations. Overlapping nested
 * observations are merged, and view time overlapping apply time is attributed
 * to apply once instead of being double-counted.
 */
export function buildDispatchPhaseBreakdown(
  record: Pick<TransactionRecord, "phaseTimings" | "totalDuration">,
): DispatchPhaseBreakdown {
  const totalDuration = Math.max(0, record.totalDuration);
  const applyIntervals = phaseIntervals(record.phaseTimings, "apply", totalDuration);
  const viewIntervals = subtractIntervals(
    phaseIntervals(record.phaseTimings, "viewUpdate", totalDuration),
    applyIntervals,
  );
  const customIntervals = findCustomCodeTimings(record.phaseTimings);
  const applyDuration = getTimingCoverage(applyIntervals, totalDuration);
  const viewUpdateDuration = getTimingCoverage(viewIntervals, totalDuration);
  const customCodeDuration = getTimingCoverage(customIntervals, totalDuration);
  return {
    totalDuration,
    applyDuration,
    viewUpdateDuration,
    customCodeDuration,
    otherDuration: Math.max(
      0,
      totalDuration - applyDuration - viewUpdateDuration - customCodeDuration,
    ),
  };
}
