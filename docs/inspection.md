# Inspection evidence and capture

The inspection client reads the same session and transaction records as the panel. It does not
attach a second recorder. A semantic inspector can run without a panel.

## Targets and observation points

A target contains `sourceId`, `editorId`, `sessionId`, and `generation`. A replacement editor gets
a new generation even when the application reuses its public editor ID. A stale target returns
`expired`. It never selects the replacement editor automatically.

`client.pin({ target })` captures a current read point. Pass that point to `client.read` for related
queries. A dispatch, state change, or diagnostics update can expire the point. Discover and pin a
new point explicitly. Historical points select a retained dispatch and its `before` or `after` phase.

A point pins the editor state. External storage, Yjs, and transport signals carry their own sample
or sequence. They can change outside a ProseMirror dispatch. The point does not freeze those sources.

The panel keeps this selection within its host. Changing the active editor in one panel does not
change another host or an agent's explicit target. The visible Transactions tab retains the public
panel ID `history`. Rendering retains `decorations`.

## Evidence and coverage

An inspection response contains `target`, `point`, and `coverage`, with one evidence state.

| State         | Meaning                                                         |
| ------------- | --------------------------------------------------------------- |
| `available`   | A bounded value was observed at the declared point.             |
| `unsupported` | The integration or installed provider does not offer this read. |
| `disabled`    | The diagnostic channel is disabled for this session.            |
| `unobserved`  | The required observation was not captured.                      |
| `expired`     | The target, point, or retained record is no longer valid.       |
| `error`       | Reading or serializing the requested scope failed.              |

An empty trace does not prove that no event occurred. Coverage records paused, evicted, and cleared
intervals. It also records truncation and query limits. Gaps can make a trace assertion inconclusive
while a current document assertion still has enough evidence.

The [query reference](./inspection-queries.md) derives its descriptions and limits from the public
catalogue. Public TypeScript contracts are exported from `prosemirror-inspector/core`.

## Retention and serialization

`captureProfile: "bounded"` retains up to 200 dispatches by default. The existing default remains
unbounded for transaction history. `createBoundedCaptureProfile` sets per-channel budgets.
`pauseCapture()` stops detailed dispatch capture, and `resumeCapture()` continues it. Current state
identity still advances during the pause. A gap identifies the omitted interval.

Queries copy JSON data without executing application getters or `toJSON` methods. Opaque objects,
cycles, accessors, oversized strings, and exhausted budgets return explicit errors. Query limits
can reduce the defaults. Smaller document position ranges can make a large document inspectable.

The canonical recorder retains immutable document roots for selected historical document queries.
It does not retain complete historical `EditorState` objects. Arbitrary historical plugin state
requires `createPluginStateInspector` and an explicit semantic serializer. Its captured before and
after projections remain distinct from the plugin's current live state.

## Observed provenance

One application dispatch produces one dispatch record. Applied root and appended transactions can
appear inside that record. Filter and append relations describe actual observed hook calls. A
custom dispatcher can leave the application outcome unknown. The recorder preserves that outcome
rather than running hooks again.

Named commands require `diagnostics.traceCommand`. Instrumented keymap handlers, paste handlers,
and composition events identify observed callback outcomes. A `false` result has no invented
explanation. Deferred asynchronous work does not inherit synchronous causal attribution.
Clipboard contents, typed text, DOM targets, and event objects are excluded from event metadata.

Handler events, decorations and NodeViews come only from plugins passed through
`session.instrumentPlugins`. When diagnostics are enabled but no plugins were instrumented (for
example an attach-only session), the `events`, `decorations` and `nodeViews` capabilities report
`unobserved` with that reason, and so do their queries. An `events` read that contains traced
commands stays `available` with a coverage note that handler calls are excluded. The panel shows
the same limitation in Context and Events. An empty trace from an instrumented session keeps the
generic reason: it does not prove that the event never happened.

Rendering diagnostics describe the latest observed decorations and NodeView lifecycle. They do not
rerun rendering callbacks. Historical reads return `unobserved` when that channel did not retain a
snapshot. Stale positions cannot highlight the current document.

Timings measure synchronous work within the recorded boundary. They do not measure browser paint,
compositing, delayed framework commits, or network latency.

## Semantic providers

Providers use `ProseMirrorInspector` and publish versioned descriptors, prerequisites, and bounded
projections. The session owns provider capture. A provider does not attach another dispatcher.

| Provider         | Public entry                               | Observations                                                                                                 |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Official history | `prosemirror-inspector/inspectors/history` | Public undo and redo depths, history transaction classification, and `addToHistory` metadata.                |
| Plugin state     | `prosemirror-inspector/core`               | Application-defined semantic values, captured before and after a dispatch.                                   |
| Tiptap           | `prosemirror-inspector/inspectors/tiptap`  | Active extensions, inherited priorities, bounded options, storage samples, and explicit plugin associations. |

History dispatches differ from undo events. A history restore is a normal application transaction.
The provider does not expose private undo branches or infer undo direction from a transaction flag.
Tiptap storage is sampled on a query or dispatch. Changes between samples remain unobserved.
Extension authors can supply known plugin keys. No universal extension-to-plugin mapping is inferred.

## Collaboration sources

`createCollabInspector({ plugin, transport })` uses public `getVersion` and `sendableSteps` APIs.
Original transaction metadata refers to transactions before any rebase. It does not identify a
network request. `createTransportObserver` accepts actual application transport signals with explicit
message IDs and optional observed dispatch links. Its projection retains counters and the latest
signal. The session captures historical projections at dispatch boundaries.

`createYjsInspector({ document, getUndoManager, transport })` observes a real Y.Doc and its binding's
own UndoManager. The application disposes that observer with its editor or provider. Yjs update
signals and ProseMirror dispatches have independent timing. A dispatch projection can precede a
completed Yjs redo-stack change. A current query samples the current stack.

The Tiptap collaborative fixture disables StarterKit's ordinary undoRedo extension and uses the
collaboration binding's undo system. An absent Yjs undo manager returns `unobserved`; it is never
replaced with prosemirror-history or prosemirror-collab data. Connection and acknowledgement state
require actual application provider signals. No provider-specific networking is inferred.
