import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { EditorState } from "prosemirror-state";

import { getInspectionStateId } from "../core/state-id";
import { prosemirrorDevtoolsStore } from "../core/store/create-devtools-store";
import { getRecordedTransactionDocument } from "../core/store/transaction-record";
import type {
  RegisteredProseMirrorInstance,
  SerializedValue,
  TransactionRecord,
} from "../core/types";
import { inspectionCapabilities, inspectionQueryCatalog } from "./catalog";
import {
  defaultInspectionLimits,
  describeInspectionError,
  resolveInspectionLimits,
  serializeInspectionValue,
  serializeInspectorEvidence,
} from "./serialization";
import type {
  CreateProseMirrorInspectionClientOptions,
  InspectionCoverage,
  InspectionEvidence,
  InspectionLimits,
  InspectionPinRequest,
  InspectionQueryRequest,
  InspectionReadPoint,
  InspectionReadRequest,
  InspectionResult,
  InspectionTarget,
  ProseMirrorInspectionClient,
} from "./types";

function coverage(
  instance: RegisteredProseMirrorInstance | undefined,
  limits: InspectionLimits,
): InspectionCoverage {
  const capture = instance?.inspection?.capture;
  const gaps = capture?.gaps ?? [];
  return {
    complete: gaps.length === 0 && (capture?.omittedGapCount ?? 0) === 0,
    gaps: gaps.slice(-limits.maxItems).map((gap) => ({ ...gap })),
    truncated: gaps.length > limits.maxItems,
    limits: { ...limits },
    notes:
      capture?.kind === "paused"
        ? ["Detailed capture is paused. Current state reads remain available."]
        : [],
  };
}

function missingTransaction(
  instance: RegisteredProseMirrorInstance,
  id: number,
): InspectionEvidence<never> {
  const gap = instance.inspection?.capture.gaps.find(
    (entry) => id >= entry.firstDispatchId && id <= entry.lastDispatchId,
  );
  if (gap?.reason === "paused")
    return {
      kind: "unobserved",
      reason: "This dispatch occurred while detailed capture was paused.",
    };
  return id <= instance.dispatchCount
    ? { kind: "expired", reason: "The requested dispatch is no longer retained." }
    : { kind: "unobserved", reason: "The requested dispatch has not been observed." };
}

function transactionSummary(record: TransactionRecord) {
  return {
    id: record.id,
    timestamp: record.timestamp,
    sessionId: record.sessionId,
    applicationStatus: record.applicationStatus,
    appliedTransactionCount: record.appliedTransactionCount,
    appendedTransactionCount: record.appendedTransactionCount,
    docChanged: record.docChanged,
    selectionSet: record.selectionSet,
    stepCount: record.stepCount,
    totalDuration: record.totalDuration,
    parentDispatchId: record.inspection?.parentDispatchId ?? null,
    error: record.error,
    captureErrors: record.captureErrors ?? [],
  };
}

type BoundedItems = <T>(values: readonly T[]) => readonly T[];

function transactionDetail(
  record: TransactionRecord,
  limits: InspectionLimits,
  bounded: BoundedItems,
) {
  return {
    ...transactionSummary(record),
    applyDuration: record.applyDuration,
    viewUpdateDuration: record.viewUpdateDuration,
    customDispatchDuration: record.customDispatchDuration,
    phaseTimings: bounded(record.phaseTimings),
    transactions: bounded(record.transactions).map((transaction) => ({
      index: transaction.index,
      appended: transaction.appended,
      docChanged: transaction.docChanged,
      selectionSet: transaction.selectionSet,
      storedMarksSet: transaction.storedMarksSet,
      steps: bounded(transaction.steps),
      maps: transaction.stepDetails
        ? bounded(transaction.stepDetails).map((step) => ({
            index: step.index,
            ranges: bounded(step.ranges),
            documentSizeBefore: step.documentSizeBefore,
            documentSizeAfter: step.documentSizeAfter,
            mirror: step.mirror,
          }))
        : null,
      meta: serializeInspectionValue(transaction.meta, limits),
      captureError: transaction.captureError ?? null,
    })),
    selectionBefore: record.selectionBefore,
    selectionAfter: record.selectionAfter,
    timings: bounded(record.timings),
    markers: bounded(record.markers).map((marker) => ({
      label: marker.label,
      category: marker.category,
      tone: marker.tone,
      startOffset: marker.startOffset,
      duration: marker.duration,
      data:
        marker.data === undefined
          ? { kind: "unobserved", reason: "No marker data was supplied." }
          : serializeInspectionValue(marker.data, limits),
    })),
    projections: bounded(record.inspection?.projections ?? []),
    provenance: record.inspection
      ? {
          kind: record.inspection.provenance.kind,
          transactions: bounded(record.inspection.provenance.transactions),
          filters: bounded(record.inspection.provenance.filters),
          appends: bounded(record.inspection.provenance.appends).map((append) => ({
            ...append,
            inputTransactionIds: bounded(append.inputTransactionIds),
          })),
        }
      : { kind: "unobserved", transactions: [], filters: [], appends: [] },
  };
}

function createDocumentReader(limits: InspectionLimits): (doc: ProseMirrorNode) => SerializedValue {
  let visited = 0;
  let textBytes = 0;
  const visit = (node: ProseMirrorNode, depth: number): SerializedValue => {
    if (++visited > limits.maxNodes || depth > limits.maxDepth)
      throw new RangeError(
        "Document scope exceeds the requested limits. Read a smaller position range.",
      );
    const result: { [key: string]: SerializedValue } = { type: node.type.name };
    if (Object.keys(node.attrs).length > 0) {
      const attrs = serializeInspectionValue(node.attrs, limits);
      if (attrs.kind !== "available") throw new TypeError(attrs.reason);
      result.attrs = attrs.value;
    }
    if (node.text !== undefined) {
      textBytes += node.text.length;
      if (node.text.length > limits.maxStringLength || textBytes > limits.maxBytes)
        throw new RangeError(
          "Document text exceeds the requested limits. Read a smaller position range.",
        );
      result.text = node.text;
    }
    if (node.marks.length > 0)
      result.marks = node.marks.map((mark) => {
        const value = serializeInspectionValue(mark.toJSON(), limits);
        if (value.kind !== "available") throw new TypeError(value.reason);
        return value.value;
      });
    if (node.childCount > 0) {
      const children: SerializedValue[] = [];
      node.forEach((child) => children.push(visit(child, depth + 1)));
      result.content = children;
    }
    return result;
  };
  return (doc) => visit(doc, 0);
}

function schemaSummary(state: EditorState, limits: InspectionLimits, bounded: BoundedItems) {
  return {
    topNodeType: state.schema.topNodeType.name,
    nodes: bounded(Object.entries(state.schema.nodes)).map(([name, node]) => ({
      name,
      content: node.spec.content ?? "",
      group: node.spec.group ?? "",
      marks: node.spec.marks ?? "_",
      inline: node.isInline,
      text: node.isText,
      leaf: node.isLeaf,
      atom: node.isAtom,
      isolating: node.spec.isolating ?? false,
      selectable: node.spec.selectable ?? true,
      attributes: bounded(Object.entries(node.spec.attrs ?? {})).map(([name, attribute]) => ({
        name,
        required: !Object.hasOwn(attribute, "default"),
        default: Object.hasOwn(attribute, "default")
          ? serializeInspectionValue(attribute.default, limits)
          : null,
      })),
    })),
    marks: bounded(Object.entries(state.schema.marks)).map(([name, mark]) => ({
      name,
      group: mark.spec.group ?? "",
      inclusive: mark.spec.inclusive ?? true,
      excludes: mark.spec.excludes ?? name,
    })),
  };
}

export function createProseMirrorInspectionClient(
  options: CreateProseMirrorInspectionClientOptions = {},
): ProseMirrorInspectionClient {
  const store = options.store ?? prosemirrorDevtoolsStore;
  const source = {
    kind: "live",
    id: store.sourceId,
  } satisfies ProseMirrorInspectionClient["source"];
  const locate = (target: InspectionTarget): InspectionEvidence<RegisteredProseMirrorInstance> => {
    if (target.sourceId !== source.id)
      return { kind: "unsupported", reason: "This target belongs to a different source." };
    const instance = store.getInstance(target.editorId);
    const current = instance?.inspection?.target;
    if (
      !instance ||
      !current ||
      current.sessionId !== target.sessionId ||
      current.generation !== target.generation
    ) {
      return {
        kind: "expired",
        reason: "This editor session is no longer registered. Discover a new target explicitly.",
      };
    }
    return { kind: "available", value: instance };
  };
  const response = <T>(
    target: InspectionTarget,
    point: InspectionReadPoint | null,
    evidence: InspectionEvidence<T>,
    limits: InspectionLimits,
  ): InspectionResult<T> => {
    const captured = coverage(store.getInstance(target.editorId), limits);
    return {
      ...evidence,
      target,
      point,
      coverage: { ...captured, complete: evidence.kind === "available" && captured.complete },
    };
  };
  const liveMatches = (
    instance: RegisteredProseMirrorInstance,
    point: Extract<InspectionReadPoint, { kind: "live" }>,
  ): boolean =>
    instance.inspection?.revision === point.revision &&
    getInspectionStateId(instance.inspection.getState()) === point.stateId &&
    instance.dispatchCount === point.dispatchId &&
    (instance.diagnostics?.getSnapshot().version ?? null) === point.diagnosticsVersion;

  const pin = ({ target, at }: InspectionPinRequest): InspectionResult<InspectionReadPoint> => {
    const located = locate(target);
    if (located.kind !== "available")
      return response(target, null, located, defaultInspectionLimits);
    const instance = located.value;
    const inspection = instance.inspection;
    if (!inspection)
      return response(
        target,
        null,
        { kind: "unsupported", reason: "This store does not publish inspection identities." },
        defaultInspectionLimits,
      );
    try {
      let point: InspectionReadPoint;
      if (at?.kind === "transaction") {
        const record = instance.transactions.find((record) => record.id === at.id);
        if (!record)
          return response(
            target,
            null,
            missingTransaction(instance, at.id),
            defaultInspectionLimits,
          );
        point = {
          kind: "transaction",
          target,
          revision: record.inspection?.revision ?? 0,
          transactionId: record.id,
          phase: at.phase ?? "after",
        };
      } else {
        point = {
          kind: "live",
          target,
          revision: inspection.revision,
          stateId: getInspectionStateId(inspection.getState()),
          dispatchId: instance.dispatchCount,
          diagnosticsVersion: instance.diagnostics?.getSnapshot().version ?? null,
        };
      }
      return response(target, point, { kind: "available", value: point }, defaultInspectionLimits);
    } catch (error) {
      return response(
        target,
        null,
        { kind: "error", reason: describeInspectionError(error) },
        defaultInspectionLimits,
      );
    }
  };

  const read = ({ point, query, limits: requested }: InspectionReadRequest): InspectionResult => {
    const limits = resolveInspectionLimits(requested);
    const located = locate(point.target);
    if (located.kind !== "available") return response(point.target, point, located, limits);
    const instance = located.value;
    const inspection = instance.inspection;
    const finish = (evidence: InspectionEvidence): InspectionResult =>
      response(point.target, point, evidence, limits);
    if (!inspection)
      return finish({
        kind: "unsupported",
        reason: "This store does not publish inspection data.",
      });
    let truncated = false;
    const notes: string[] = [];
    const bounded = <T>(values: readonly T[]): readonly T[] => {
      if (values.length > limits.maxItems) truncated = true;
      return values.slice(0, limits.maxItems);
    };
    try {
      if (point.kind === "live" && !liveMatches(instance, point))
        return finish({
          kind: "expired",
          reason: "This live read point advanced. Pin a new point explicitly.",
        });
      const record =
        point.kind === "transaction"
          ? instance.transactions.find((record) => record.id === point.transactionId)
          : undefined;
      if (point.kind === "transaction" && !record)
        return finish(missingTransaction(instance, point.transactionId));
      if (
        point.kind === "transaction" &&
        record &&
        point.revision !== (record.inspection?.revision ?? 0)
      )
        return finish({
          kind: "expired",
          reason: "This transaction read point does not match its retained revision.",
        });
      const state = point.kind === "live" ? inspection.getState() : undefined;
      const project = (): InspectionEvidence<unknown> => {
        switch (query.kind) {
          case "document": {
            const doc =
              state?.doc ??
              (record && point.kind === "transaction"
                ? getRecordedTransactionDocument(record, point.phase)
                : undefined);
            if (!doc) {
              if (!record || point.kind !== "transaction")
                return { kind: "unobserved", reason: "No document was retained at this point." };
              if (query.from !== undefined || query.to !== undefined)
                return {
                  kind: "unsupported",
                  reason:
                    "This external record does not retain immutable documents for range reads.",
                };
              return {
                kind: "available",
                value: point.phase === "before" ? record.docBefore : record.docAfter,
              };
            }
            if (query.from === undefined && query.to === undefined)
              return { kind: "available", value: createDocumentReader(limits)(doc) };
            const from = query.from ?? 0;
            const to = query.to ?? doc.content.size;
            if (
              !Number.isSafeInteger(from) ||
              !Number.isSafeInteger(to) ||
              from < 0 ||
              to < from ||
              to > doc.content.size
            )
              return {
                kind: "error",
                reason: "Document range must use valid ordered positions in this document.",
              };
            const slice = doc.slice(from, to);
            const content: SerializedValue[] = [];
            const readNode = createDocumentReader(limits);
            slice.content.forEach((node) => content.push(readNode(node)));
            return {
              kind: "available",
              value: {
                kind: "slice",
                from,
                to,
                content,
                openStart: slice.openStart,
                openEnd: slice.openEnd,
              },
            };
          }
          case "selection":
            return {
              kind: "available",
              value: state
                ? {
                    ...state.selection.toJSON(),
                    from: state.selection.from,
                    to: state.selection.to,
                    anchor: state.selection.anchor,
                    head: state.selection.head,
                    empty: state.selection.empty,
                  }
                : point.kind === "transaction" && record
                  ? point.phase === "before"
                    ? record.selectionBefore
                    : record.selectionAfter
                  : null,
            };
          case "transactions":
            return {
              kind: "available",
              value: bounded(
                instance.transactions.filter(
                  (item) =>
                    (point.kind !== "transaction" ||
                      item.id < point.transactionId ||
                      (item.id === point.transactionId && point.phase === "after")) &&
                    (query.afterId === undefined || item.id > query.afterId) &&
                    (query.beforeId === undefined || item.id < query.beforeId) &&
                    (query.applicationStatus === undefined ||
                      item.applicationStatus === query.applicationStatus),
                ),
              ).map(transactionSummary),
            };
          case "transaction": {
            if (
              point.kind === "transaction" &&
              (query.id > point.transactionId ||
                (query.id === point.transactionId && point.phase === "before"))
            )
              return {
                kind: "unobserved",
                reason: "The requested dispatch is beyond this read point.",
              };
            const transaction = instance.transactions.find((item) => item.id === query.id);
            if (transaction?.captureErrors?.length)
              notes.push(
                "Some dispatch fields failed during capture. Inspect captureErrors and per-field evidence.",
              );
            return transaction
              ? { kind: "available", value: transactionDetail(transaction, limits, bounded) }
              : missingTransaction(instance, query.id);
          }
          case "capabilities":
            return { kind: "available", value: bounded(inspectionCapabilities(instance)) };
          case "contribution":
          case "contributions": {
            if (point.kind === "transaction" && point.phase === "before")
              return {
                kind: "unobserved",
                reason:
                  "Retained inspector projections describe the end of the dispatch. Inspect their explicit before projection when available.",
              };
            if (query.kind === "contribution") {
              if (state) {
                const inspector = inspection.inspectors.find(
                  (inspector) => inspector.descriptor.id === query.id,
                );
                return inspector
                  ? serializeInspectorEvidence(
                      () => inspector.read({ state, target: point.target, point }),
                      limits,
                    )
                  : {
                      kind: "unsupported",
                      reason: "The requested semantic inspector is not registered.",
                    };
              }
              return (
                record?.inspection?.projections.find((projection) => projection.id === query.id)
                  ?.evidence ?? {
                  kind: "unobserved",
                  reason: "No projection for this inspector was captured at this dispatch.",
                }
              );
            }
            const projections = state
              ? bounded(inspection.inspectors).map((inspector) => ({
                  id: inspector.descriptor.id,
                  version: inspector.descriptor.version,
                  evidence: serializeInspectorEvidence(
                    () => inspector.read({ state, target: point.target, point }),
                    limits,
                  ),
                }))
              : bounded(record?.inspection?.projections ?? []);
            if (projections.some((projection) => projection.evidence.kind !== "available")) {
              notes.push(
                "Some semantic inspector projections are unavailable. Inspect each projection before checking its value.",
              );
            }
            return projections.length > 0
              ? { kind: "available", value: projections }
              : { kind: "unsupported", reason: "No semantic inspector projections are available." };
          }
          case "events":
          case "decorations":
          case "nodeViews": {
            if (!instance.diagnostics)
              return { kind: "disabled", reason: "Diagnostics were not enabled for this session." };
            if (point.kind !== "live")
              return {
                kind: "unobserved",
                reason:
                  "This channel does not retain historical snapshots. Query an explicit live point.",
              };
            const diagnostics = instance.diagnostics.getSnapshot();
            const retention = diagnostics.retention;
            if (query.kind === "events" && retention?.events.discarded)
              notes.push(
                `${retention.events.discarded} event observations were evicted or cleared. The retained list does not cover the full session.`,
              );
            if (query.kind === "decorations" && retention?.decorations.truncated)
              notes.push("Decoration sources or ranges exceeded their capture budget.");
            if (query.kind === "nodeViews" && retention?.nodeViews.discarded)
              notes.push(
                `${retention.nodeViews.discarded} NodeView records were evicted or cleared.`,
              );
            if (!retention)
              notes.push(
                "This external diagnostics controller does not declare retention coverage.",
              );
            const values =
              query.kind === "events"
                ? diagnostics.events.filter(
                    (event) =>
                      (query.afterId === undefined || event.id > query.afterId) &&
                      (query.name === undefined || event.name === query.name),
                  )
                : query.kind === "decorations"
                  ? diagnostics.decorations
                  : diagnostics.nodeViews;
            if (
              values.length === 0 &&
              query.kind === "events" &&
              retention?.events.discarded &&
              diagnostics.events.length === 0
            )
              return {
                kind: "expired",
                reason: "The observed event records were evicted or cleared.",
              };
            if (values.length === 0)
              return {
                kind: "unobserved",
                reason:
                  "No matching observation is retained. An empty trace does not prove the event did not happen.",
              };
            return { kind: "available", value: bounded<unknown>(values) };
          }
          case "schema":
            return state
              ? { kind: "available", value: schemaSummary(state, limits, bounded) }
              : {
                  kind: "unobserved",
                  reason: "Schema descriptors were not retained for this dispatch.",
                };
          case "plugins":
            return state
              ? {
                  kind: "available",
                  value: bounded(state.plugins).map((plugin, index) => ({
                    key: Reflect.get(plugin, "key"),
                    index,
                    props: bounded(Object.keys(plugin.props).sort()),
                    state: serializeInspectorEvidence(() => {
                      const value = plugin.getState(state);
                      return value === undefined
                        ? { kind: "unobserved", reason: "This plugin has no state field." }
                        : { kind: "available", value };
                    }, limits),
                  })),
                }
              : {
                  kind: "unobserved",
                  reason:
                    "Historical plugin state requires an explicitly registered semantic serializer.",
                };
          default: {
            const exhaustive: never = query;
            return {
              kind: "unsupported",
              reason: `Unknown inspection query ${String(exhaustive)}.`,
            };
          }
        }
      };
      const evidence = serializeInspectorEvidence(project, limits);
      const current = store.getInstance(point.target.editorId);
      if (point.kind === "live" && (!current || !liveMatches(current, point)))
        return finish({
          kind: "expired",
          reason: "The editor advanced during this read. No mixed result was returned.",
        });
      const result = finish(evidence);
      return {
        ...result,
        coverage: {
          ...result.coverage,
          complete:
            result.coverage.complete &&
            !truncated &&
            notes.length === 0 &&
            evidence.kind === "available",
          truncated: result.coverage.truncated || truncated,
          notes: [...result.coverage.notes, ...notes],
        },
      };
    } catch (error) {
      return finish({ kind: "error", reason: describeInspectionError(error) });
    }
  };

  return {
    source,
    catalog: () => ({
      version: 1,
      source: { ...source },
      queries: inspectionQueryCatalog.map((query) => ({
        ...query,
        prerequisites: [...query.prerequisites],
      })),
    }),
    listEditors: () =>
      store.getSnapshot().instances.flatMap((instance) =>
        instance.inspection
          ? [
              {
                target: { ...instance.inspection.target },
                label: instance.label,
                registeredAt: instance.registeredAt,
                capture: {
                  ...instance.inspection.capture,
                  gaps: instance.inspection.capture.gaps.map((gap) => ({ ...gap })),
                  profile: {
                    ...instance.inspection.capture.profile,
                    budgets: {
                      ...instance.inspection.capture.profile.budgets,
                      projections: { ...instance.inspection.capture.profile.budgets.projections },
                    },
                  },
                },
                capabilities: inspectionCapabilities(instance),
              },
            ]
          : [],
      ),
    pin,
    read,
    query(request: InspectionQueryRequest) {
      const pinned = pin(request);
      return pinned.kind === "available"
        ? read({
            point: pinned.value,
            query: request.query,
            ...(request.limits === undefined ? {} : { limits: request.limits }),
          })
        : pinned;
    },
    subscribe({ target }, listener) {
      if (locate(target).kind !== "available") return () => {};
      return store.subscribeInstance(target.editorId, listener);
    },
  };
}
