import type { RegisteredProseMirrorInstance } from "../core/types";
import type { InspectionCatalog, InspectionCapability, InspectionQuery } from "./types";

export const inspectionQueryCatalog: InspectionCatalog["queries"] = [
  {
    kind: "document",
    description: "Read document JSON or a bounded position range.",
    prerequisites: ["A current state or retained dispatch document."],
  },
  {
    kind: "selection",
    description: "Read the selection at the selected point.",
    prerequisites: ["A current state or retained dispatch selection."],
  },
  {
    kind: "transactions",
    description: "Search retained dispatch summaries in invocation order.",
    prerequisites: ["Dispatch capture."],
  },
  {
    kind: "transaction",
    description: "Read one retained dispatch, applied steps, and observed provenance.",
    prerequisites: ["The requested dispatch remains retained."],
  },
  {
    kind: "contributions",
    description: "Read installed semantic inspector projections.",
    prerequisites: ["Register at least one semantic inspector."],
  },
  {
    kind: "contribution",
    description: "Read one named semantic inspector projection.",
    prerequisites: ["Register the requested semantic inspector."],
  },
  {
    kind: "capabilities",
    description: "Discover installed queries and their prerequisites.",
    prerequisites: [],
  },
  {
    kind: "events",
    description: "Search observed synchronous handler and command events.",
    prerequisites: ["Enable diagnostics and instrument the relevant plugin or command."],
  },
  {
    kind: "decorations",
    description: "Read observed decoration ranges and their current validity.",
    prerequisites: ["Enable diagnostics and observe the decorations callback."],
  },
  {
    kind: "nodeViews",
    description: "Read observed NodeView lifecycle summaries.",
    prerequisites: ["Enable diagnostics and instrument NodeView factories."],
  },
  {
    kind: "schema",
    description: "Read declarative schema constraints at the current state.",
    prerequisites: ["A current editor state."],
  },
  {
    kind: "plugins",
    description: "Read plugin order, props, and bounded current state evidence.",
    prerequisites: [
      "A current editor state. Historical state needs an explicit inspector serializer.",
    ],
  },
];

export function inspectionCapabilities(
  instance: RegisteredProseMirrorInstance,
): readonly InspectionCapability[] {
  const diagnostics = new Set<InspectionQuery["kind"]>(["events", "decorations", "nodeViews"]);
  return [
    ...inspectionQueryCatalog.map((query): InspectionCapability => ({
      id: query.kind,
      version: "1",
      label: query.kind,
      description: query.description,
      prerequisites: query.prerequisites,
      queries: [query.kind],
      evidence:
        diagnostics.has(query.kind) && !instance.diagnostics
          ? { kind: "disabled", reason: "Diagnostics were not enabled for this session." }
          : (query.kind === "contributions" || query.kind === "contribution") &&
              !instance.inspection?.inspectors.length
            ? { kind: "unsupported", reason: "No semantic inspectors are registered." }
            : { kind: "available", value: true },
    })),
    ...(instance.inspection?.inspectors ?? []).map((inspector): InspectionCapability => ({
      ...inspector.descriptor,
      prerequisites: [...inspector.descriptor.prerequisites],
      queries: ["contribution"],
      evidence: { kind: "available", value: true },
    })),
  ];
}
