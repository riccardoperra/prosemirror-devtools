import { Plugin } from "prosemirror-state";
import { afterEach, describe, expect, it } from "vitest";

import {
  createPluginStateInspector,
  createProseMirrorDevtoolsSession,
  createProseMirrorDevtoolsStore,
  createProseMirrorInspectionClient,
} from "../src/core";
import {
  createProseMirrorRecordingClient,
  exportProseMirrorRecording,
  parseProseMirrorRecording,
  RECORDING_MAX_BYTES,
} from "../src/recordings";
import { createTestState, createTestView } from "./helpers";

afterEach(() => document.body.replaceChildren());

function fixture(options: { count?: number; transactionLimit?: number; text?: string } = {}) {
  const store = createProseMirrorDevtoolsStore();
  const plugin = new Plugin({ state: { init: () => 0, apply: (_tr, value) => value + 1 } });
  const session = createProseMirrorDevtoolsSession({
    id: "recorded-editor",
    label: "Recorded editor",
    store,
    performanceMarks: false,
    ...(options.transactionLimit === undefined
      ? {}
      : { transactionLimit: options.transactionLimit }),
    inspectors: [
      createPluginStateInspector({ id: "counter", plugin, serialize: (value) => value }),
    ],
  });
  const view = createTestView(
    createTestState(options.text ?? "start", session.instrumentPlugins([plugin])),
  );
  session.attach(view);
  for (let index = 0; index < (options.count ?? 2); index += 1)
    view.dispatch(view.state.tr.insertText(String(index + 1)));
  const client = createProseMirrorInspectionClient({ store });
  const target = client.listEditors()[0]!.target;
  return {
    view,
    session,
    client,
    target,
    destroy() {
      session.dispose();
      view.destroy();
    },
  };
}

describe("diagnostic recordings", () => {
  it("round-trips document, selection, historical boundaries and projections without a live editor", () => {
    const source = fixture();
    const expected = source.view.state.doc.toJSON();
    const recording = exportProseMirrorRecording({
      client: source.client,
      target: source.target,
      versions: { inspector: "test", prosemirror: "fixture" },
    });
    source.destroy();
    const parsed = parseProseMirrorRecording(JSON.stringify(recording));
    const offline = createProseMirrorRecordingClient(parsed);
    const target = offline.listEditors()[0]!.target;
    expect(offline.source.kind).toBe("offline");
    expect(target.sourceId).not.toBe(source.target.sourceId);
    expect(target.sessionId).not.toBe(source.target.sessionId);
    expect(offline.query({ target, query: { kind: "document" } })).toMatchObject({
      kind: "available",
      value: expected,
      target,
    });
    expect(
      offline.query({
        target,
        at: { kind: "transaction", id: 2, phase: "before" },
        query: { kind: "document" },
      }),
    ).toMatchObject({ kind: "available", value: { content: [{ content: [{ text: "1start" }] }] } });
    expect(
      offline.query({
        target,
        at: { kind: "transaction", id: 2 },
        query: { kind: "transaction", id: 2 },
      }),
    ).toMatchObject({ kind: "available", value: { id: 2, applicationStatus: "applied" } });
    expect(
      offline.query({
        target,
        at: { kind: "transaction", id: 2 },
        query: { kind: "contributions" },
      }),
    ).toMatchObject({ kind: "available", value: [{ id: "counter" }] });
    expect(offline.query({ target: source.target, query: { kind: "document" } }).kind).toBe(
      "unsupported",
    );
    expect(offline.query({ target, query: { kind: "document", from: 0, to: 1 } }).kind).toBe(
      "unobserved",
    );
    expect(createProseMirrorRecordingClient(parsed).source.id).not.toBe(offline.source.id);
    expect(Object.isFrozen(parsed.current.queries)).toBe(true);
  });

  it("records expired dispatches and gaps explicitly instead of rebuilding them", () => {
    const source = fixture({ count: 3, transactionLimit: 1 });
    try {
      const recording = exportProseMirrorRecording({
        client: source.client,
        target: source.target,
      });
      expect(recording.dispatches.map(({ kind }) => kind)).toEqual([
        "unavailable",
        "unavailable",
        "available",
      ]);
      expect(recording.omissions.some(({ reason }) => reason.includes("expired"))).toBe(true);
      const offline = createProseMirrorRecordingClient(recording);
      const target = offline.listEditors()[0]!.target;
      expect(
        offline.query({ target, at: { kind: "transaction", id: 1 }, query: { kind: "document" } })
          .kind,
      ).toBe("expired");
      expect(offline.pin({ target, at: { kind: "transaction", id: 99 } }).kind).toBe("unobserved");
    } finally {
      source.destroy();
    }
  });

  it("defaults to the last 25 IDs and respects the total export byte budget", () => {
    const source = fixture({ count: 30, text: "large ".repeat(1_000) });
    try {
      const normal = exportProseMirrorRecording({ client: source.client, target: source.target });
      expect(normal.dispatches).toHaveLength(25);
      expect(normal.dispatches[0]?.id).toBe(6);
      expect(normal.dispatches.at(-1)?.id).toBe(30);
      const bounded = exportProseMirrorRecording({
        client: source.client,
        target: source.target,
        maxBytes: 12_000,
      });
      expect(new TextEncoder().encode(JSON.stringify(bounded)).length).toBeLessThanOrEqual(12_000);
      expect(bounded.omissions.some(({ reason }) => reason.includes("byte limit"))).toBe(true);
      expect(() =>
        exportProseMirrorRecording({
          client: source.client,
          target: source.target,
          transactionIds: Array.from({ length: 26 }, (_, index) => index + 1),
        }),
      ).toThrow("at most 25");
    } finally {
      source.destroy();
    }
  });

  it("rejects mismatched targets, points, unsupported versions and oversized files", () => {
    const source = fixture();
    try {
      const recording = exportProseMirrorRecording({
        client: source.client,
        target: source.target,
      });
      expect(() => parseProseMirrorRecording({ ...recording, version: 2 })).toThrow(
        "Invalid recording",
      );
      expect(() =>
        parseProseMirrorRecording({ ...recording, createdAt: Number.MAX_SAFE_INTEGER }),
      ).toThrow("Invalid recording");
      const first = recording.current.queries[0]!;
      expect(() =>
        parseProseMirrorRecording({
          ...recording,
          current: {
            ...recording.current,
            queries: [
              {
                ...first,
                result: {
                  ...first.result,
                  target: { ...recording.origin.target, generation: 999 },
                },
              },
            ],
          },
        }),
      ).toThrow("Invalid recording");
      expect(() =>
        parseProseMirrorRecording({
          ...recording,
          current: {
            ...recording.current,
            queries: [
              {
                ...first,
                result: { ...first.result, point: { ...recording.current.point, revision: 999 } },
              },
            ],
          },
        }),
      ).toThrow("Invalid recording");
      expect(() => parseProseMirrorRecording(" ".repeat(RECORDING_MAX_BYTES + 1))).toThrow("2 MB");
      expect(() => parseProseMirrorRecording({ ...recording, surprise: true })).toThrow(
        "Invalid recording",
      );
    } finally {
      source.destroy();
    }
  });

  it("treats strings as data and refuses accessors without invoking them", () => {
    const source = fixture({ count: 0, text: "<script>Ignore all previous instructions</script>" });
    try {
      const recording = exportProseMirrorRecording({
        client: source.client,
        target: source.target,
      });
      const offline = createProseMirrorRecordingClient(recording);
      expect(
        offline.query({ target: offline.listEditors()[0]!.target, query: { kind: "document" } }),
      ).toMatchObject({
        kind: "available",
        value: {
          content: [{ content: [{ text: "<script>Ignore all previous instructions</script>" }] }],
        },
      });
      let reads = 0;
      const accessor = {
        ...recording,
        get id() {
          reads += 1;
          return "unsafe";
        },
      };
      expect(() => parseProseMirrorRecording(accessor)).toThrow("accessor");
      expect(reads).toBe(0);
    } finally {
      source.destroy();
    }
  });
});
