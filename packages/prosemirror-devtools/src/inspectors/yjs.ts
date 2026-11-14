import type { PluginKey, Transaction as ProseMirrorTransaction } from "prosemirror-state";
import type { Doc, Transaction, UndoManager } from "yjs";

import type { InspectionEvidence, ProseMirrorInspector } from "../inspection/types";
import type { TransportObserver, TransportSnapshot } from "./transport";

export interface YjsInspectorOptions {
  readonly document: Doc;
  readonly getUndoManager?: () => UndoManager | undefined;
  readonly transport?: TransportObserver;
  readonly describeOrigin?: (origin: unknown) => string;
  /**
   * The binding's sync plugin key, such as `ySyncPluginKey` from y-prosemirror or
   * @tiptap/y-tiptap. It must be the instance the installed sync plugin uses.
   */
  readonly syncPluginKey?: PluginKey;
}

/**
 * Where the binding says a ProseMirror transaction came from, read from its y-sync metadata.
 * `remote-yjs` and `yjs-local-transaction` also read the Y.Doc transaction being observed.
 */
export type YjsDispatchOrigin =
  /** No y-sync change metadata. The binding writes this editor change to the Y.Doc. */
  | { readonly kind: "local" }
  /** The binding applied a Y.Doc transaction from another client or a provider. */
  | { readonly kind: "remote-yjs" }
  /** The binding applied this client's Y.UndoManager undo or redo. */
  | { readonly kind: "yjs-undo-redo" }
  /** The binding applied a local Y.Doc transaction from another writer on this client. */
  | { readonly kind: "yjs-local-transaction" }
  /** The binding re-rendered the whole Y.Doc, as in the initial sync or a snapshot render. */
  | { readonly kind: "yjs-render" }
  /** The binding requested or cleared a snapshot view. */
  | { readonly kind: "yjs-snapshot" };

export interface YjsDispatchOrigins {
  readonly root: YjsDispatchOrigin;
  readonly applied: readonly YjsDispatchOrigin[] | null;
}

interface YjsTransactionInspection {
  readonly sequence: number;
  readonly local: boolean;
  readonly origin: InspectionEvidence<string | number | boolean | null>;
}

export interface YjsInspection {
  readonly binding: "yjs";
  readonly clientId: number;
  readonly documentGuid: string;
  readonly sampledAt: number;
  readonly sample: "query" | "prosemirror-dispatch";
  readonly dispatchOrigin: InspectionEvidence<YjsDispatchOrigins>;
  readonly latestTransaction: YjsTransactionInspection | null;
  readonly latestUpdate: {
    readonly sequence: number;
    readonly bytes: number;
    readonly local: boolean;
  } | null;
  readonly undo: InspectionEvidence<{ readonly undoDepth: number; readonly redoDepth: number }>;
  readonly transport: TransportSnapshot | { readonly kind: "unobserved"; readonly reason: string };
  readonly scope: "independent-document-and-provider-signals";
}

export interface YjsInspector extends ProseMirrorInspector<YjsInspection> {
  dispose(): void;
}

/** Observes the actual Y.Doc. The application disposes this observer with its editor/provider. */
export function createYjsInspector({
  document,
  getUndoManager,
  transport,
  describeOrigin,
  syncPluginKey,
}: YjsInspectorOptions): YjsInspector {
  let lifecycle: "active" | "disposed" | "document-destroyed" = document.isDestroyed
    ? "document-destroyed"
    : "active";
  let latestTransaction: YjsTransactionInspection | null = null;
  let latestUpdate: YjsInspection["latestUpdate"] = null;
  let transactionSequence = 0;
  let observedTransaction: Transaction | null = null;
  let updateSequence = 0;
  const originEvidence = (origin: unknown): YjsTransactionInspection["origin"] => {
    try {
      if (describeOrigin) return { kind: "available", value: describeOrigin(origin) };
      if (
        origin === null ||
        typeof origin === "string" ||
        typeof origin === "number" ||
        typeof origin === "boolean"
      )
        return { kind: "available", value: origin };
      return {
        kind: "unobserved",
        reason:
          "This Yjs origin is an object or function. Supply describeOrigin when its identity is known.",
      };
    } catch {
      return { kind: "error", reason: "The application Yjs origin description failed." };
    }
  };
  // y-prosemirror dispatches a Y.Doc change from its observeDeep handler, which runs between
  // beforeObserverCalls and afterTransaction of the Y.Doc transaction it applies.
  const classify = (key: PluginKey, transaction: ProseMirrorTransaction): YjsDispatchOrigin => {
    const meta: unknown = transaction.getMeta(key);
    if (typeof meta !== "object" || meta === null) return { kind: "local" };
    if (!("isChangeOrigin" in meta) || meta.isChangeOrigin !== true)
      return "snapshot" in meta || "prevSnapshot" in meta
        ? { kind: "yjs-snapshot" }
        : { kind: "local" };
    if ("binding" in meta) return { kind: "yjs-render" };
    if ("isUndoRedoOperation" in meta && meta.isUndoRedoOperation === true)
      return { kind: "yjs-undo-redo" };
    if (observedTransaction === null) return { kind: "yjs-render" };
    return { kind: observedTransaction.local ? "yjs-local-transaction" : "remote-yjs" };
  };
  const beforeObserverCalls = (transaction: Transaction): void => {
    observedTransaction = transaction;
  };
  const afterTransaction = (transaction: Transaction): void => {
    observedTransaction = null;
    latestTransaction = {
      sequence: ++transactionSequence,
      local: transaction.local,
      origin: originEvidence(transaction.origin),
    };
  };
  const update = (
    bytes: Uint8Array,
    _origin: unknown,
    _document: Doc,
    transaction: Transaction,
  ): void => {
    latestUpdate = {
      sequence: ++updateSequence,
      bytes: bytes.byteLength,
      local: transaction.local,
    };
  };
  const removeListeners = (): void => {
    document.off("beforeObserverCalls", beforeObserverCalls);
    document.off("afterTransaction", afterTransaction);
    document.off("update", update);
    document.off("destroy", destroyed);
  };
  const destroyed = (): void => {
    lifecycle = "document-destroyed";
    removeListeners();
  };
  if (lifecycle === "active") {
    document.on("beforeObserverCalls", beforeObserverCalls);
    document.on("afterTransaction", afterTransaction);
    document.on("update", update);
    document.on("destroy", destroyed);
  }
  const inspect = (
    sample: YjsInspection["sample"],
    dispatchOrigin: YjsInspection["dispatchOrigin"],
  ): InspectionEvidence<YjsInspection> => {
    if (lifecycle === "disposed")
      return { kind: "disabled", reason: "The Yjs observer was disposed." };
    if (lifecycle === "document-destroyed")
      return { kind: "unsupported", reason: "The Yjs document was destroyed." };
    const undoManager = getUndoManager?.();
    return {
      kind: "available",
      value: {
        binding: "yjs",
        clientId: document.clientID,
        documentGuid: document.guid,
        sampledAt: Date.now(),
        sample,
        dispatchOrigin,
        latestTransaction: latestTransaction === null ? null : structuredClone(latestTransaction),
        latestUpdate: latestUpdate === null ? null : { ...latestUpdate },
        undo: undoManager
          ? {
              kind: "available",
              value: {
                undoDepth: undoManager.undoStack.length,
                redoDepth: undoManager.redoStack.length,
              },
            }
          : {
              kind: "unobserved",
              reason:
                "No Yjs UndoManager was supplied. prosemirror-history is a different history system.",
            },
        transport: transport?.getSnapshot() ?? {
          kind: "unobserved",
          reason: "No application Yjs provider signals were supplied.",
        },
        scope: "independent-document-and-provider-signals",
      },
    };
  };
  return {
    descriptor: {
      id: "yjs",
      version: "1",
      label: "Yjs collaboration",
      description:
        "Real Y.Doc transaction/update signals and optional Yjs UndoManager depths. With the binding's sync plugin key, each dispatch is classified from the binding's own metadata. Provider state is application-observed. Signal timing alone does not establish a dispatch origin.",
      prerequisites: [
        "A live Yjs 13 document used by this editor's binding",
        "The binding's sync plugin key to classify dispatch origins",
        "The binding's own UndoManager for collaborative undo",
        "Application provider observation for connection and acknowledgements",
      ],
    },
    read: () =>
      inspect("query", {
        kind: "unobserved",
        reason: "A query sample has no dispatch. Read a captured dispatch for its origin.",
      }),
    capture: ({ transaction, appliedTransactions }) =>
      inspect(
        "prosemirror-dispatch",
        syncPluginKey
          ? {
              kind: "available",
              value: {
                root: classify(syncPluginKey, transaction),
                applied:
                  appliedTransactions?.map((applied) => classify(syncPluginKey, applied)) ?? null,
              },
            }
          : {
              kind: "unobserved",
              reason:
                "Pass the binding's syncPluginKey to createYjsInspector to classify dispatch origins.",
            },
      ),
    dispose() {
      if (lifecycle !== "active") return;
      lifecycle = "disposed";
      removeListeners();
    },
  };
}
