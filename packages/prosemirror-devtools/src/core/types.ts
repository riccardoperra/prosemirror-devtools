import type { EditorState, Plugin, Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { DevtoolsDiagnosticsController } from "./diagnostics";
import type { RecordedStepDetails } from "./transaction-changes";
import type {
  CaptureProfile,
  CaptureStatus,
  InspectionTarget,
  InspectorProjection,
  ProseMirrorInspector,
} from "../inspection/types";

export type DevtoolsTheme = "light" | "dark" | "system";

export type SerializedValue =
  | null
  | boolean
  | number
  | string
  | SerializedValue[]
  | { [key: string]: SerializedValue };

export type PluginHook =
  | "state.init"
  | "state.apply"
  | "filterTransaction"
  | "appendTransaction"
  | "view.create"
  | "view.update"
  | "view.destroy"
  | `props.${string}`
  | `nodeView.${string}`;

export interface PluginTiming {
  pluginKey: string;
  pluginLabel: string;
  hook: PluginHook;
  duration: number;
  startOffset: number;
}

export interface DispatchPhaseTiming {
  phase: "apply" | "viewUpdate" | "customDispatch";
  startOffset: number;
  duration: number;
}

export interface PluginTimingSummary {
  pluginKey: string;
  pluginLabel: string;
  hook: PluginHook;
  count: number;
  total: number;
  average: number;
  max: number;
  last: number;
}

export type DevtoolsMarkerTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface DevtoolsMarkerOptions {
  category?: string;
  tone?: DevtoolsMarkerTone;
  data?: unknown;
}

export interface DevtoolsMarker {
  label: string;
  category: string | null;
  tone: DevtoolsMarkerTone;
  startOffset: number;
  duration: number | null;
  data?: unknown;
}

export interface DevtoolsPerformanceExtensionOptions {
  /** Custom group shown in the Chrome DevTools Performance panel. */
  trackGroup?: string;
  /** Emit one custom-track entry for the complete synchronous dispatch. Defaults to true. */
  dispatches?: boolean;
  /** Emit exact state-apply and view-update phase spans. Defaults to true. */
  phases?: boolean;
  /** Emit custom-dispatch time not covered by observed apply/update phases. Defaults to true. */
  customCode?: boolean;
  /** Omit custom-code gaps shorter than this duration in milliseconds. Defaults to 0. */
  customCodeThresholdMs?: number;
  /** Emit wrapped plugin-hook spans as individually selectable entries. Defaults to true. */
  pluginHooks?: boolean;
  /** Nest entries on one dispatch track by default, or split them into phase/plugin tracks. */
  grouping?: "dispatch" | "phase" | "plugin";
  /** Omit Chrome plugin-hook entries shorter than this duration in milliseconds. Defaults to 0. */
  pluginHookThresholdMs?: number;
  /** Emit application point markers and measured marker spans. Defaults to true. */
  markers?: boolean;
  /** Also show point markers as global vertical timeline markers. Defaults to true. */
  timelineMarkers?: boolean;
}

export interface AppliedTransactionRecord {
  index: number;
  appended: boolean;
  docChanged: boolean;
  selectionSet: boolean;
  storedMarksSet: boolean;
  steps: SerializedValue[];
  /** Normalized maps and lazy per-step document changes; optional for older external records. */
  stepDetails?: readonly RecordedStepDetails[];
  meta: Record<string, unknown>;
  captureError?: string;
}

export interface TransactionRecord {
  readonly id: number;
  readonly instanceId: string;
  /** Private attachment/session namespace used to isolate browser performance entries. */
  readonly sessionId: string;
  readonly timestamp: number;
  readonly totalDuration: number;
  readonly applyDuration: number | null;
  readonly viewUpdateDuration: number | null;
  readonly customDispatchDuration: number | null;
  readonly phaseTimings: readonly DispatchPhaseTiming[];
  readonly applicationStatus: "applied" | "filtered" | "unknown";
  readonly appliedTransactionCount: number | null;
  readonly appendedTransactionCount: number | null;
  readonly filtered: boolean | null;
  readonly docChanged: boolean;
  readonly selectionSet: boolean;
  readonly storedMarksSet: boolean;
  readonly stepCount: number;
  readonly transactions: readonly AppliedTransactionRecord[];
  readonly selectionBefore: SerializedValue;
  readonly selectionAfter: SerializedValue;
  readonly docBefore: SerializedValue;
  readonly docAfter: SerializedValue;
  readonly timings: readonly PluginTiming[];
  readonly markers: readonly DevtoolsMarker[];
  readonly measureName: string | null;
  readonly error: string | null;
  readonly captureErrors?: readonly string[];
  readonly inspection?: {
    readonly revision: number;
    readonly stateBeforeId: number;
    readonly stateAfterId: number;
    readonly parentDispatchId: number | null;
    readonly projections: readonly InspectorProjection[];
    readonly provenance: TransactionProvenance;
  };
}

export interface TransactionProvenance {
  readonly kind: "partial" | "unobserved";
  readonly transactions: readonly {
    readonly id: number;
    readonly appliedIndex: number | null;
    readonly origin:
      | { readonly kind: "root" }
      | { readonly kind: "append"; readonly pluginKey: string }
      | { readonly kind: "unknown" };
  }[];
  readonly filters: readonly {
    readonly transactionId: number;
    readonly pluginKey: string;
    readonly pluginLabel: string;
    readonly outcome: "accepted" | "rejected" | "error";
    readonly error: string | null;
  }[];
  readonly appends: readonly {
    readonly pluginKey: string;
    readonly pluginLabel: string;
    readonly inputTransactionIds: readonly number[];
    readonly outputTransactionId: number | null;
    readonly outcome: "none" | "returned" | "error";
    readonly error: string | null;
  }[];
}

export interface LiveInspectionState {
  readonly target: InspectionTarget;
  readonly revision: number;
  readonly capture: CaptureStatus;
  readonly inspectors: readonly ProseMirrorInspector[];
  readonly getState: () => EditorState;
}

export interface RegisteredProseMirrorInstance {
  id: string;
  label: string;
  view: EditorView;
  registeredAt: number;
  updatedAt: number;
  dispatchCount: number;
  /** Explicit retention cap, or `null` when history is unbounded. */
  transactionLimit: number | null;
  transactions: readonly TransactionRecord[];
  pluginTimings: readonly PluginTimingSummary[];
  /** Optional bounded event, decoration, and NodeView observations. */
  diagnostics?: DevtoolsDiagnosticsController;
  /** Framework-neutral live internals. Serializable consumers use the inspection client. */
  inspection?: LiveInspectionState;
}

export interface DevtoolsSnapshot {
  activeInstanceId: string | null;
  instances: readonly RegisteredProseMirrorInstance[];
  version: number;
}

export interface DevtoolsInstanceDescriptor {
  id: string;
  label: string;
}

export interface RegisterProseMirrorInstanceOptions {
  id: string;
  label?: string;
  view: EditorView;
  /** Private namespace for this registration lifecycle. */
  sessionId?: string;
  /**
   * Optional escape-hatch cap for retained dispatch records. History is
   * unbounded by default. Pass `null` to remove a previously configured cap.
   */
  transactionLimit?: number | null;
  diagnostics?: DevtoolsDiagnosticsController;
  captureProfile?: "bounded" | CaptureProfile;
  inspectors?: readonly ProseMirrorInspector[];
  /** Explicit model state source for framework-owned controlled dispatch. */
  getState?: () => EditorState;
}

export interface AttachProseMirrorDevtoolsOptions extends RegisterProseMirrorInstanceOptions {
  store?: DevtoolsStore;
  performanceMarks?: boolean;
  /** Opt into Chrome DevTools Performance extensibility tracks and markers. */
  performanceExtension?: boolean | DevtoolsPerformanceExtensionOptions;
}

export interface AttachedProseMirrorDevtools {
  readonly id: string;
  readonly sessionId: string;
  readonly view: EditorView;
  detach(): void;
}

export interface InstrumentPluginsOptions {
  instanceId: string;
  store?: DevtoolsStore;
  /** Isolates wrappers and timings belonging to one editor lifecycle. */
  sessionId?: string;
  /** Allows a controller to stop stale lifecycle hooks after teardown. */
  isActive?: () => boolean;
  getPluginLabel?: (plugin: Plugin, index: number) => string;
  diagnostics?: DevtoolsDiagnosticsController;
}

export interface SavedSnapshot {
  id: string;
  instanceId: string;
  name: string;
  createdAt: number;
  doc: SerializedValue;
  selection: SerializedValue;
}

export interface TransactionMeasurement {
  readonly instanceId: string;
  readonly sessionId: string;
  readonly id: number;
  readonly startedAt: number;
  readonly beforeState: EditorState;
  readonly transaction: Transaction;
}

export interface FinishTransactionMeasurement {
  stateAfter: EditorState;
  appliedTransactions?: readonly Transaction[];
  error?: unknown;
  captureError?: unknown;
}

/**
 * Short-lived dispatch payload delivered to subscribers after the synchronous
 * editor update. The store never puts these EditorState objects in history.
 */
export interface DevtoolsDispatchEvent {
  readonly instanceId: string;
  readonly sessionId: string;
  readonly record: TransactionRecord;
  readonly transaction: Transaction;
  readonly beforeState: EditorState;
  readonly stateAfter: EditorState;
  readonly appliedTransactions: readonly Transaction[] | undefined;
}

/**
 * Receives a committed group of dispatches synchronously after the outermost dispatch finishes.
 *
 * Nested dispatches finish inside-out, but events are supplied in invocation/capture order so an
 * outer dispatch precedes the inner dispatches it caused. Delivery is batched in core because these
 * listeners are framework-neutral; a rendering hook cannot provide the same ordering and atomicity
 * to non-UI consumers.
 */
export type DevtoolsDispatchListener = (events: readonly DevtoolsDispatchEvent[]) => void;

export type DevtoolsStoreReader = Readonly<{
  sourceId: string;
  getSnapshot: () => DevtoolsSnapshot;
  subscribe: (listener: () => void) => () => void;
  getActiveInstanceId: () => string | null;
  subscribeActiveInstance: (listener: () => void) => () => void;
  getInstanceDescriptors: () => readonly DevtoolsInstanceDescriptor[];
  subscribeInstanceDescriptors: (listener: () => void) => () => void;
  getInstance: (id: string) => RegisteredProseMirrorInstance | undefined;
  subscribeInstance: (id: string, listener: () => void) => () => void;
  subscribeDispatch: (listener: DevtoolsDispatchListener) => () => void;
}>;

export type DevtoolsInstanceManager = Readonly<{
  register: (options: RegisterProseMirrorInstanceOptions) => () => void;
  unregister: (id: string, view?: EditorView) => void;
  setActiveInstance: (id: string) => void;
  clearTransactions: (id: string) => void;
  pauseCapture: (id: string, sessionId?: string) => void;
  resumeCapture: (id: string, sessionId?: string) => void;
  /** Closes buffered instrumentation owned by a private lifecycle namespace. */
  closeSession: (instanceId: string, sessionId: string) => void;
}>;

export type DevtoolsTransactionRecorder = Readonly<{
  beginTransaction: (
    instanceId: string,
    transaction: Transaction,
    beforeState: EditorState,
    performanceMarks?: boolean,
    performanceExtension?: boolean | DevtoolsPerformanceExtensionOptions,
    sessionId?: string,
  ) => TransactionMeasurement;
  recordPhase: (
    measurement: TransactionMeasurement,
    phase: "apply" | "viewUpdate" | "customDispatch",
    duration: number,
    startedAt?: number,
  ) => void;
  finishTransaction: (
    measurement: TransactionMeasurement,
    result: FinishTransactionMeasurement,
  ) => TransactionRecord | null;
}>;

export type DevtoolsPluginTimingRecorder = Readonly<{
  observeFilter: (observation: {
    instanceId: string;
    sessionId?: string;
    pluginKey: string;
    pluginLabel: string;
    transaction: Transaction;
    outcome: "accepted" | "rejected" | "error";
    error?: unknown;
  }) => void;
  observeAppend: (observation: {
    instanceId: string;
    sessionId?: string;
    pluginKey: string;
    pluginLabel: string;
    transactions: readonly Transaction[];
    appended: Transaction | null | undefined;
    error?: unknown;
    didThrow: boolean;
  }) => void;
  measurePluginHook: <T>(
    instanceId: string,
    pluginKey: string,
    pluginLabel: string,
    hook: PluginHook,
    run: () => T,
    sessionId?: string,
  ) => T;
}>;

export type DevtoolsMarkerRecorder = Readonly<{
  addMarker: (instanceId: string, label: string, options?: DevtoolsMarkerOptions) => boolean;
  measureMarker: <T>(
    instanceId: string,
    label: string,
    run: () => T,
    options?: DevtoolsMarkerOptions,
  ) => T;
}>;

export type DevtoolsStore = DevtoolsStoreReader &
  DevtoolsInstanceManager &
  DevtoolsTransactionRecorder &
  DevtoolsPluginTimingRecorder &
  DevtoolsMarkerRecorder;

export interface StateInspection {
  doc: SerializedValue;
  selection: SerializedValue;
  storedMarks: SerializedValue;
  activeMarks: SerializedValue;
  stats: {
    nodeSize: number;
    childCount: number;
    textSize: number;
  };
}

export interface PluginInspection {
  key: string;
  index: number;
  hasState: boolean;
  state: unknown;
  props: readonly string[];
}

export interface SchemaInspection {
  nodes: Record<string, unknown>;
  marks: Record<string, unknown>;
  topNodeType: string;
}
