import { createMemo, createSignal, For, Show, type JSX } from "solid-js";

import type { TransactionRecord } from "../../../core/types";
import { JsonTree } from "../../json-tree";
import { panelStyles } from "../../styles";

interface DispatchEffect {
  readonly label: string;
  readonly text: string;
  readonly note?: string;
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
  if (field(root, "addToHistory") === "excluded") {
    return { label: "Undo effect", text, note: "The root transaction set addToHistory to false." };
  }
  if (field(root, "historyTransaction") === true) {
    return {
      label: "Undo effect",
      text,
      note: "History marked the root transaction as undo or redo.",
    };
  }
  if (
    !record.docChanged &&
    count(before, "undoDepth") === count(after, "undoDepth") &&
    count(before, "redoDepth") === count(after, "redoDepth")
  )
    return;
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
      ? "Link to this dispatch unknown."
      : `The app linked this signal to dispatch #${linked}.`;
  return `Last transport signal: ${stage}${typeof message === "string" ? ` ${message}` : ""}. ${identity}`;
}

function collabEffect(sample: unknown, record: TransactionRecord): DispatchEffect | undefined {
  if (field(sample, "kind") !== "dispatch") return;
  const before = field(sample, "before");
  const after = field(sample, "state");
  const pending = transition("Pending steps", before, after, "unconfirmedSteps");
  const version = transition("Confirmed version", before, after, "version");
  if (pending === undefined || version === undefined) return;
  if (
    !record.docChanged &&
    count(before, "unconfirmedSteps") === count(after, "unconfirmedSteps") &&
    count(before, "version") === count(after, "version")
  )
    return;
  return {
    label: "Sync effect",
    text: `${pending} · ${version}`,
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
    label: "Yjs sample",
    text: "The editor document changed.",
    note: `${latest} Yjs updates are sampled independently. ${transportNote(sample)}`,
  };
}

const summarize = new Map([
  ["prosemirror-history", undoEffect],
  ["prosemirror-collab", collabEffect],
  ["yjs", yjsEffect],
]);

export function DispatchEffects(props: {
  record: TransactionRecord;
  showRaw?: boolean;
}): JSX.Element {
  const observations = createMemo(() =>
    (props.record.inspection?.projections ?? []).flatMap((projection) => {
      if (projection.version !== "1" || projection.evidence.kind !== "available") return [];
      const effect = summarize.get(projection.id)?.(projection.evidence.value, props.record);
      return effect ? [{ effect, projection }] : [];
    }),
  );
  const [open, setOpen] = createSignal(false);
  return (
    <Show when={observations().length > 0}>
      <section aria-label="Captured dispatch effects" class={panelStyles.pmDispatchEffects}>
        <For each={observations()}>
          {({ effect }) => (
            <p>
              <strong>{effect.label}</strong> {effect.text}
              <Show when={effect.note}>{(note) => <small>{note()}</small>}</Show>
            </p>
          )}
        </For>
        <Show when={props.showRaw}>
          <details onToggle={(event) => setOpen(event.currentTarget.open)}>
            <summary>Raw effect samples</summary>
            <Show when={open()}>
              <JsonTree
                defaultExpandedDepth={1}
                value={observations().map(({ projection }) => projection)}
              />
            </Show>
          </details>
        </Show>
      </section>
    </Show>
  );
}
