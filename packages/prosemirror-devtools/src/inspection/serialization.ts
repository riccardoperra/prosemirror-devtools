import type { SerializedValue } from "../core/types";
import type { InspectionEvidence, InspectionLimits } from "./types";

export const defaultInspectionLimits: InspectionLimits = {
  maxItems: 100,
  maxDepth: 24,
  maxNodes: 4_000,
  maxStringLength: 16_000,
  maxBytes: 128_000,
};

export function describeInspectionError(error: unknown): string {
  try {
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  } catch {
    return "Unprintable thrown value";
  }
}

export function resolveInspectionLimits(
  requested: Partial<InspectionLimits> = {},
  maximum: InspectionLimits = defaultInspectionLimits,
): InspectionLimits {
  const limit = (value: number | undefined, fallback: number): number =>
    value === undefined || !Number.isFinite(value)
      ? fallback
      : Math.max(1, Math.min(fallback, Math.floor(value)));
  return {
    maxItems: limit(requested.maxItems, maximum.maxItems),
    maxDepth: limit(requested.maxDepth, maximum.maxDepth),
    maxNodes: limit(requested.maxNodes, maximum.maxNodes),
    maxStringLength: limit(requested.maxStringLength, maximum.maxStringLength),
    maxBytes: limit(requested.maxBytes, maximum.maxBytes),
  };
}

/** Copy JSON data without invoking application getters or toJSON methods. */
export function serializeInspectionValue(
  value: unknown,
  limits: InspectionLimits = defaultInspectionLimits,
): InspectionEvidence {
  let nodes = 0;
  let bytes = 0;
  const ancestors = new Set<object>();
  const reserve = (count: number): void => {
    bytes += count;
    if (bytes > limits.maxBytes) throw new RangeError("The serialized value exceeds maxBytes.");
  };
  const visit = (input: unknown, depth: number): SerializedValue => {
    if (++nodes > limits.maxNodes) throw new RangeError("The serialized value exceeds maxNodes.");
    if (depth > limits.maxDepth) throw new RangeError("The serialized value exceeds maxDepth.");
    if (input === null || typeof input === "boolean") {
      reserve(input === null ? 4 : input ? 4 : 5);
      return input;
    }
    if (typeof input === "number" && Number.isFinite(input)) {
      reserve(String(input).length);
      return input;
    }
    if (typeof input === "string") {
      if (input.length > limits.maxStringLength)
        throw new RangeError("The serialized value exceeds maxStringLength.");
      reserve(new TextEncoder().encode(JSON.stringify(input)).length);
      return input;
    }
    if (typeof input !== "object") throw new TypeError("The value contains non-JSON data.");
    if (ancestors.has(input)) throw new TypeError("The value contains a cycle.");
    const array = Array.isArray(input);
    if (
      !array &&
      Object.getPrototypeOf(input) !== Object.prototype &&
      Object.getPrototypeOf(input) !== null
    )
      throw new TypeError("The value contains an opaque object. Supply a semantic serializer.");
    ancestors.add(input);
    reserve(2);
    try {
      if (array) {
        const result: SerializedValue[] = [];
        if (input.length > limits.maxNodes - nodes)
          throw new RangeError("The serialized value exceeds maxNodes.");
        for (let index = 0; index < input.length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
          if (!descriptor || !("value" in descriptor))
            throw new TypeError("The value contains an accessor or sparse array.");
          if (index > 0) reserve(1);
          result.push(visit(descriptor.value, depth + 1));
        }
        return result;
      }
      const result: { [key: string]: SerializedValue } = {};
      for (const key of Object.keys(input)) {
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        if (!descriptor || !("value" in descriptor))
          throw new TypeError("The value contains an accessor.");
        if (key.length > limits.maxStringLength)
          throw new RangeError("The serialized key exceeds maxStringLength.");
        reserve(new TextEncoder().encode(JSON.stringify(key)).length + 2);
        Object.defineProperty(result, key, {
          value: visit(descriptor.value, depth + 1),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      return result;
    } finally {
      ancestors.delete(input);
    }
  };
  try {
    return { kind: "available", value: visit(value, 0) };
  } catch (error) {
    return { kind: "error", reason: describeInspectionError(error) };
  }
}

export function serializeInspectorEvidence(
  read: () => InspectionEvidence<unknown>,
  limits: InspectionLimits,
): InspectionEvidence {
  try {
    const evidence = read();
    return evidence.kind === "available"
      ? serializeInspectionValue(evidence.value, limits)
      : { kind: evidence.kind, reason: evidence.reason.slice(0, limits.maxStringLength) };
  } catch (error) {
    return { kind: "error", reason: describeInspectionError(error) };
  }
}
