import { afterEach, describe, expect, it, vi } from "vitest";

import { createProseMirrorAgentTools, installProseMirrorChromeBridge } from "../src/agent";
import {
  createProseMirrorDevtoolsSession,
  createProseMirrorDevtoolsStore,
  createProseMirrorInspectionClient,
} from "../src/core";
import { appendTextTransaction, createTestState, createTestView } from "./helpers";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  document.body.replaceChildren();
});

function setup() {
  const store = createProseMirrorDevtoolsStore();
  const session = createProseMirrorDevtoolsSession({
    id: "agent-editor",
    store,
    performanceMarks: false,
  });
  const view = createTestView(createTestState("hello"));
  session.attach(view);
  cleanups.push(
    () => view.destroy(),
    () => session.dispose(),
  );
  const client = createProseMirrorInspectionClient({ store });
  const target = client.listEditors()[0]?.target;
  if (!target) throw new Error("The real editor is missing.");
  const tools = createProseMirrorAgentTools(client);
  const execute = (name: string, args: unknown): unknown => {
    const tool = tools.tools.find((entry) => entry.name === name);
    if (!tool) throw new Error(`Missing ${name}.`);
    return tool.execute(args);
  };
  return { client, target, tools, execute, view };
}

describe("agent inspection tools", () => {
  it("discovers the shared catalogue and returns serializable evidence for an explicit target", () => {
    const { client, target, execute } = setup();
    expect(execute("prosemirror_catalog", {})).toEqual(client.catalog());
    expect(execute("prosemirror_editors", {})).toMatchObject({
      editors: [{ target }],
      truncated: false,
    });
    const result = execute("prosemirror_inspect", { target, query: { kind: "document" } });
    expect(result).toMatchObject({ kind: "available", target, value: { type: "doc" } });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("checks expectations without changing editor state and distinguishes missing trace evidence", () => {
    const { target, execute, view } = setup();
    expect(
      execute("prosemirror_check", {
        request: { target, query: { kind: "document" } },
        assertion: {
          path: ["content", 0, "content", 0, "text"],
          predicate: { kind: "equals", expected: "hello" },
          completeness: "value",
        },
      }),
    ).toMatchObject({ kind: "passed" });
    expect(
      execute("prosemirror_check", {
        request: { target, query: { kind: "events" } },
        assertion: { predicate: { kind: "exists" }, completeness: "capture" },
      }),
    ).toMatchObject({ kind: "inconclusive", missing: ["disabled"] });
    expect(view.state.doc.textContent).toBe("hello");
  });

  it("requires explicit availability for nested evidence values", () => {
    const { client, target, execute } = setup();
    const eventIndex = client.catalog().queries.findIndex((query) => query.kind === "events");
    expect(eventIndex).toBeGreaterThanOrEqual(0);
    expect(
      execute("prosemirror_check", {
        request: { target, query: { kind: "capabilities" } },
        assertion: {
          path: [eventIndex, "evidence", "value"],
          requiredEvidence: [[eventIndex, "evidence"]],
          predicate: { kind: "equals", expected: true },
          completeness: "value",
        },
      }),
    ).toMatchObject({ kind: "inconclusive" });
    expect(
      execute("prosemirror_check", {
        request: { target, query: { kind: "capabilities" } },
        assertion: {
          path: [0, "id"],
          requiredEvidence: [[0, "evidence"]],
          predicate: { kind: "exists" },
          completeness: "value",
        },
      }),
    ).toMatchObject({ kind: "passed" });
    expect(
      execute("prosemirror_check", {
        request: { target, query: { kind: "capabilities" } },
        assertion: {
          requiredEvidence: Array.from({ length: 33 }, () => []),
          predicate: { kind: "exists" },
          completeness: "value",
        },
      }),
    ).toMatchObject({ kind: "error" });
  });

  it("rejects malformed requests and never retargets an expired observation", () => {
    const { client, target, execute, view } = setup();
    for (const query of [
      { kind: "selection", from: 1 },
      { kind: "transaction" },
      { kind: "document", from: -1 },
    ]) {
      expect(execute("prosemirror_inspect", { target, query })).toMatchObject({ kind: "error" });
    }
    expect(
      execute("prosemirror_inspect", { target, query: { kind: "document" }, script: "ignored" }),
    ).toMatchObject({ kind: "error" });
    const pinned = client.pin({ target });
    if (pinned.kind !== "available") throw new Error("The live point must be available.");
    view.dispatch(appendTextTransaction(view.state, "!"));
    expect(
      execute("prosemirror_read", { point: pinned.value, query: { kind: "document" } }),
    ).toMatchObject({ kind: "expired" });
    expect(view.state.doc.textContent).toBe("hello!");
  });

  it("responds only to opted-in Chrome discovery and removes its listener on cleanup", () => {
    const { client } = setup();
    const target = new EventTarget();
    const respondWith = vi.fn();
    const event = new Event("devtoolstooldiscovery");
    Object.defineProperty(event, "respondWith", { value: respondWith });
    const dispose = installProseMirrorChromeBridge(client, { target });
    target.dispatchEvent(event);
    expect(respondWith).toHaveBeenCalledOnce();
    expect(respondWith.mock.calls[0]?.[0]).toMatchObject({ name: "ProseMirror Inspector" });
    dispose();
    dispose();
    target.dispatchEvent(event);
    expect(respondWith).toHaveBeenCalledOnce();
  });
});
