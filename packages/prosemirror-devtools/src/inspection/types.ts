import type { EditorState, Transaction } from "prosemirror-state";

import type { DevtoolsStore, SerializedValue, TransactionRecord } from "../core/types";

export type InspectionSource =
  | { readonly kind: "live"; readonly id: string }
  | { readonly kind: "offline"; readonly id: string; readonly recordingId: string };

export interface InspectionTarget {
  readonly sourceId: string;
  readonly editorId: string;
  readonly sessionId: string;
  readonly generation: number;
}

export type InspectionReadPoint =
  | {
      readonly kind: "live";
      readonly target: InspectionTarget;
      readonly revision: number;
      readonly stateId: number;
      readonly dispatchId: number;
      readonly diagnosticsVersion: number | null;
    }
  | {
      readonly kind: "transaction";
      readonly target: InspectionTarget;
      readonly revision: number;
      readonly transactionId: number;
      readonly phase: "before" | "after";
    };

export type InspectionEvidence<T = SerializedValue> =
  | { readonly kind: "available"; readonly value: T }
  | {
      readonly kind: "unsupported" | "disabled" | "unobserved" | "expired" | "error";
      readonly reason: string;
    };

export interface InspectionLimits {
  readonly maxItems: number;
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly maxStringLength: number;
  readonly maxBytes: number;
}

export interface CaptureGap {
  readonly reason: "paused" | "evicted" | "cleared";
  readonly firstDispatchId: number;
  readonly lastDispatchId: number;
  readonly stateBeforeId: number;
  readonly stateAfterId: number;
}

export interface InspectionCoverage {
  readonly complete: boolean;
  readonly gaps: readonly CaptureGap[];
  readonly truncated: boolean;
  readonly limits: InspectionLimits;
  readonly notes: readonly string[];
}

export type InspectionResult<T = SerializedValue> = InspectionEvidence<T> & {
  readonly target: InspectionTarget;
  readonly point: InspectionReadPoint | null;
  readonly coverage: InspectionCoverage;
};

export interface InspectorDescriptor {
  readonly id: string;
  readonly version: string;
  readonly label: string;
  readonly description: string;
  readonly prerequisites: readonly string[];
}

export interface InspectorReadContext {
  readonly state: EditorState;
  readonly target: InspectionTarget;
  readonly point: InspectionReadPoint;
}

export interface InspectorCaptureContext {
  readonly beforeState: EditorState;
  readonly stateAfter: EditorState;
  readonly transaction: Transaction;
  readonly appliedTransactions: readonly Transaction[] | undefined;
  readonly dispatchId: number;
  readonly applicationStatus: TransactionRecord["applicationStatus"];
  readonly target: InspectionTarget;
  readonly beforeProjection?: InspectionEvidence;
}

/** Providers run without a panel. Only their bounded serialized projections enter history. */
export interface ProseMirrorInspector<T = unknown> {
  readonly descriptor: InspectorDescriptor;
  read(context: InspectorReadContext): InspectionEvidence<T>;
  captureBefore?(context: {
    readonly state: EditorState;
    readonly transaction: Transaction;
    readonly target: InspectionTarget;
  }): InspectionEvidence<unknown>;
  capture?(context: InspectorCaptureContext): InspectionEvidence<T>;
}

export interface InspectorProjection {
  readonly id: string;
  readonly version: string;
  readonly evidence: InspectionEvidence;
}

export interface CaptureBudgets {
  readonly transactions: number | null;
  readonly events: number;
  readonly decorations: number;
  readonly nodeViews: number;
  readonly projections: InspectionLimits;
  readonly gaps: number;
}

export interface CaptureProfile {
  readonly kind: "unbounded" | "bounded";
  readonly budgets: CaptureBudgets;
}

export interface CaptureStatus {
  readonly kind: "recording" | "paused";
  readonly profile: CaptureProfile;
  readonly gaps: readonly CaptureGap[];
  readonly omittedGapCount: number;
}

export type InspectionQuery =
  | { readonly kind: "document"; readonly from?: number; readonly to?: number }
  | { readonly kind: "selection" }
  | {
      readonly kind: "transactions";
      readonly afterId?: number;
      readonly beforeId?: number;
      readonly applicationStatus?: TransactionRecord["applicationStatus"];
    }
  | { readonly kind: "transaction"; readonly id: number }
  | { readonly kind: "contributions" }
  | { readonly kind: "contribution"; readonly id: string }
  | { readonly kind: "capabilities" }
  | { readonly kind: "events"; readonly afterId?: number; readonly name?: string }
  | { readonly kind: "decorations" }
  | { readonly kind: "nodeViews" }
  | { readonly kind: "schema" }
  | { readonly kind: "plugins" };

export interface InspectionCapability extends InspectorDescriptor {
  readonly queries: readonly InspectionQuery["kind"][];
  readonly evidence: InspectionEvidence<true>;
}

export interface InspectionEditor {
  readonly target: InspectionTarget;
  readonly label: string;
  readonly registeredAt: number;
  readonly capture: CaptureStatus;
  readonly capabilities: readonly InspectionCapability[];
}

export interface InspectionCatalog {
  readonly version: 1;
  readonly source: InspectionSource;
  readonly queries: readonly {
    readonly kind: InspectionQuery["kind"];
    readonly description: string;
    readonly prerequisites: readonly string[];
  }[];
}

export type InspectionAt =
  | { readonly kind: "current" }
  | { readonly kind: "transaction"; readonly id: number; readonly phase?: "before" | "after" };

export interface InspectionPinRequest {
  readonly target: InspectionTarget;
  readonly at?: InspectionAt;
}

export interface InspectionReadRequest {
  readonly point: InspectionReadPoint;
  readonly query: InspectionQuery;
  readonly limits?: Partial<InspectionLimits>;
}

export interface InspectionQueryRequest extends InspectionPinRequest {
  readonly query: InspectionQuery;
  readonly limits?: Partial<InspectionLimits>;
}

export interface ProseMirrorInspectionClient {
  readonly source: InspectionSource;
  catalog(): InspectionCatalog;
  listEditors(): readonly InspectionEditor[];
  pin(request: InspectionPinRequest): InspectionResult<InspectionReadPoint>;
  read(request: InspectionReadRequest): InspectionResult;
  query(request: InspectionQueryRequest): InspectionResult;
  subscribe(request: { readonly target: InspectionTarget }, listener: () => void): () => void;
}

export interface CreateProseMirrorInspectionClientOptions {
  readonly store?: DevtoolsStore;
}

export type ScenarioWait =
  | { readonly kind: "dispatch"; readonly afterId: number }
  | { readonly kind: "provider"; readonly inspectorId: string; readonly signal: string }
  | { readonly kind: "manual"; readonly description: string };

export interface InspectionScenario {
  readonly id: string;
  readonly version: string;
  readonly description: string;
  readonly prerequisites: readonly string[];
  readonly initialState: string;
  readonly actions: readonly {
    readonly id: string;
    readonly description: string;
    readonly wait: ScenarioWait;
  }[];
  readonly expectations: readonly {
    readonly id: string;
    readonly description: string;
    readonly requiredEvidence: readonly InspectionQuery["kind"][];
  }[];
}

export type InspectionVerdict =
  | { readonly kind: "passed"; readonly evidence: readonly InspectionReadPoint[] }
  | {
      readonly kind: "failed";
      readonly reason: string;
      readonly evidence: readonly InspectionReadPoint[];
    }
  | { readonly kind: "inconclusive"; readonly reason: string; readonly missing: readonly string[] };

export interface InspectionScenarioRun {
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly target: InspectionTarget;
  readonly versions: Readonly<Record<string, string>>;
  readonly actions: readonly {
    readonly id: string;
    readonly performedAt: number;
    readonly method: "browser" | "api" | "manual";
  }[];
  readonly checks: readonly { readonly id: string; readonly verdict: InspectionVerdict }[];
}
