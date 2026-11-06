import { resolveInspectionLimits } from "../inspection/serialization";
import type { InspectionQuery, InspectionReadPoint } from "../inspection/types";
import { parseProseMirrorRecording, samePoint, sameTarget } from "./validation";
import type {
  ExportProseMirrorRecordingOptions,
  ProseMirrorRecording,
  RecordedDispatch,
  RecordedQuery,
} from "./types";
import { RECORDING_MAX_BYTES, RECORDING_MAX_DISPATCHES } from "./types";

const currentQueries: readonly InspectionQuery[] = [
  { kind: "document" },
  { kind: "selection" },
  { kind: "contributions" },
  { kind: "schema" },
  { kind: "plugins" },
  { kind: "events" },
  { kind: "decorations" },
  { kind: "nodeViews" },
  { kind: "capabilities" },
  { kind: "transactions" },
];
const historicalQueries: readonly InspectionQuery[] = [
  { kind: "document" },
  { kind: "selection" },
  { kind: "contributions" },
];

function bytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/** Captures query results at pinned points. The exporter never reads a store, plugin, or EditorView. */
export function exportProseMirrorRecording(
  options: ExportProseMirrorRecordingOptions,
): ProseMirrorRecording {
  const maxBytes = options.maxBytes ?? RECORDING_MAX_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 8_000 || maxBytes > RECORDING_MAX_BYTES)
    throw new Error("Recording maxBytes must be a whole number from 8000 to 2000000.");
  const queryLimits = resolveInspectionLimits(options.queryLimits);
  const editor = options.client
    .listEditors()
    .find((editor) => sameTarget(editor.target, options.target));
  if (!editor) throw new Error("The export target is not present in this inspection source.");
  const current = options.client.pin({ target: options.target });
  if (current.kind !== "available") throw new Error(current.reason);
  if (
    !sameTarget(current.value.target, options.target) ||
    !sameTarget(current.target, options.target) ||
    current.point === null ||
    !samePoint(current.point, current.value)
  )
    throw new Error("Inspection client returned an incoherent current point.");
  const lastId =
    current.value.kind === "live" ? current.value.dispatchId : current.value.transactionId;
  const ids =
    options.transactionIds ??
    Array.from(
      { length: Math.min(lastId, RECORDING_MAX_DISPATCHES) },
      (_, index) => Math.max(1, lastId - RECORDING_MAX_DISPATCHES + 1) + index,
    );
  if (
    ids.length > RECORDING_MAX_DISPATCHES ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !Number.isSafeInteger(id) || id < 1 || id > lastId)
  )
    throw new Error("Select at most 25 unique, observed dispatch IDs within the current point.");
  const omissions: { scope: string; reason: string }[] = [
    {
      scope: "replay",
      reason:
        "This artifact contains query evidence, not executable EditorState, undo branches, provider state, DOM, or a browser action report.",
    },
    {
      scope: "history",
      reason: `Only the selected ${ids.length} dispatch IDs and bounded current query scopes are included. Unselected or expired observations are not reconstructed.`,
    },
    {
      scope: "budget",
      reason:
        "Queries and dispatches that exceed the total byte budget are omitted. A missing query is not evidence that the editor contained no data.",
    },
  ];
  const dispatches: RecordedDispatch[] = [];
  const currentQueriesCaptured: RecordedQuery[] = [];
  const envelope: ProseMirrorRecording = {
    format: "prosemirror-inspector-recording",
    version: 1,
    id:
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
    versions: options.versions ?? { inspectionProtocol: "1", recordingFormat: "1" },
    origin: { source: options.client.source, target: options.target },
    editor: {
      label: options.label ?? editor.label,
      registeredAt: editor.registeredAt,
      capture: editor.capture,
    },
    limits: { maxBytes, maxDispatches: RECORDING_MAX_DISPATCHES, query: queryLimits },
    current: { point: current.value, queries: currentQueriesCaptured },
    dispatches,
    omissions,
  };
  const omit = (scope: string, reason: string): void => {
    const entry = { scope, reason };
    if (omissions.length < 180 && bytes(envelope) + bytes(entry) + 100 <= maxBytes)
      omissions.push(entry);
  };
  const fits = (additional: unknown): boolean =>
    bytes(envelope) + bytes(additional) + 2_000 <= maxBytes;
  const capture = (
    point: InspectionReadPoint,
    queries: readonly InspectionQuery[],
    output: RecordedQuery[],
    scope: string,
  ): void => {
    for (const query of queries) {
      if (!fits({ query, result: null })) {
        omit(
          `${scope}/${query.kind}`,
          "Omitted because the total recording byte limit was reached.",
        );
        continue;
      }
      const result = options.client.read({ point, query, limits: queryLimits });
      if (
        !sameTarget(result.target, point.target) ||
        result.point === null ||
        !samePoint(result.point, point)
      )
        throw new Error("Inspection client returned a result from another target or read point.");
      const captured = { query, result };
      if (!fits(captured)) {
        omit(
          `${scope}/${query.kind}`,
          "Omitted because the total recording byte limit was reached.",
        );
        continue;
      }
      output.push(captured);
      if (result.kind !== "available")
        omit(`${scope}/${query.kind}`, `${result.kind}: ${result.reason}`);
      else if (!result.coverage.complete || result.coverage.truncated)
        omit(
          `${scope}/${query.kind}`,
          "This query has partial or truncated coverage. Its captured coverage describes the limits.",
        );
    }
  };
  capture(current.value, currentQueries, currentQueriesCaptured, "current");
  for (const id of ids) {
    if (!fits({ id })) {
      omit(`dispatch/${id}`, "Omitted because the total recording byte limit was reached.");
      continue;
    }
    const before = options.client.pin({
      target: options.target,
      at: { kind: "transaction", id, phase: "before" },
    });
    const after = options.client.pin({
      target: options.target,
      at: { kind: "transaction", id, phase: "after" },
    });
    if (before.kind !== "available" || after.kind !== "available") {
      const result = before.kind !== "available" ? before : after;
      if (result.kind === "available") continue;
      const unavailable = { kind: "unavailable", id, result } satisfies RecordedDispatch;
      if (fits(unavailable)) dispatches.push(unavailable);
      omit(`dispatch/${id}`, `${result.kind}: ${result.reason}`);
      continue;
    }
    if (
      !sameTarget(before.value.target, options.target) ||
      !sameTarget(after.value.target, options.target) ||
      before.value.kind !== "transaction" ||
      after.value.kind !== "transaction" ||
      before.value.transactionId !== id ||
      after.value.transactionId !== id ||
      before.value.phase !== "before" ||
      after.value.phase !== "after"
    )
      throw new Error("Inspection client returned an incoherent dispatch point.");
    const beforeQueries: RecordedQuery[] = [];
    const afterQueries: RecordedQuery[] = [];
    const recorded: RecordedDispatch = {
      kind: "available",
      id,
      before: { point: before.value, queries: beforeQueries },
      after: { point: after.value, queries: afterQueries },
    };
    if (!fits(recorded)) {
      omit(`dispatch/${id}`, "Omitted because the total recording byte limit was reached.");
      continue;
    }
    dispatches.push(recorded);
    capture(before.value, historicalQueries, beforeQueries, `dispatch/${id}/before`);
    capture(
      after.value,
      [...historicalQueries, { kind: "transaction", id }],
      afterQueries,
      `dispatch/${id}/after`,
    );
  }
  if (bytes(envelope) > maxBytes)
    throw new Error(
      "Recording metadata exceeds the total byte limit. Select fewer dispatches or increase the limit.",
    );
  return parseProseMirrorRecording(envelope);
}
