import type { CaptureProfile, CaptureBudgets, CaptureGap } from "../inspection/types";
import { defaultInspectionLimits, resolveInspectionLimits } from "../inspection/serialization";

const defaultBudgets: CaptureBudgets = {
  transactions: null,
  events: 200,
  decorations: 200,
  nodeViews: 200,
  projections: defaultInspectionLimits,
  gaps: 200,
};

export function createBoundedCaptureProfile(budgets: Partial<CaptureBudgets> = {}): CaptureProfile {
  return resolveCaptureProfile({
    kind: "bounded",
    budgets: { ...defaultBudgets, transactions: 200, ...budgets },
  });
}

export function resolveCaptureProfile(
  profile?: "bounded" | CaptureProfile,
  transactionLimit?: number | null,
): CaptureProfile {
  const supplied = profile === "bounded" ? createBoundedCaptureProfile() : profile;
  const bounded = (value: number, fallback: number): number =>
    Number.isFinite(value) ? Math.max(1, Math.min(10_000, Math.floor(value))) : fallback;
  const transactions =
    transactionLimit === undefined ? (supplied?.budgets.transactions ?? null) : transactionLimit;
  return {
    kind: supplied?.kind ?? (transactions === null ? "unbounded" : "bounded"),
    budgets: {
      transactions:
        transactions === null || !Number.isFinite(transactions)
          ? null
          : Math.max(1, Math.floor(transactions)),
      events: bounded(supplied?.budgets.events ?? defaultBudgets.events, defaultBudgets.events),
      decorations: bounded(
        supplied?.budgets.decorations ?? defaultBudgets.decorations,
        defaultBudgets.decorations,
      ),
      nodeViews: bounded(
        supplied?.budgets.nodeViews ?? defaultBudgets.nodeViews,
        defaultBudgets.nodeViews,
      ),
      projections: resolveInspectionLimits(supplied?.budgets.projections),
      gaps: bounded(supplied?.budgets.gaps ?? defaultBudgets.gaps, defaultBudgets.gaps),
    },
  };
}

export function appendCaptureGap(
  gaps: readonly CaptureGap[],
  gap: CaptureGap,
  limit: number,
): { gaps: readonly CaptureGap[]; omitted: number } {
  const merged: CaptureGap[] = [];
  for (const next of [...gaps, gap].sort(
    (left, right) => left.firstDispatchId - right.firstDispatchId,
  )) {
    const previous = merged.at(-1);
    if (
      previous &&
      previous.reason === next.reason &&
      previous.lastDispatchId + 1 === next.firstDispatchId
    ) {
      merged[merged.length - 1] = {
        ...previous,
        lastDispatchId: next.lastDispatchId,
        stateAfterId: next.stateAfterId,
      };
    } else {
      merged.push(next);
    }
  }
  return { gaps: merged.slice(-limit), omitted: Math.max(0, merged.length - limit) };
}
