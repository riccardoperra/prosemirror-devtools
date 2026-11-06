import { isSerializedValue } from "../core/snapshots";
import type {
  CaptureGap,
  CaptureProfile,
  CaptureStatus,
  InspectionCoverage,
  InspectionLimits,
  InspectionQuery,
  InspectionReadPoint,
  InspectionResult,
  InspectionSource,
  InspectionTarget,
} from "../inspection/types";
import { serializeInspectionValue } from "../inspection/serialization";
import type { ProseMirrorRecording, RecordedDispatch, RecordedPoint, RecordedQuery } from "./types";
import { RECORDING_MAX_BYTES, RECORDING_MAX_DISPATCHES } from "./types";

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function keys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function integer(value: unknown, minimum = 0): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
}

function timestamp(value: unknown): value is number {
  return integer(value) && value <= 8_640_000_000_000_000;
}

function string(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function sameTarget(left: InspectionTarget, right: InspectionTarget): boolean {
  return (
    left.sourceId === right.sourceId &&
    left.editorId === right.editorId &&
    left.sessionId === right.sessionId &&
    left.generation === right.generation
  );
}

export function samePoint(left: InspectionReadPoint, right: InspectionReadPoint): boolean {
  if (
    !sameTarget(left.target, right.target) ||
    left.revision !== right.revision ||
    left.kind !== right.kind
  )
    return false;
  return left.kind === "live" && right.kind === "live"
    ? left.stateId === right.stateId &&
        left.dispatchId === right.dispatchId &&
        left.diagnosticsVersion === right.diagnosticsVersion
    : left.kind === "transaction" &&
        right.kind === "transaction" &&
        left.transactionId === right.transactionId &&
        left.phase === right.phase;
}

function isTarget(value: unknown): value is InspectionTarget {
  return (
    object(value) &&
    keys(value, ["sourceId", "editorId", "sessionId", "generation"]) &&
    string(value.sourceId) &&
    string(value.editorId) &&
    string(value.sessionId) &&
    integer(value.generation, 1)
  );
}

function isSource(value: unknown): value is InspectionSource {
  return (
    object(value) &&
    string(value.id) &&
    ((value.kind === "live" && keys(value, ["kind", "id"])) ||
      (value.kind === "offline" &&
        string(value.recordingId) &&
        keys(value, ["kind", "id", "recordingId"])))
  );
}

function isPoint(value: unknown): value is InspectionReadPoint {
  if (!object(value) || !isTarget(value.target) || !integer(value.revision)) return false;
  if (value.kind === "live")
    return (
      keys(value, ["kind", "target", "revision", "stateId", "dispatchId", "diagnosticsVersion"]) &&
      integer(value.stateId, 1) &&
      integer(value.dispatchId) &&
      (value.diagnosticsVersion === null || integer(value.diagnosticsVersion))
    );
  return (
    value.kind === "transaction" &&
    keys(value, ["kind", "target", "revision", "transactionId", "phase"]) &&
    integer(value.transactionId, 1) &&
    (value.phase === "before" || value.phase === "after")
  );
}

function isLimits(value: unknown): value is InspectionLimits {
  return (
    object(value) &&
    keys(value, ["maxItems", "maxDepth", "maxNodes", "maxStringLength", "maxBytes"]) &&
    integer(value.maxItems, 1) &&
    integer(value.maxDepth, 1) &&
    integer(value.maxNodes, 1) &&
    integer(value.maxStringLength, 1) &&
    integer(value.maxBytes, 1)
  );
}

function isGap(value: unknown): value is CaptureGap {
  return (
    object(value) &&
    keys(value, ["reason", "firstDispatchId", "lastDispatchId", "stateBeforeId", "stateAfterId"]) &&
    (value.reason === "paused" || value.reason === "evicted" || value.reason === "cleared") &&
    integer(value.firstDispatchId, 1) &&
    integer(value.lastDispatchId, value.firstDispatchId) &&
    integer(value.stateBeforeId, 1) &&
    integer(value.stateAfterId, 1)
  );
}

function isProfile(value: unknown): value is CaptureProfile {
  if (
    !object(value) ||
    !keys(value, ["kind", "budgets"]) ||
    (value.kind !== "bounded" && value.kind !== "unbounded") ||
    !object(value.budgets)
  )
    return false;
  const budgets = value.budgets;
  return (
    keys(budgets, ["transactions", "events", "decorations", "nodeViews", "projections", "gaps"]) &&
    (budgets.transactions === null || integer(budgets.transactions, 1)) &&
    integer(budgets.events, 1) &&
    integer(budgets.decorations, 1) &&
    integer(budgets.nodeViews, 1) &&
    integer(budgets.gaps, 1) &&
    isLimits(budgets.projections)
  );
}

function isCapture(value: unknown): value is CaptureStatus {
  return (
    object(value) &&
    keys(value, ["kind", "profile", "gaps", "omittedGapCount"]) &&
    (value.kind === "recording" || value.kind === "paused") &&
    isProfile(value.profile) &&
    Array.isArray(value.gaps) &&
    value.gaps.every(isGap) &&
    integer(value.omittedGapCount)
  );
}

function isCoverage(value: unknown): value is InspectionCoverage {
  return (
    object(value) &&
    keys(value, ["complete", "gaps", "truncated", "limits", "notes"]) &&
    typeof value.complete === "boolean" &&
    Array.isArray(value.gaps) &&
    value.gaps.every(isGap) &&
    typeof value.truncated === "boolean" &&
    isLimits(value.limits) &&
    Array.isArray(value.notes) &&
    value.notes.every((note) => typeof note === "string")
  );
}

function resultBase(value: unknown): value is Record<string, unknown> & {
  target: InspectionTarget;
  point: InspectionReadPoint | null;
  coverage: InspectionCoverage;
} {
  return (
    object(value) &&
    isTarget(value.target) &&
    (value.point === null || isPoint(value.point)) &&
    isCoverage(value.coverage)
  );
}

function unavailable(value: Record<string, unknown>): boolean {
  return (
    (value.kind === "unsupported" ||
      value.kind === "disabled" ||
      value.kind === "unobserved" ||
      value.kind === "expired" ||
      value.kind === "error") &&
    string(value.reason) &&
    keys(value, ["kind", "reason", "target", "point", "coverage"])
  );
}

function isResult(value: unknown): value is InspectionResult {
  return (
    resultBase(value) &&
    (value.kind === "available"
      ? keys(value, ["kind", "value", "target", "point", "coverage"]) &&
        isSerializedValue(value.value)
      : unavailable(value))
  );
}

function isPinResult(
  value: unknown,
): value is Exclude<InspectionResult<InspectionReadPoint>, { readonly kind: "available" }> {
  return resultBase(value) && unavailable(value);
}

export function queryKey(query: InspectionQuery): string {
  switch (query.kind) {
    case "document":
      return JSON.stringify([query.kind, query.from ?? null, query.to ?? null]);
    case "transactions":
      return JSON.stringify([
        query.kind,
        query.afterId ?? null,
        query.beforeId ?? null,
        query.applicationStatus ?? null,
      ]);
    case "transaction":
      return JSON.stringify([query.kind, query.id]);
    case "contribution":
      return JSON.stringify([query.kind, query.id]);
    case "events":
      return JSON.stringify([query.kind, query.afterId ?? null, query.name ?? null]);
    default:
      return query.kind;
  }
}

function isQuery(value: unknown): value is InspectionQuery {
  if (!object(value)) return false;
  switch (value.kind) {
    case "document":
      return (
        keys(value, ["kind", "from", "to"]) &&
        (value.from === undefined || integer(value.from)) &&
        (value.to === undefined || integer(value.to))
      );
    case "transactions":
      return (
        keys(value, ["kind", "afterId", "beforeId", "applicationStatus"]) &&
        (value.afterId === undefined || integer(value.afterId)) &&
        (value.beforeId === undefined || integer(value.beforeId)) &&
        (value.applicationStatus === undefined ||
          value.applicationStatus === "applied" ||
          value.applicationStatus === "filtered" ||
          value.applicationStatus === "unknown")
      );
    case "transaction":
      return keys(value, ["kind", "id"]) && integer(value.id, 1);
    case "contribution":
      return keys(value, ["kind", "id"]) && string(value.id);
    case "events":
      return (
        keys(value, ["kind", "afterId", "name"]) &&
        (value.afterId === undefined || integer(value.afterId)) &&
        (value.name === undefined || typeof value.name === "string")
      );
    case "selection":
    case "contributions":
    case "capabilities":
    case "decorations":
    case "nodeViews":
    case "schema":
    case "plugins":
      return keys(value, ["kind"]);
    default:
      return false;
  }
}

function isRecordedQuery(value: unknown): value is RecordedQuery {
  return (
    object(value) &&
    keys(value, ["query", "result"]) &&
    isQuery(value.query) &&
    isResult(value.result)
  );
}

function isRecordedPoint(value: unknown): value is RecordedPoint {
  if (
    !object(value) ||
    !keys(value, ["point", "queries"]) ||
    !isPoint(value.point) ||
    !Array.isArray(value.queries) ||
    !value.queries.every(isRecordedQuery) ||
    value.queries.length > 40
  )
    return false;
  const point = value.point;
  const seen = new Set<string>();
  return value.queries.every(({ query, result }) => {
    const key = queryKey(query);
    if (
      seen.has(key) ||
      !sameTarget(result.target, point.target) ||
      result.point === null ||
      !samePoint(result.point, point)
    )
      return false;
    seen.add(key);
    return (
      query.kind !== "transaction" ||
      point.kind !== "transaction" ||
      query.id <= point.transactionId
    );
  });
}

function isDispatch(value: unknown): value is RecordedDispatch {
  if (!object(value) || !integer(value.id, 1)) return false;
  if (value.kind === "unavailable")
    return keys(value, ["kind", "id", "result"]) && isPinResult(value.result);
  return (
    value.kind === "available" &&
    keys(value, ["kind", "id", "before", "after"]) &&
    isRecordedPoint(value.before) &&
    isRecordedPoint(value.after) &&
    value.before.point.kind === "transaction" &&
    value.after.point.kind === "transaction" &&
    value.before.point.transactionId === value.id &&
    value.after.point.transactionId === value.id &&
    value.before.point.phase === "before" &&
    value.after.point.phase === "after" &&
    value.before.point.revision === value.after.point.revision &&
    sameTarget(value.before.point.target, value.after.point.target)
  );
}

function isRecording(value: unknown): value is ProseMirrorRecording {
  if (
    !object(value) ||
    !keys(value, [
      "format",
      "version",
      "id",
      "createdAt",
      "versions",
      "origin",
      "editor",
      "limits",
      "current",
      "dispatches",
      "omissions",
    ]) ||
    value.format !== "prosemirror-inspector-recording" ||
    value.version !== 1 ||
    !string(value.id) ||
    !timestamp(value.createdAt) ||
    !object(value.versions) ||
    !Object.values(value.versions).every((version) => typeof version === "string")
  )
    return false;
  if (
    !object(value.origin) ||
    !keys(value.origin, ["source", "target"]) ||
    !isSource(value.origin.source) ||
    !isTarget(value.origin.target) ||
    value.origin.source.id !== value.origin.target.sourceId
  )
    return false;
  if (
    !object(value.editor) ||
    !keys(value.editor, ["label", "registeredAt", "capture"]) ||
    !string(value.editor.label) ||
    !timestamp(value.editor.registeredAt) ||
    !isCapture(value.editor.capture)
  )
    return false;
  if (
    !object(value.limits) ||
    !keys(value.limits, ["maxBytes", "maxDispatches", "query"]) ||
    !integer(value.limits.maxBytes, 1) ||
    value.limits.maxBytes > RECORDING_MAX_BYTES ||
    !integer(value.limits.maxDispatches, 1) ||
    value.limits.maxDispatches > RECORDING_MAX_DISPATCHES ||
    !isLimits(value.limits.query)
  )
    return false;
  if (
    !isRecordedPoint(value.current) ||
    !sameTarget(value.current.point.target, value.origin.target) ||
    !Array.isArray(value.dispatches) ||
    value.dispatches.length > value.limits.maxDispatches ||
    !value.dispatches.every(isDispatch)
  )
    return false;
  const target = value.origin.target;
  const lastId =
    value.current.point.kind === "live"
      ? value.current.point.dispatchId
      : value.current.point.transactionId;
  const ids = new Set<number>();
  for (const dispatch of value.dispatches) {
    if (ids.has(dispatch.id) || dispatch.id > lastId) return false;
    ids.add(dispatch.id);
    if (
      dispatch.kind === "available"
        ? !sameTarget(dispatch.before.point.target, target) ||
          !sameTarget(dispatch.after.point.target, target)
        : !sameTarget(dispatch.result.target, target) ||
          (dispatch.result.point !== null && !sameTarget(dispatch.result.point.target, target))
    )
      return false;
    if (
      dispatch.kind === "available" &&
      dispatch.after.point.revision > value.current.point.revision
    )
      return false;
    if (
      dispatch.kind === "unavailable" &&
      dispatch.result.point !== null &&
      (dispatch.result.point.kind !== "transaction" ||
        dispatch.result.point.transactionId !== dispatch.id)
    )
      return false;
  }
  return (
    Array.isArray(value.omissions) &&
    value.omissions.length <= 200 &&
    value.omissions.every(
      (entry) =>
        object(entry) &&
        keys(entry, ["scope", "reason"]) &&
        string(entry.scope) &&
        string(entry.reason),
    )
  );
}

function freeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  for (const entry of Object.values(value)) freeze(entry);
  Object.freeze(value);
}

/** Validates a JSON string or plain JSON object. Getters, opaque objects, and mixed target/point results are rejected. */
export function parseProseMirrorRecording(input: unknown): ProseMirrorRecording {
  let parsed: unknown = input;
  if (typeof input === "string") {
    if (new TextEncoder().encode(input).length > RECORDING_MAX_BYTES)
      throw new Error("Recording exceeds the 2 MB import limit.");
    parsed = JSON.parse(input);
  }
  const serialized = serializeInspectionValue(parsed, {
    maxBytes: RECORDING_MAX_BYTES,
    maxDepth: 64,
    maxNodes: 200_000,
    maxItems: 10_000,
    maxStringLength: 128_000,
  });
  if (serialized.kind !== "available")
    throw new Error(`Invalid recording data: ${serialized.reason}`);
  if (!isRecording(serialized.value))
    throw new Error("Invalid recording format, version, scope, or target/read-point relationship.");
  const size = new TextEncoder().encode(JSON.stringify(serialized.value)).length;
  if (size > serialized.value.limits.maxBytes)
    throw new Error("Recording exceeds its declared total byte limit.");
  freeze(serialized.value);
  return serialized.value;
}
