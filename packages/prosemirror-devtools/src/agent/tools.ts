import { serializeInspectionValue } from "../inspection/serialization";
import type {
  InspectionAt,
  InspectionLimits,
  InspectionQuery,
  InspectionQueryRequest,
  InspectionReadPoint,
  InspectionTarget,
  ProseMirrorInspectionClient,
} from "../inspection/types";
import {
  evaluateProseMirrorInspection,
  type InspectionAssertion,
  type InspectionPredicate,
} from "./validation";

interface AgentTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  execute(args: unknown): unknown;
}

interface AgentToolGroup {
  readonly name: string;
  readonly description: string;
  readonly tools: readonly AgentTool[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) throw new TypeError("Expected an object.");
  return value;
}

function fields(input: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new TypeError("Unexpected request field.");
  }
}

function string(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 1024) {
    throw new TypeError("Expected a nonempty string of at most 1024 characters.");
  }
  return value;
}

function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("Expected a nonnegative safe integer.");
  }
  return value;
}

function target(value: unknown): InspectionTarget {
  const input = object(value);
  fields(input, ["sourceId", "editorId", "sessionId", "generation"]);
  return {
    sourceId: string(input.sourceId),
    editorId: string(input.editorId),
    sessionId: string(input.sessionId),
    generation: integer(input.generation),
  };
}

function phase(value: unknown): "before" | "after" {
  if (value !== "before" && value !== "after") throw new TypeError("Expected before or after.");
  return value;
}

function at(value: unknown): InspectionAt {
  const input = object(value);
  if (input.kind === "current") {
    fields(input, ["kind"]);
    return { kind: "current" };
  }
  if (input.kind === "transaction") {
    fields(input, ["kind", "id", "phase"]);
    return {
      kind: "transaction",
      id: integer(input.id),
      ...(input.phase === undefined ? {} : { phase: phase(input.phase) }),
    };
  }
  throw new TypeError("Unknown observation point.");
}

function point(value: unknown): InspectionReadPoint {
  const input = object(value);
  const base = { target: target(input.target), revision: integer(input.revision) };
  if (input.kind === "live") {
    fields(input, ["kind", "target", "revision", "stateId", "dispatchId", "diagnosticsVersion"]);
    return {
      ...base,
      kind: "live",
      stateId: integer(input.stateId),
      dispatchId: integer(input.dispatchId),
      diagnosticsVersion:
        input.diagnosticsVersion === null ? null : integer(input.diagnosticsVersion),
    };
  }
  if (input.kind === "transaction") {
    fields(input, ["kind", "target", "revision", "transactionId", "phase"]);
    return {
      ...base,
      kind: "transaction",
      transactionId: integer(input.transactionId),
      phase: phase(input.phase),
    };
  }
  throw new TypeError("Unknown read point.");
}

function query(value: unknown): InspectionQuery {
  const input = object(value);
  const accepted = Object.entries(queryFields).find(([kind]) => kind === input.kind);
  if (!accepted) throw new TypeError("Unknown inspection query.");
  fields(input, ["kind", ...Object.keys(accepted[1])]);
  switch (input.kind) {
    case "document":
      return {
        kind: "document",
        ...(input.from === undefined ? {} : { from: integer(input.from) }),
        ...(input.to === undefined ? {} : { to: integer(input.to) }),
      };
    case "transactions": {
      const status = input.applicationStatus;
      if (
        status !== undefined &&
        status !== "applied" &&
        status !== "filtered" &&
        status !== "unknown"
      ) {
        throw new TypeError("Unknown transaction status.");
      }
      return {
        kind: "transactions",
        ...(input.afterId === undefined ? {} : { afterId: integer(input.afterId) }),
        ...(input.beforeId === undefined ? {} : { beforeId: integer(input.beforeId) }),
        ...(status === undefined ? {} : { applicationStatus: status }),
      };
    }
    case "transaction":
      return { kind: "transaction", id: integer(input.id) };
    case "contribution":
      return { kind: "contribution", id: string(input.id) };
    case "events":
      return {
        kind: "events",
        ...(input.afterId === undefined ? {} : { afterId: integer(input.afterId) }),
        ...(input.name === undefined ? {} : { name: string(input.name) }),
      };
    case "selection":
    case "contributions":
    case "capabilities":
    case "decorations":
    case "nodeViews":
    case "schema":
    case "plugins":
      return { kind: input.kind };
    default:
      throw new TypeError("Unknown inspection query.");
  }
}

function limits(value: unknown): Partial<InspectionLimits> {
  const input = object(value);
  const parsed: { -readonly [Key in keyof InspectionLimits]?: InspectionLimits[Key] } = {};
  const allowed = [
    "maxItems",
    "maxDepth",
    "maxNodes",
    "maxStringLength",
    "maxBytes",
  ] satisfies (keyof InspectionLimits)[];
  fields(input, allowed);
  for (const key of allowed) {
    if (input[key] !== undefined) {
      const limit = integer(input[key]);
      if (limit === 0) throw new TypeError("Inspection limits must be positive.");
      parsed[key] = limit;
    }
  }
  return parsed;
}

function request(value: unknown): InspectionQueryRequest {
  const input = object(value);
  fields(input, ["target", "query", "at", "limits"]);
  return {
    target: target(input.target),
    query: query(input.query),
    ...(input.at === undefined ? {} : { at: at(input.at) }),
    ...(input.limits === undefined ? {} : { limits: limits(input.limits) }),
  };
}

function predicate(value: unknown): InspectionPredicate {
  const input = object(value);
  fields(input, input.kind === "exists" ? ["kind"] : ["kind", "expected"]);
  switch (input.kind) {
    case "exists":
      return { kind: "exists" };
    case "equals": {
      const expected = serializeInspectionValue(input.expected);
      if (expected.kind !== "available") throw new TypeError(expected.reason);
      return { kind: "equals", expected: expected.value };
    }
    case "contains":
      return { kind: "contains", expected: string(input.expected) };
    case "at-least":
      if (typeof input.expected !== "number" || !Number.isFinite(input.expected))
        throw new TypeError("Expected a finite number.");
      return { kind: "at-least", expected: input.expected };
    default:
      throw new TypeError("Unknown assertion predicate.");
  }
}

function assertionPath(value: unknown): readonly (string | number)[] {
  if (!Array.isArray(value) || value.length > 64)
    throw new TypeError("Expected a path of at most 64 segments.");
  return value.map((segment: unknown) =>
    typeof segment === "string" ? string(segment) : integer(segment),
  );
}

function assertion(value: unknown): InspectionAssertion {
  const input = object(value);
  fields(input, ["path", "predicate", "completeness", "requiredEvidence"]);
  const path = input.path === undefined ? [] : assertionPath(input.path);
  if (input.completeness !== "value" && input.completeness !== "capture") {
    throw new TypeError("Choose value or capture completeness explicitly.");
  }
  const required = input.requiredEvidence;
  if (required !== undefined && (!Array.isArray(required) || required.length > 32)) {
    throw new TypeError("Expected at most 32 required evidence paths.");
  }
  return {
    path,
    predicate: predicate(input.predicate),
    completeness: input.completeness,
    ...(required === undefined ? {} : { requiredEvidence: required.map(assertionPath) }),
  };
}

const targetSchema = {
  type: "object",
  required: ["sourceId", "editorId", "sessionId", "generation"],
  additionalProperties: false,
  properties: {
    sourceId: { type: "string" },
    editorId: { type: "string" },
    sessionId: { type: "string" },
    generation: { type: "integer", minimum: 0 },
  },
};

const queryFields = {
  document: { from: { type: "integer", minimum: 0 }, to: { type: "integer", minimum: 0 } },
  selection: {},
  transactions: {
    afterId: { type: "integer", minimum: 0 },
    beforeId: { type: "integer", minimum: 0 },
    applicationStatus: { enum: ["applied", "filtered", "unknown"] },
  },
  transaction: { id: { type: "integer", minimum: 0 } },
  contributions: {},
  contribution: { id: { type: "string" } },
  capabilities: {},
  events: { afterId: { type: "integer", minimum: 0 }, name: { type: "string" } },
  decorations: {},
  nodeViews: {},
  schema: {},
  plugins: {},
} satisfies Record<InspectionQuery["kind"], Readonly<Record<string, unknown>>>;

const requestSchema = {
  type: "object",
  required: ["target", "query"],
  additionalProperties: false,
  properties: {
    target: targetSchema,
    at: {
      oneOf: [
        {
          type: "object",
          required: ["kind"],
          properties: { kind: { const: "current" } },
          additionalProperties: false,
        },
        {
          type: "object",
          required: ["kind", "id"],
          properties: {
            kind: { const: "transaction" },
            id: { type: "integer", minimum: 0 },
            phase: { enum: ["before", "after"] },
          },
          additionalProperties: false,
        },
      ],
    },
    query: { type: "object", required: ["kind"], properties: { kind: { type: "string" } } },
    limits: { type: "object" },
  },
};

function tool(
  name: string,
  description: string,
  inputSchema: Readonly<Record<string, unknown>>,
  execute: (args: unknown) => unknown,
): AgentTool {
  return {
    name,
    description,
    inputSchema,
    execute(args) {
      try {
        return execute(args);
      } catch (error) {
        return {
          kind: "error",
          reason: error instanceof Error ? error.message : "Invalid tool request.",
        };
      }
    },
  };
}

export function createProseMirrorAgentTools(client: ProseMirrorInspectionClient): AgentToolGroup {
  const catalog = client.catalog();
  const querySchema = {
    oneOf: catalog.queries.map((entry) => ({
      type: "object",
      description: entry.description,
      required:
        entry.kind === "transaction" || entry.kind === "contribution" ? ["kind", "id"] : ["kind"],
      properties: { kind: { const: entry.kind }, ...queryFields[entry.kind] },
      additionalProperties: false,
    })),
  };
  const inspectSchema = {
    ...requestSchema,
    properties: { ...requestSchema.properties, query: querySchema },
  };
  return {
    name: "ProseMirror Inspector",
    description:
      "Read captured ProseMirror evidence. Browser actions and visual checks remain separate.",
    tools: [
      tool(
        "prosemirror_catalog",
        "Read protocol version, source and supported query descriptions.",
        { type: "object", properties: {} },
        () => client.catalog(),
      ),
      tool(
        "prosemirror_editors",
        "List up to 100 live or recorded editors and their explicit session targets and capabilities.",
        { type: "object", properties: {} },
        () => {
          const editors = client.listEditors();
          return {
            source: client.source,
            editors: editors.slice(0, 100),
            truncated: editors.length > 100,
          };
        },
      ),
      tool(
        "prosemirror_inspect",
        "Read evidence for an explicit editor/session. Query parameters include document from/to, transaction id, transactions afterId/beforeId/applicationStatus, contribution id or events afterId/name.",
        inspectSchema,
        (args) => client.query(request(args)),
      ),
      tool(
        "prosemirror_read",
        "Read another query at the exact point returned by an earlier inspection. Expired points require a new inspection.",
        {
          type: "object",
          required: ["point", "query"],
          properties: {
            point: { type: "object" },
            query: inspectSchema.properties.query,
            limits: { type: "object" },
          },
        },
        (args) => {
          const input = object(args);
          fields(input, ["point", "query", "limits"]);
          return client.read({
            point: point(input.point),
            query: query(input.query),
            ...(input.limits === undefined ? {} : { limits: limits(input.limits) }),
          });
        },
      ),
      tool(
        "prosemirror_check",
        "Evaluate a semantic expectation. Set completeness to value for current state or capture when complete trace evidence is required. Declare requiredEvidence paths for known nested evidence wrappers before comparing their values. This does not verify browser rendering.",
        {
          type: "object",
          required: ["request", "assertion"],
          properties: {
            request: inspectSchema,
            assertion: {
              type: "object",
              required: ["predicate", "completeness"],
              properties: {
                path: { type: "array", maxItems: 64, items: { type: ["string", "integer"] } },
                requiredEvidence: {
                  type: "array",
                  maxItems: 32,
                  items: { type: "array", maxItems: 64, items: { type: ["string", "integer"] } },
                },
                completeness: { enum: ["value", "capture"] },
                predicate: {
                  type: "object",
                  required: ["kind"],
                  properties: {
                    kind: { enum: ["equals", "contains", "at-least", "exists"] },
                    expected: {},
                  },
                },
              },
            },
          },
        },
        (args) => {
          const input = object(args);
          fields(input, ["request", "assertion"]);
          return evaluateProseMirrorInspection(
            client.query(request(input.request)),
            assertion(input.assertion),
          );
        },
      ),
    ],
  };
}

export function installProseMirrorChromeBridge(
  client: ProseMirrorInspectionClient,
  options: {
    readonly target?: EventTarget;
    readonly inspector?: {
      traceChromeToolCall<T>(name: string, input: unknown, execute: () => T): T;
    };
  } = {},
): () => void {
  const host = options.target ?? globalThis.window;
  if (!host) throw new Error("A browser event target is required.");
  const catalogue = createProseMirrorAgentTools(client);
  const { inspector } = options;
  const group = inspector
    ? {
        ...catalogue,
        tools: catalogue.tools.map((tool) => ({
          ...tool,
          execute: (input: unknown) =>
            inspector.traceChromeToolCall(tool.name, input, () => tool.execute(input)),
        })),
      }
    : catalogue;
  const discover = (event: Event): void => {
    if ("respondWith" in event && typeof event.respondWith === "function") event.respondWith(group);
  };
  host.addEventListener("devtoolstooldiscovery", discover);
  return () => host.removeEventListener("devtoolstooldiscovery", discover);
}
