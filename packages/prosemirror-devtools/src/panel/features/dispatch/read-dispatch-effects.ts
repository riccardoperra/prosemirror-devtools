import type {
  DevtoolsDispatchPresentation,
  DevtoolsDispatchPresentationInput,
  DevtoolsDispatchPresenter,
  DevtoolsExtension,
} from "../../../core/extensions";
import type { TransactionRecord } from "../../../core/types";

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

function undoEffect({
  value: sample,
  record,
}: DevtoolsDispatchPresentationInput): DevtoolsDispatchPresentation | undefined {
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

function collabEffect({
  value: sample,
  record,
}: DevtoolsDispatchPresentationInput): DevtoolsDispatchPresentation | undefined {
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

const yjsOrigins: Readonly<
  Record<string, Pick<DevtoolsDispatchPresentation, "badge" | "listLabel" | "text">>
> = {
  local: {
    badge: "Local · Yjs",
    text: "This editor made the change. The binding writes it to the Y.Doc.",
  },
  "remote-yjs": {
    badge: "Remote · Yjs",
    listLabel: "Update applied",
    text: "The binding applied a Y.Doc update from another client or a provider.",
  },
  "yjs-undo-redo": {
    badge: "Undo · Yjs",
    listLabel: "Undo or redo applied",
    text: "The binding applied this client's Y.UndoManager undo or redo.",
  },
  "yjs-local-transaction": {
    badge: "Y.Doc · Yjs",
    listLabel: "Local transaction applied",
    text: "The binding applied a local Y.Doc transaction from another writer on this client.",
  },
  "yjs-render": {
    badge: "Render · Yjs",
    listLabel: "Document rendered",
    text: "The binding re-rendered the whole Y.Doc into the editor.",
  },
  "yjs-snapshot": {
    badge: "Snapshot · Yjs",
    listLabel: "Snapshot view changed",
    text: "The binding requested or cleared a snapshot view.",
  },
};

function yjsEffect({
  value: sample,
  record,
}: DevtoolsDispatchPresentationInput): DevtoolsDispatchPresentation | undefined {
  if (field(sample, "sample") !== "prosemirror-dispatch") return;
  const dispatchOrigin = field(sample, "dispatchOrigin");
  const rootKind =
    field(dispatchOrigin, "kind") === "available"
      ? field(field(field(dispatchOrigin, "value"), "root"), "kind")
      : undefined;
  const origin =
    typeof rootKind === "string" && Object.hasOwn(yjsOrigins, rootKind)
      ? yjsOrigins[rootKind]
      : undefined;
  if (origin && (rootKind !== "local" || record.docChanged)) {
    return { label: "Dispatch origin", ...origin, note: transportNote(sample) };
  }
  if (!record.docChanged) return;
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

const presenterKey = (inspectorId: string, version: string): string =>
  JSON.stringify([inspectorId, version]);

const builtInPresenters = new Map([
  [presenterKey("prosemirror-history", "1"), undoEffect],
  [presenterKey("prosemirror-collab", "1"), collabEffect],
  [presenterKey("yjs", "1"), yjsEffect],
]);

export type DispatchPresenters = ReadonlyMap<string, DevtoolsDispatchPresenter>;

export function resolveDispatchPresenters(
  extensions: readonly DevtoolsExtension[],
): DispatchPresenters {
  const presenters = new Map<string, DevtoolsDispatchPresenter>();
  for (const extension of extensions) {
    for (const presenter of extension.dispatchPresenters ?? []) {
      const { inspectorId, version } = presenter;
      if (!inspectorId.trim() || !version.trim()) {
        throw new Error(
          `Extension "${extension.id}" must provide an inspector id and version for each dispatch presenter.`,
        );
      }
      const key = presenterKey(inspectorId, version);
      if (presenters.has(key)) {
        throw new Error(
          `Duplicate dispatch presenter for inspector "${inspectorId}" version "${version}".`,
        );
      }
      presenters.set(key, presenter);
    }
  }
  return presenters;
}

export function readDispatchEffects(record: TransactionRecord, presenters?: DispatchPresenters) {
  return (record.inspection?.projections ?? []).flatMap((projection) => {
    if (projection.evidence.kind !== "available") return [];
    const key = presenterKey(projection.id, projection.version);
    const custom = presenters?.get(key);
    const input = { value: projection.evidence.value, record };
    let effect: DevtoolsDispatchPresentation | undefined;
    try {
      effect = custom ? custom.present(input) : builtInPresenters.get(key)?.(input);
    } catch {
      effect = { label: "Presentation unavailable", text: projection.id };
    }
    return effect ? [{ effect, projection }] : [];
  });
}
