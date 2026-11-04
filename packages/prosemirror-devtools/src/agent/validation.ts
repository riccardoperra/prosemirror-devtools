import type { SerializedValue } from "../core/types";
import type { InspectionResult, InspectionVerdict } from "../inspection/types";

export type InspectionPredicate =
  | { readonly kind: "equals"; readonly expected: SerializedValue }
  | { readonly kind: "contains"; readonly expected: string }
  | { readonly kind: "at-least"; readonly expected: number }
  | { readonly kind: "exists" };

export type InspectionValuePath = readonly (string | number)[];

export interface InspectionAssertion {
  readonly path: InspectionValuePath;
  readonly requiredEvidence?: readonly InspectionValuePath[];
  readonly predicate: InspectionPredicate;
  readonly completeness: "value" | "capture";
}

function sameValue(left: SerializedValue, right: SerializedValue): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== typeof right) return false;
  if (Array.isArray(left)) {
    return (
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameValue(value, right[index] ?? null))
    );
  }
  if (Array.isArray(right) || typeof left !== "object" || typeof right !== "object") {
    return false;
  }
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) => Object.hasOwn(right, key) && sameValue(left[key] ?? null, right[key] ?? null),
    )
  );
}

function selectValue(
  value: SerializedValue,
  path: readonly (string | number)[],
): { readonly kind: "found"; readonly value: SerializedValue } | { readonly kind: "missing" } {
  let current = value;
  for (const segment of path) {
    if (Array.isArray(current)) {
      if (
        typeof segment !== "number" ||
        !Number.isInteger(segment) ||
        segment < 0 ||
        segment >= current.length
      ) {
        return { kind: "missing" };
      }
      const next = current[segment];
      if (next === undefined) return { kind: "missing" };
      current = next;
    } else if (
      current !== null &&
      typeof current === "object" &&
      typeof segment === "string" &&
      Object.hasOwn(current, segment)
    ) {
      const next = current[segment];
      if (next === undefined) return { kind: "missing" };
      current = next;
    } else {
      return { kind: "missing" };
    }
  }
  return { kind: "found", value: current };
}

export function evaluateProseMirrorInspection(
  result: InspectionResult,
  assertion: InspectionAssertion,
): InspectionVerdict {
  if (result.kind !== "available") {
    return { kind: "inconclusive", reason: result.reason, missing: [result.kind] };
  }
  if (result.point === null) {
    return {
      kind: "inconclusive",
      reason: "The result has no observation point.",
      missing: ["point"],
    };
  }
  if (
    result.coverage.truncated ||
    (assertion.completeness === "capture" && !result.coverage.complete)
  ) {
    return {
      kind: "inconclusive",
      reason: "The evidence required by this assertion is incomplete.",
      missing: result.coverage.truncated ? ["untruncated-value"] : ["complete-capture"],
    };
  }
  for (const path of assertion.requiredEvidence ?? []) {
    const required = selectValue(result.value, path);
    const value = required.kind === "found" ? required.value : null;
    if (
      value === null ||
      Array.isArray(value) ||
      typeof value !== "object" ||
      value.kind !== "available" ||
      !Object.hasOwn(value, "value")
    ) {
      return {
        kind: "inconclusive",
        reason:
          value !== null &&
          !Array.isArray(value) &&
          typeof value === "object" &&
          typeof value.reason === "string"
            ? value.reason
            : "A required nested evidence projection is unavailable.",
        missing: [`evidence:${JSON.stringify(path)}`],
      };
    }
  }
  const selected = selectValue(result.value, assertion.path);
  const predicate = assertion.predicate;
  let passed: boolean;
  if (predicate.kind === "exists") {
    passed = selected.kind === "found";
  } else if (selected.kind === "missing") {
    passed = false;
  } else {
    switch (predicate.kind) {
      case "equals":
        passed = sameValue(selected.value, predicate.expected);
        break;
      case "contains":
        passed = typeof selected.value === "string" && selected.value.includes(predicate.expected);
        break;
      case "at-least":
        passed = typeof selected.value === "number" && selected.value >= predicate.expected;
        break;
    }
  }
  const evidence = [result.point];
  return passed
    ? { kind: "passed", evidence }
    : { kind: "failed", reason: "The observed value does not satisfy the expectation.", evidence };
}
