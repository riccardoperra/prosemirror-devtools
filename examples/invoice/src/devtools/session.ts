import {
  createProseMirrorDevtoolsStore,
  markProseMirrorDevtools,
  measureProseMirrorDevtools,
  type DevtoolsDiagnosticsController,
  type DevtoolsMarkerTone,
} from "prosemirror-inspector/core";
import type { Transaction } from "prosemirror-state";

export const store = createProseMirrorDevtoolsStore();
export const sessionId = "invoice";

export interface DomainEventEntry {
  readonly id: number;
  readonly at: number;
  readonly kind: "marker" | "measure";
  readonly label: string;
  readonly category: string;
  readonly tone: DevtoolsMarkerTone;
  readonly durationMs?: number;
  readonly data?: unknown;
}

const domainEventLimit = 50;
let domainEventEntries: readonly DomainEventEntry[] = [];
let nextDomainEventId = 1;
const domainEventListeners = new Set<() => void>();

/** The app's own copy of what it reports, so the Invoice panel never reads the inspector's store. */
export const domainEventLog = {
  get: (): readonly DomainEventEntry[] => domainEventEntries,
  subscribe(listener: () => void): () => void {
    domainEventListeners.add(listener);
    return () => domainEventListeners.delete(listener);
  },
};

function recordDomainEvent(entry: Omit<DomainEventEntry, "id" | "at">): void {
  const next = { ...entry, id: nextDomainEventId++, at: Date.now() };
  domainEventEntries = [...domainEventEntries.slice(1 - domainEventLimit), next];
  for (const listener of domainEventListeners) listener();
}

export function measure<T>(label: string, category: string, run: () => T): T {
  const start = performance.now();
  try {
    return measureProseMirrorDevtools(sessionId, label, run, { store, category });
  } finally {
    const durationMs = performance.now() - start;
    recordDomainEvent({ kind: "measure", label, category, tone: "neutral", durationMs });
  }
}

export function mark(label: string, category: string, data: unknown): void {
  markProseMirrorDevtools(sessionId, label, { store, category, data });
  recordDomainEvent({ kind: "marker", label, category, tone: "neutral", data });
}

export interface DomainEvent {
  readonly label: string;
  readonly tone?: DevtoolsMarkerTone;
  readonly data?: unknown;
}

const domainEventMeta = "invoiceDomainEvent";

/** Markers only land on the dispatch being recorded, so commands tag the transaction and a plugin marks it mid-dispatch. */
export function tagDomainEvent(tr: Transaction, event: DomainEvent): Transaction {
  return tr.setMeta(domainEventMeta, event);
}

export function markDomainEvents(transactions: readonly Transaction[]): void {
  for (const tr of transactions) {
    const event = tr.getMeta(domainEventMeta) as DomainEvent | undefined;
    if (!event) continue;
    const tone = event.tone ?? "info";
    const data = event.data === undefined ? {} : { data: event.data };
    markProseMirrorDevtools(sessionId, event.label, { store, category: "invoice", tone, ...data });
    recordDomainEvent({ kind: "marker", label: event.label, category: "invoice", tone, ...data });
  }
}

const diagnosticsByEditor = new WeakMap<object, DevtoolsDiagnosticsController>();

export function registerDiagnostics(editor: object, diagnostics: DevtoolsDiagnosticsController) {
  diagnosticsByEditor.set(editor, diagnostics);
}

export function releaseDiagnostics(editor: object): void {
  diagnosticsByEditor.get(editor)?.dispose();
  diagnosticsByEditor.delete(editor);
}

export function traceCommand<T>(editor: object, name: string, run: () => T): T {
  const diagnostics = diagnosticsByEditor.get(editor);
  return diagnostics ? diagnostics.traceCommand(name, run) : run();
}
