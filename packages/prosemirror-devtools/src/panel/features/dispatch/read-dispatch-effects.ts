import type { TransactionRecord } from "../../../core/types";

interface DispatchEffect {
  readonly label: string;
  readonly text: string;
  readonly note?: string;
  readonly badge?: string;
  readonly listLabel?: string;
}

function field(value: unknown, key: string): unknown {
  return value && typeof value === "object" && !Array.isArray(value) && key in value
    ? Reflect.get(value, key)
    : undefined;
}

function count(value: unknown, key: string): number | undefined {
  const number = field(value, key);
  return typeof number === "number" && Number.isSafeInteger(number) && number >= 0
    ? number
    : undefined;
}

function transition(
  label: string,
  before: unknown,
  after: unknown,
  key: string,
): string | undefined {
  const start = count(before, key);
  const end = count(after, key);
  return start === undefined || end === undefined ? undefined : `${label} ${start} → ${end}`;
}

function undoEffect(sample: unknown, record: TransactionRecord): DispatchEffect | undefined {
  if (field(sample, "kind") !== "dispatch") return;
  const before = field(sample, "before");
  const after = field(sample, "after");
  const undo = transition("Undo", before, after, "undoDepth");
  const redo = transition("Redo", before, after, "redoDepth");
  if (undo === undefined || redo === undefined) return;
  const root = field(sample, "root");
  const text = `${undo} · ${redo}`;
  if (
    !record.docChanged &&
    count(before, "undoDepth") === count(after, "undoDepth") &&
    count(before, "redoDepth") === count(after, "redoDepth")
  )
    return;
  if (field(root, "addToHistory") === "excluded") {
    return {
      label: "Undo effect",
      text,
      note: "The root transaction set addToHistory to false.",
      badge: "History",
      listLabel: "Excluded from undo",
    };
  }
  if (field(root, "historyTransaction") === true) {
    return {
      label: "Undo effect",
      text,
      note: "History marked the root transaction as undo or redo.",
      badge: "History",
      listLabel: "Undo or redo",
    };
  }
  return { label: "Undo effect", text };
}

function transportNote(sample: unknown): string {
  const transport = field(sample, "transport");
  if (field(transport, "kind") !== "application-observed") return "Transport was not observed.";
  const signal = field(field(transport, "latest"), "signal");
  const kind = field(signal, "kind");
  const message = field(signal, "messageId");
  if (kind === "connection") return "Last transport signal was a connection change.";
  const stage =
    kind === "send"
      ? "Sent"
      : kind === "receive"
        ? "Received"
        : kind === "acknowledge"
          ? "Acknowledged"
          : kind === "error"
            ? "Transport error"
            : undefined;
  if (stage === undefined) return "No delivery signal was available at capture.";
  const link = field(signal, "dispatch");
  const linked = field(link, "kind") === "observed" ? count(link, "dispatchId") : undefined;
  const identity =
    linked === undefined
      ? "The transport sample has no dispatch ID."
      : `The app linked this signal to dispatch #${linked}.`;
  return `Last transport signal: ${stage}${typeof message === "string" ? ` ${message}` : ""}. ${identity}`;
}

function collabEffect(sample: unknown, record: TransactionRecord): DispatchEffect | undefined {
  if (field(sample, "kind") !== "dispatch") return;
  const before = field(sample, "before");
  const after = field(sample, "state");
  const pendingBefore = count(before, "unconfirmedSteps");
  const pendingAfter = count(after, "unconfirmedSteps");
  const versionBefore = count(before, "version");
  const versionAfter = count(after, "version");
  if (
    pendingBefore === undefined ||
    pendingAfter === undefined ||
    versionBefore === undefined ||
    versionAfter === undefined
  )
    return;
  let listLabel: string | undefined;
  if (pendingAfter > pendingBefore) listLabel = "Local steps queued";
  else if (pendingAfter < pendingBefore)
    listLabel = pendingAfter === 0 ? "Pending steps cleared" : "Fewer pending steps";
  else if (versionAfter > versionBefore) listLabel = "Confirmed version advanced";
  if (!listLabel && !record.docChanged) return;
  return {
    label: listLabel ?? "Sync state at dispatch",
    badge: "Collab",
    ...(listLabel ? { listLabel } : {}),
    text: `Pending steps ${pendingBefore} → ${pendingAfter} · Confirmed version ${versionBefore} → ${versionAfter}`,
    note: transportNote(sample),
  };
}

function yjsEffect(sample: unknown, record: TransactionRecord): DispatchEffect | undefined {
  if (field(sample, "sample") !== "prosemirror-dispatch" || !record.docChanged) return;
  const update = field(sample, "latestUpdate");
  const direction = field(update, "local");
  const sequence = count(update, "sequence");
  const latest =
    typeof direction === "boolean" && sequence !== undefined
      ? `Last update observed at capture: ${direction ? "local" : "remote"} #${sequence}.`
      : "No Yjs update had been observed at capture.";
  return {
    badge: "Yjs sample",
    label: "Document changed",
    text: latest,
    note: `Yjs updates are sampled independently. ${transportNote(sample)}`,
  };
}

const presenters = new Map([
  ["prosemirror-history@1", undoEffect],
  ["prosemirror-collab@1", collabEffect],
  ["yjs@1", yjsEffect],
]);

export function readDispatchEffects(record: TransactionRecord) {
  return (record.inspection?.projections ?? []).flatMap((projection) => {
    if (projection.evidence.kind !== "available") return [];
    const effect = presenters.get(`${projection.id}@${projection.version}`)?.(
      projection.evidence.value,
      record,
    );
    return effect ? [{ effect, projection }] : [];
  });
}
