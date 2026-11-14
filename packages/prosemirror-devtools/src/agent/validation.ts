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

type SelectedValue =
  | { readonly kind: "found"; readonly value: SerializedValue }
  | { readonly kind: "missing"; readonly reason: string };

function describeValue(value: SerializedValue): string {
  if (Array.isArray(value)) return `an array of ${value.length} items`;
  if (value === null) return "null";
  return typeof value === "object" ? "an object" : `a ${typeof value}`;
}

function selectValue(value: SerializedValue, path: readonly (string | number)[]): SelectedValue {
  let current = value;
  for (const [index, segment] of path.entries()) {
    let next: SerializedValue | undefined;
    if (Array.isArray(current)) {
      if (typeof segment === "number" && Number.isInteger(segment) && segment >= 0) {
        next = current[segment];
      }
    } else if (
      current !== null &&
      typeof current === "object" &&
      typeof segment === "string" &&
      Object.hasOwn(current, segment)
    ) {
      next = current[segment];
    }
    if (next === undefined) {
      const hint =
        Array.isArray(current) && typeof segment === "string"
          ? " Arrays accept only integer indexes."
          : "";
      return {
        kind: "missing",
        reason: `The path ${JSON.stringify(path)} does not resolve: segment ${index} (${JSON.stringify(segment)}) is not present in ${describeValue(current)}.${hint}`,
      };
    }
    current = next;
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
  const evidence = [result.point];
  if (selected.kind === "missing") {
    return { kind: "failed", reason: selected.reason, evidence };
  }
  let passed: boolean;
  if (predicate.kind === "exists") {
    passed = true;
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
  return passed
    ? { kind: "passed", evidence }
    : { kind: "failed", reason: "The observed value does not satisfy the expectation.", evidence };
}
