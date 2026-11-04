export type TransportDispatchLink =
  | { readonly kind: "unknown" }
  | { readonly kind: "observed"; readonly dispatchId: number };

export type TransportPayload =
  | { readonly kind: "steps"; readonly version: number; readonly count: number }
  | { readonly kind: "yjs-update"; readonly bytes: number };

export type TransportSignal =
  | { readonly kind: "connection"; readonly state: "connecting" | "connected" | "disconnected" }
  | {
      readonly kind: "send" | "receive";
      readonly messageId: string;
      readonly payload: TransportPayload;
      readonly dispatch: TransportDispatchLink;
    }
  | {
      readonly kind: "acknowledge";
      readonly messageId: string;
      readonly confirmedVersion: number | null;
      readonly dispatch: TransportDispatchLink;
    }
  | { readonly kind: "error"; readonly messageId: string | null; readonly reason: string };

export interface TransportSnapshot {
  readonly kind: "application-observed";
  readonly sequence: number;
  readonly connection: "unobserved" | "connecting" | "connected" | "disconnected";
  readonly counts: {
    readonly sends: number;
    readonly receives: number;
    readonly acknowledgements: number;
    readonly errors: number;
  };
  readonly latest: { readonly observedAt: number; readonly signal: TransportSignal } | null;
  readonly retention: "latest-signal-only";
}

export interface TransportObserver {
  /** Called at the actual transport boundary, rather than inferred from editor transactions. */
  observe(signal: TransportSignal): void;
  getSnapshot(): TransportSnapshot;
}

/** Holds a current transport projection. The editor session owns captured historical projections. */
export function createTransportObserver(): TransportObserver {
  let snapshot: TransportSnapshot = {
    kind: "application-observed",
    sequence: 0,
    connection: "unobserved",
    counts: { sends: 0, receives: 0, acknowledgements: 0, errors: 0 },
    latest: null,
    retention: "latest-signal-only",
  };
  return {
    observe(signal) {
      const observed = structuredClone(signal);
      const counts = { ...snapshot.counts };
      let connection = snapshot.connection;
      switch (observed.kind) {
        case "connection":
          connection = observed.state;
          break;
        case "send":
          counts.sends += 1;
          break;
        case "receive":
          counts.receives += 1;
          break;
        case "acknowledge":
          counts.acknowledgements += 1;
          break;
        case "error":
          counts.errors += 1;
          break;
        default: {
          const exhaustive: never = observed;
          return exhaustive;
        }
      }
      snapshot = {
        ...snapshot,
        sequence: snapshot.sequence + 1,
        connection,
        counts,
        latest: { observedAt: Date.now(), signal: observed },
      };
    },
    getSnapshot: () => structuredClone(snapshot),
  };
}
