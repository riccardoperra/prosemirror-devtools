import { inspectionQueryCatalog } from "../inspection/catalog";
import { resolveInspectionLimits, serializeInspectionValue } from "../inspection/serialization";
import type {
  InspectionCapability,
  InspectionCoverage,
  InspectionEvidence,
  InspectionLimits,
  InspectionReadPoint,
  InspectionResult,
  InspectionTarget,
  ProseMirrorInspectionClient,
} from "../inspection/types";
import { parseProseMirrorRecording, queryKey, samePoint, sameTarget } from "./validation";
import type { ProseMirrorRecording, RecordedPoint } from "./types";

/** Creates a new static offline source. It cannot attach, dispatch, restore, or resolve a live DOM. */
export function createProseMirrorRecordingClient(
  input: ProseMirrorRecording,
): ProseMirrorInspectionClient {
  const recording = parseProseMirrorRecording(input);
  const namespace =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const source = {
    kind: "offline",
    id: `recording:${namespace}`,
    recordingId: recording.id,
  } satisfies ProseMirrorInspectionClient["source"];
  const target: InspectionTarget = {
    sourceId: source.id,
    editorId: recording.origin.target.editorId,
    sessionId: `offline:${namespace}`,
    generation: 1,
  };
  const rewrite = (point: InspectionReadPoint): InspectionReadPoint => ({ ...point, target });
  const currentPoint = rewrite(recording.current.point);
  const points: readonly RecordedPoint[] = [
    recording.current,
    ...recording.dispatches.flatMap((dispatch) =>
      dispatch.kind === "available" ? [dispatch.before, dispatch.after] : [],
    ),
  ];
  const coverage = (limits: InspectionLimits): InspectionCoverage => ({
    complete: false,
    gaps: recording.editor.capture.gaps.slice(-limits.maxItems),
    truncated: recording.editor.capture.gaps.length > limits.maxItems,
    limits,
    notes: [
      "Offline recording. Only explicitly captured query scopes are available.",
      ...recording.omissions.slice(0, 10).map((entry) => `${entry.scope}: ${entry.reason}`),
    ],
  });
  const response = <T>(
    point: InspectionReadPoint | null,
    evidence: InspectionEvidence<T>,
    limits: InspectionLimits,
    responseTarget = point?.target ?? target,
  ): InspectionResult<T> => ({
    ...evidence,
    target: responseTarget,
    point,
    coverage: coverage(limits),
  });
  const defaults = resolveInspectionLimits();
  const capabilities: readonly InspectionCapability[] = inspectionQueryCatalog.map((query) => ({
    id: query.kind,
    version: "1",
    label: query.kind,
    description: query.description,
    prerequisites: query.prerequisites,
    queries: [query.kind],
    evidence: points.some((point) => point.queries.some((entry) => entry.query.kind === query.kind))
      ? { kind: "available", value: true }
      : { kind: "unobserved", reason: "This query scope was not included in the recording." },
  }));
  const pin: ProseMirrorInspectionClient["pin"] = (request) => {
    if (!sameTarget(request.target, target))
      return response(
        null,
        {
          kind: "unsupported",
          reason: "This target does not belong to this offline recording source.",
        },
        defaults,
        request.target,
      );
    const at = request.at;
    if (at?.kind !== "transaction")
      return response(currentPoint, { kind: "available", value: currentPoint }, defaults);
    const dispatch = recording.dispatches.find(({ id }) => id === at.id);
    if (!dispatch)
      return response(
        null,
        { kind: "unobserved", reason: "This dispatch ID was not included in the recording." },
        defaults,
      );
    if (dispatch.kind === "unavailable")
      return response(
        dispatch.result.point ? rewrite(dispatch.result.point) : null,
        { kind: dispatch.result.kind, reason: dispatch.result.reason },
        defaults,
      );
    const point = rewrite(at.phase === "before" ? dispatch.before.point : dispatch.after.point);
    return response(point, { kind: "available", value: point }, defaults);
  };
  const read: ProseMirrorInspectionClient["read"] = (request) => {
    const limits = resolveInspectionLimits(request.limits);
    if (!sameTarget(request.point.target, target))
      return response(
        request.point,
        {
          kind: "unsupported",
          reason: "This target does not belong to this offline recording source.",
        },
        limits,
      );
    const capturedPoint = points.find((point) => samePoint(rewrite(point.point), request.point));
    if (!capturedPoint)
      return response(
        request.point,
        { kind: "unobserved", reason: "This read point was not included in the recording." },
        limits,
      );
    const captured = capturedPoint.queries.find(
      (entry) => queryKey(entry.query) === queryKey(request.query),
    );
    if (!captured)
      return response(
        request.point,
        {
          kind: "unobserved",
          reason: "This query and its exact parameters were not included at this recording point.",
        },
        limits,
      );
    const result = captured.result;
    const truncated =
      result.kind === "available" &&
      Array.isArray(result.value) &&
      result.value.length > limits.maxItems;
    const value =
      result.kind === "available" && Array.isArray(result.value)
        ? result.value.slice(0, limits.maxItems)
        : result.kind === "available"
          ? result.value
          : null;
    const evidence =
      result.kind === "available"
        ? serializeInspectionValue(value, limits)
        : { kind: result.kind, reason: result.reason };
    return {
      ...evidence,
      target,
      point: request.point,
      coverage: {
        ...result.coverage,
        limits,
        complete: result.coverage.complete && evidence.kind === "available" && !truncated,
        truncated: result.coverage.truncated || truncated,
        notes: [
          ...result.coverage.notes,
          "Offline evidence from a captured query. It does not attest to an action in the current browser.",
        ],
      },
    };
  };
  return {
    source,
    catalog: () => ({ version: 1, source, queries: inspectionQueryCatalog }),
    listEditors: () => [
      {
        target,
        label: recording.editor.label,
        registeredAt: recording.createdAt,
        capture: { ...recording.editor.capture, kind: "paused" },
        capabilities,
      },
    ],
    pin,
    read,
    query(request) {
      const pinned = pin(request);
      return pinned.kind === "available"
        ? read({
            point: pinned.value,
            query: request.query,
            ...(request.limits ? { limits: request.limits } : {}),
          })
        : pinned;
    },
    subscribe: () => () => {},
  };
}
