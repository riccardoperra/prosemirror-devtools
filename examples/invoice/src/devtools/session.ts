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

export function measure<T>(label: string, category: string, run: () => T): T {
  return measureProseMirrorDevtools(sessionId, label, run, { store, category });
}

export function mark(label: string, category: string, data: unknown): void {
  markProseMirrorDevtools(sessionId, label, { store, category, data });
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
    markProseMirrorDevtools(sessionId, event.label, {
      store,
      category: "invoice",
      tone: event.tone ?? "info",
      ...(event.data === undefined ? {} : { data: event.data }),
    });
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
