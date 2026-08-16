import type { EditorState, Plugin, Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

export type DevtoolsTheme = "light" | "dark" | "system";

export type SerializedValue =
  null | boolean | number | string | SerializedValue[] | { [key: string]: SerializedValue };

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
  data?: SerializedValue;
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
  meta: Record<string, SerializedValue>;
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
}

export interface DevtoolsTransactionQuery {
  /** Zero-based offset from the selected ordering edge. Defaults to `0`. */
  offset?: number;
  /** Maximum number of records to return. Omit to return the remaining records. */
  limit?: number;
  /** Defaults to chronological order. */
  order?: "oldest-first" | "newest-first";
}

export interface DevtoolsTransactionPage {
  readonly records: readonly TransactionRecord[];
  readonly total: number;
  readonly offset: number;
  readonly hasMore: boolean;
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

export type DevtoolsDispatchListener = (events: readonly DevtoolsDispatchEvent[]) => void;

export type DevtoolsStoreReader = Readonly<{
  getSnapshot: () => DevtoolsSnapshot;
  subscribe: (listener: () => void) => () => void;
  getActiveInstanceId: () => string | null;
  subscribeActiveInstance: (listener: () => void) => () => void;
  getInstanceDescriptors: () => readonly DevtoolsInstanceDescriptor[];
  subscribeInstanceDescriptors: (listener: () => void) => () => void;
  getInstance: (id: string) => RegisteredProseMirrorInstance | undefined;
  subscribeInstance: (id: string, listener: () => void) => () => void;
  getTransactions: (id: string, query?: DevtoolsTransactionQuery) => DevtoolsTransactionPage;
  getTransactionCount: (id: string) => number;
  subscribeDispatch: (listener: DevtoolsDispatchListener) => () => void;
}>;

export type DevtoolsInstanceManager = Readonly<{
  register: (options: RegisterProseMirrorInstanceOptions) => () => void;
  unregister: (id: string, view?: EditorView) => void;
  setActiveInstance: (id: string) => void;
  clearTransactions: (id: string) => void;
  /** Delivers queued subscription batches synchronously. */
  flush: () => void;
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
  state: SerializedValue;
  props: readonly string[];
}

export interface SchemaInspection {
  nodes: SerializedValue;
  marks: SerializedValue;
  topNodeType: string;
}
