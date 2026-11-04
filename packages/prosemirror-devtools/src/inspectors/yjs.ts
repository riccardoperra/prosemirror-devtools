import type { Doc, Transaction, UndoManager } from "yjs";

import type { InspectionEvidence, ProseMirrorInspector } from "../inspection/types";
import type { TransportObserver, TransportSnapshot } from "./transport";

export interface YjsInspectorOptions {
  readonly document: Doc;
  readonly getUndoManager?: () => UndoManager | undefined;
  readonly transport?: TransportObserver;
  readonly describeOrigin?: (origin: unknown) => string;
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
}: YjsInspectorOptions): YjsInspector {
  let lifecycle: "active" | "disposed" | "document-destroyed" = document.isDestroyed
    ? "document-destroyed"
    : "active";
  let latestTransaction: YjsTransactionInspection | null = null;
  let latestUpdate: YjsInspection["latestUpdate"] = null;
  let transactionSequence = 0;
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
  const afterTransaction = (transaction: Transaction): void => {
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
    document.off("afterTransaction", afterTransaction);
    document.off("update", update);
    document.off("destroy", destroyed);
  };
  const destroyed = (): void => {
    lifecycle = "document-destroyed";
    removeListeners();
  };
  if (lifecycle === "active") {
    document.on("afterTransaction", afterTransaction);
    document.on("update", update);
    document.on("destroy", destroyed);
  }
  const inspect = (sample: YjsInspection["sample"]): InspectionEvidence<YjsInspection> => {
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
        "Real Y.Doc transaction/update signals and optional Yjs UndoManager depths. Provider state is application-observed. Signal timing does not establish a ProseMirror dispatch origin.",
      prerequisites: [
        "A live Yjs 13 document used by this editor's binding",
        "The binding's own UndoManager for collaborative undo",
        "Application provider observation for connection and acknowledgements",
      ],
    },
    read: () => inspect("query"),
    capture: () => inspect("prosemirror-dispatch"),
    dispose() {
      if (lifecycle !== "active") return;
      lifecycle = "disposed";
      removeListeners();
    },
  };
}
