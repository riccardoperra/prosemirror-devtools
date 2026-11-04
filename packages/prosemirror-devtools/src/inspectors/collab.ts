import { getVersion, sendableSteps } from "prosemirror-collab";
import type { EditorState, Plugin } from "prosemirror-state";

import type { InspectionEvidence, ProseMirrorInspector } from "../inspection/types";
import type { TransportObserver, TransportSnapshot } from "./transport";

export interface CollabStateInspection {
  readonly version: number;
  readonly unconfirmedSteps: number;
  readonly clientId: string | number | null;
  readonly origins: readonly {
    readonly pendingStepIndex: number;
    readonly transactionTime: number;
    readonly originalStepCount: number;
    readonly docChanged: boolean;
  }[];
  readonly originScope: "original-transactions-before-any-rebase";
}

interface CollabInspectionState {
  readonly state: CollabStateInspection;
  readonly transport: TransportSnapshot | { readonly kind: "unobserved"; readonly reason: string };
}

export type CollabInspection = CollabInspectionState &
  (
    | { readonly kind: "state"; readonly before: null }
    | { readonly kind: "dispatch"; readonly before: CollabStateInspection }
  );

export interface CollabInspectorOptions {
  readonly plugin: Plugin;
  readonly transport?: TransportObserver;
}

function inspectState(state: EditorState): CollabStateInspection {
  const pending = sendableSteps(state);
  return {
    version: getVersion(state),
    unconfirmedSteps: pending?.steps.length ?? 0,
    clientId: pending?.clientID ?? null,
    origins:
      pending?.origins.map((transaction, pendingStepIndex) => ({
        pendingStepIndex,
        transactionTime: transaction.time,
        originalStepCount: transaction.steps.length,
        docChanged: transaction.docChanged,
      })) ?? [],
    originScope: "original-transactions-before-any-rebase",
  };
}

export function createCollabInspector({
  plugin,
  transport,
}: CollabInspectorOptions): ProseMirrorInspector<CollabInspection> {
  const unavailable: InspectionEvidence<never> = {
    kind: "unsupported",
    reason: "The supplied prosemirror-collab plugin is not installed in this state.",
  };
  const transportState = () =>
    transport?.getSnapshot() ??
    ({
      kind: "unobserved",
      reason:
        "No application transport observer was supplied. Network state and causal links cannot be inferred from collab transactions.",
    } satisfies CollabInspection["transport"]);
  return {
    descriptor: {
      id: "prosemirror-collab",
      version: "1",
      label: "ProseMirror collaboration",
      description:
        "Public confirmed version and unconfirmed steps with original transaction metadata. Transport signals are explicitly observed by the application and have independent freshness.",
      prerequisites: [
        "prosemirror-collab",
        "An explicit installed collab() plugin",
        "Application observation for transport and dispatch links",
      ],
    },
    read({ state }) {
      if (plugin.getState(state) === undefined) return unavailable;
      return {
        kind: "available",
        value: {
          kind: "state",
          state: inspectState(state),
          before: null,
          transport: transportState(),
        },
      };
    },
    capture({ beforeState, stateAfter }) {
      if (plugin.getState(beforeState) === undefined || plugin.getState(stateAfter) === undefined)
        return unavailable;
      return {
        kind: "available",
        value: {
          kind: "dispatch",
          state: inspectState(stateAfter),
          before: inspectState(beforeState),
          transport: transportState(),
        },
      };
    },
  };
}
