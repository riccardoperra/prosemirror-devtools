import { describe, expect, it } from "vitest";

import { evaluateProseMirrorInspection } from "../src/agent/validation";
import type { SerializedValue } from "../src/core/types";
import type {
  InspectionCoverage,
  InspectionReadPoint,
  InspectionResult,
} from "../src/inspection/types";

const target = { sourceId: "fixture", editorId: "editor", sessionId: "mount-1", generation: 1 };
const point: InspectionReadPoint = {
  kind: "live",
  target,
  revision: 1,
  stateId: 1,
  dispatchId: 1,
  diagnosticsVersion: null,
};
const coverage: InspectionCoverage = {
  complete: true,
  gaps: [],
  truncated: false,
  limits: { maxItems: 100, maxDepth: 20, maxNodes: 4000, maxStringLength: 16000, maxBytes: 128000 },
  notes: [],
};

function observed(
  value: SerializedValue,
  changes: Partial<InspectionCoverage> = {},
): InspectionResult {
  return { kind: "available", target, point, value, coverage: { ...coverage, ...changes } };
}

describe("semantic agent validation", () => {
  it.each(["error", "unobserved", "disabled"])(
    "keeps a required nested %s projection inconclusive",
    (kind) => {
      const result = evaluateProseMirrorInspection(
        observed({ storage: { kind, reason: "Not captured." } }),
        {
          path: ["storage", "value", "count"],
          requiredEvidence: [["storage"]],
          predicate: { kind: "equals", expected: 1 },
          completeness: "value",
        },
      );
      expect(result.kind).toBe("inconclusive");
    },
  );

  it("checks nested available values and treats application kind fields as ordinary data", () => {
    const assertion = {
      path: ["storage", "value", "count"],
      requiredEvidence: [["storage"]],
      predicate: { kind: "equals", expected: 1 },
      completeness: "value",
    } as const;
    expect(
      evaluateProseMirrorInspection(
        observed({ storage: { kind: "available", value: { count: 1 } } }),
        assertion,
      ).kind,
    ).toBe("passed");
    expect(
      evaluateProseMirrorInspection(
        observed({ storage: { kind: "available", value: { count: 2 } } }),
        assertion,
      ).kind,
    ).toBe("failed");
    expect(
      evaluateProseMirrorInspection(
        observed({ kind: "error", message: "An application property." }),
        { path: ["kind"], predicate: { kind: "equals", expected: "error" }, completeness: "value" },
      ).kind,
    ).toBe("passed");
  });

  it("compares JSON objects independently of their property insertion order", () => {
    expect(
      evaluateProseMirrorInspection(observed({ a: 1, b: [false, null] }), {
        path: [],
        completeness: "value",
        predicate: { kind: "equals", expected: { b: [false, null], a: 1 } },
      }).kind,
    ).toBe("passed");
  });

  it("reports a demonstrated mismatch as failed with the exact observation point", () => {
    const result = evaluateProseMirrorInspection(observed({ from: 2 }), {
      path: ["from"],
      completeness: "value",
      predicate: { kind: "equals", expected: 3 },
    });
    expect(result).toEqual({
      kind: "failed",
      reason: "The observed value does not satisfy the expectation.",
      evidence: [point],
    });
  });

  it("selects arrays without treating zero, false or null as missing", () => {
    for (const expected of [0, false, null]) {
      expect(
        evaluateProseMirrorInspection(observed({ items: [expected] }), {
          path: ["items", 0],
          completeness: "value",
          predicate: { kind: "equals", expected },
        }).kind,
      ).toBe("passed");
    }
    expect(
      evaluateProseMirrorInspection(observed({ items: [0] }), {
        path: ["items", 1],
        completeness: "value",
        predicate: { kind: "exists" },
      }).kind,
    ).toBe("failed");
  });

  it("does not certify a causal trace from a current value when capture is incomplete", () => {
    const result = observed({ text: "Alpha" }, { complete: false, notes: ["capture paused"] });
    const predicate = { kind: "contains", expected: "Alpha" } satisfies {
      kind: "contains";
      expected: string;
    };
    expect(
      evaluateProseMirrorInspection(result, { path: ["text"], completeness: "value", predicate })
        .kind,
    ).toBe("passed");
    expect(
      evaluateProseMirrorInspection(result, { path: ["text"], completeness: "capture", predicate })
        .kind,
    ).toBe("inconclusive");
  });

  it("does not pass an equality on a truncated result", () => {
    expect(
      evaluateProseMirrorInspection(observed([], { truncated: true }), {
        path: [],
        completeness: "value",
        predicate: { kind: "equals", expected: [] },
      }).kind,
    ).toBe("inconclusive");
  });

  it("distinguishes disabled evidence from an empty observed result", () => {
    const unavailable: InspectionResult = {
      kind: "disabled",
      reason: "Enable diagnostics.",
      target,
      point,
      coverage,
    };
    expect(
      evaluateProseMirrorInspection(unavailable, {
        path: [],
        completeness: "value",
        predicate: { kind: "equals", expected: [] },
      }),
    ).toEqual({ kind: "inconclusive", reason: "Enable diagnostics.", missing: ["disabled"] });
    expect(
      evaluateProseMirrorInspection(observed([]), {
        path: [],
        completeness: "value",
        predicate: { kind: "equals", expected: [] },
      }).kind,
    ).toBe("passed");
  });

  it("names the unresolved path segment instead of reporting a value mismatch", () => {
    const document = observed({ content: [{ content: [{ type: "list_item" }] }] });
    expect(
      evaluateProseMirrorInspection(document, {
        path: ["content", 0, "content", "length"],
        completeness: "value",
        predicate: { kind: "equals", expected: 1 },
      }),
    ).toEqual({
      kind: "failed",
      reason:
        'The path ["content",0,"content","length"] does not resolve: segment 3 ("length") is not present in an array of 1 items. Arrays accept only integer indexes.',
      evidence: [point],
    });
    expect(
      evaluateProseMirrorInspection(document, {
        path: ["content", 0, "content", 1],
        completeness: "value",
        predicate: { kind: "exists" },
      }),
    ).toEqual({
      kind: "failed",
      reason:
        'The path ["content",0,"content",1] does not resolve: segment 3 (1) is not present in an array of 1 items.',
      evidence: [point],
    });
    expect(
      evaluateProseMirrorInspection(document, {
        path: ["content", 0, "content", 0, "type"],
        completeness: "value",
        predicate: { kind: "equals", expected: "paragraph" },
      }),
    ).toEqual({
      kind: "failed",
      reason: "The observed value does not satisfy the expectation.",
      evidence: [point],
    });
  });

  it("requires a referenced observation and never looks through the prototype", () => {
    expect(
      evaluateProseMirrorInspection(
        { ...observed({}), point: null },
        {
          path: [],
          completeness: "value",
          predicate: { kind: "exists" },
        },
      ).kind,
    ).toBe("inconclusive");
    expect(
      evaluateProseMirrorInspection(observed({}), {
        path: ["toString"],
        completeness: "value",
        predicate: { kind: "exists" },
      }).kind,
    ).toBe("failed");
  });
});
