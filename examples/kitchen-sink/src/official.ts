import { createDiagnosticDemoPlugin } from "@prosemirror-devtools/demo-kit/diagnostic-plugin";
import { collab, receiveTransaction, sendableSteps } from "prosemirror-collab";
import { baseKeymap } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { schema } from "prosemirror-schema-basic";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { createProseMirrorDevtoolsSession } from "prosemirror-inspector/core";
import { createCollabInspector } from "prosemirror-inspector/inspectors/collab";
import { createHistoryInspector } from "prosemirror-inspector/inspectors/history";
import { createTransportObserver } from "prosemirror-inspector/inspectors/transport";

import { textImpactInspector } from "./text-impact";

import {
  commandLabels,
  peers,
  type CollaborationFixture,
  type FixtureOptions,
  type Peer,
} from "./types";
import { devtoolsEnabled } from "./env";

export function mountOfficial({
  containers,
  store,
  changed,
  queued,
  instrumentPlugins,
}: FixtureOptions): CollaborationFixture {
  const pending = new Set<Peer>();
  let version = 0;
  let messageSequence = 0;
  let active = true;
  let authority = schema.node(
    "doc",
    null,
    schema.node("paragraph", null, schema.text("Shared document.")),
  );
  const createPeer = (peer: Peer) => {
    const transport = devtoolsEnabled ? createTransportObserver() : undefined;
    const plugin = collab({ clientID: peer });
    const undoPlugin = history();
    const session = devtoolsEnabled
      ? createProseMirrorDevtoolsSession({
          id: `official-${peer}`,
          label: `Official collab ${peer}`,
          store,
          diagnostics: true,
          performanceMarks: false,
          captureProfile: "bounded",
          inspectors: [
            createCollabInspector({ plugin, ...(transport ? { transport } : {}) }),
            createHistoryInspector({ plugin: undoPlugin }),
            textImpactInspector,
          ],
        })
      : null;
    const plugins = [
      plugin,
      undoPlugin,
      keymap({ "Mod-z": undo, "Mod-Shift-z": redo, "Mod-y": redo }),
      keymap(baseKeymap),
      createDiagnosticDemoPlugin({ blockExamples: true }),
    ];
    const view = new EditorView(containers[peer], {
      state: EditorState.create({
        schema,
        doc: authority,
        plugins: session && instrumentPlugins ? session.instrumentPlugins(plugins) : plugins,
      }),
      attributes: { role: "textbox", "aria-label": `Official collab editor ${peer}` },
      dispatchTransaction(transaction) {
        view.updateState(view.state.applyTransaction(transaction).state);
        if (active && sendableSteps(view.state)) {
          pending.add(peer);
          queued();
        }
        changed();
      },
    });
    session?.attach(view);
    transport?.observe({ kind: "connection", state: "connected" });
    return { transport, view, session };
  };
  const clients = { A: createPeer("A"), B: createPeer("B") };
  return {
    inspectorId: "prosemirror-collab",
    flush() {
      while (active && pending.size > 0) {
        const peer = pending.values().next().value;
        if (!peer) break;
        pending.delete(peer);
        const sender = clients[peer];
        const batch = sendableSteps(sender.view.state);
        if (!batch) continue;
        const messageId = `steps-${++messageSequence}`;
        sender.transport?.observe({
          kind: "send",
          messageId,
          payload: { kind: "steps", version: batch.version, count: batch.steps.length },
          dispatch: { kind: "unknown" },
        });
        if (batch.version !== version)
          throw new Error(
            "The in-memory authority requires the client's confirmed version before accepting steps.",
          );
        for (const step of batch.steps) {
          const result = step.apply(authority);
          if (!result.doc) throw new Error(result.failed ?? "The authority rejected a step.");
          authority = result.doc;
        }
        const fromVersion = version;
        version += batch.steps.length;
        for (const recipient of peers) {
          const client = clients[recipient];
          client.transport?.observe({
            kind: "receive",
            messageId,
            payload: { kind: "steps", version: fromVersion, count: batch.steps.length },
            dispatch: { kind: "unknown" },
          });
          const receive = () => {
            client.view.dispatch(
              receiveTransaction(
                client.view.state,
                batch.steps,
                batch.steps.map(() => batch.clientID),
              ),
            );
            return true;
          };
          const diagnostics = client.session?.diagnostics;
          if (diagnostics) {
            const action = recipient === peer ? "Confirm" : "Receive";
            diagnostics.traceCommand(`Collab: ${action} ${messageId}`, receive);
          } else receive();
          if (recipient === peer)
            client.transport?.observe({
              kind: "acknowledge",
              messageId,
              confirmedVersion: version,
              dispatch: { kind: "unknown" },
            });
        }
      }
      changed();
    },
    runCommand(peer, command) {
      const { view, session } = clients[peer];
      const run = () => {
        if (command === "undo" || command === "redo")
          return { undo, redo }[command](view.state, view.dispatch, view);
        const { $from } = view.state.selection;
        const at = $from.parent.isTextblock ? $from.end() : $from.pos;
        const transaction = view.state.tr.insertText(
          command === "sampleExcluded"
            ? " Edit outside undo history."
            : ` Sample from peer ${peer}.`,
          at,
        );
        if (command === "sampleExcluded") transaction.setMeta("addToHistory", false);
        view.dispatch(transaction);
        return true;
      };
      if (session?.diagnostics) session.diagnostics.traceCommand(commandLabels[command], run);
      else run();
    },
    setPaused(peer, paused) {
      if (paused) clients[peer].session?.pauseCapture();
      else clients[peer].session?.resumeCapture();
    },
    status: () => `Confirmed version ${version}. Waiting to send · ${pending.size} of 2 peers.`,
    dispose() {
      active = false;
      pending.clear();
      for (const peer of peers) {
        clients[peer].session?.dispose();
        clients[peer].view.destroy();
      }
    },
  };
}
