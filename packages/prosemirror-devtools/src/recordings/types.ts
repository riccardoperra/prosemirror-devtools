import type {
  InspectionEditor,
  InspectionLimits,
  InspectionQuery,
  InspectionReadPoint,
  InspectionResult,
  InspectionSource,
  InspectionTarget,
  ProseMirrorInspectionClient,
} from "../inspection/types";

export interface RecordedQuery {
  readonly query: InspectionQuery;
  readonly result: InspectionResult;
}

export interface RecordedPoint {
  readonly point: InspectionReadPoint;
  readonly queries: readonly RecordedQuery[];
}

export type RecordedDispatch =
  | {
      readonly kind: "available";
      readonly id: number;
      readonly before: RecordedPoint;
      readonly after: RecordedPoint;
    }
  | {
      readonly kind: "unavailable";
      readonly id: number;
      readonly result: Exclude<
        InspectionResult<InspectionReadPoint>,
        { readonly kind: "available" }
      >;
    };

/** A bounded diagnostic artifact. It is not an EditorState replay or a browser action report. */
export interface ProseMirrorRecording {
  readonly format: "prosemirror-inspector-recording";
  readonly version: 1;
  readonly id: string;
  readonly createdAt: number;
  readonly versions: Readonly<Record<string, string>>;
  readonly origin: { readonly source: InspectionSource; readonly target: InspectionTarget };
  readonly editor: Pick<InspectionEditor, "label" | "registeredAt" | "capture">;
  readonly limits: {
    readonly maxBytes: number;
    readonly maxDispatches: number;
    readonly query: InspectionLimits;
  };
  readonly current: RecordedPoint;
  readonly dispatches: readonly RecordedDispatch[];
  readonly omissions: readonly { readonly scope: string; readonly reason: string }[];
}

export interface ExportProseMirrorRecordingOptions {
  readonly client: ProseMirrorInspectionClient;
  readonly target: InspectionTarget;
  /** Defaults to the latest 25 dispatch IDs, including unavailable IDs as explicit evidence. */
  readonly transactionIds?: readonly number[];
  readonly versions?: Readonly<Record<string, string>>;
  readonly label?: string;
  /** Total UTF-8 JSON size. At most 2 MB. */
  readonly maxBytes?: number;
  readonly queryLimits?: Partial<InspectionLimits>;
}

export const RECORDING_MAX_BYTES = 2_000_000;
export const RECORDING_MAX_DISPATCHES = 25;
