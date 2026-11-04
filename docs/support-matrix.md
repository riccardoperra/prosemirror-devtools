# Support matrix

This matrix describes the working branch. New capabilities are unreleased until a package release
includes them. The product roadmap records proposed scope. The execution ledger records checks.

## Editor integrations

| Editor system     | Versions used by native fixtures                                                                | Capture path                                                                          | Verification                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| ProseMirror       | model 1.25.12, state 1.4.4, transform 1.12.2, view 1.42.3                                       | Session before plugins, then attach. Attach-only is also supported.                   | Real EditorView capture, input, history, and lifecycle tests. Standalone browser fixture. |
| Tiptap            | core, react, starter-kit, pm, and collaboration 3.31.4                                          | Dedicated middleware and editor lifecycle. Optional generated-plugin instrumentation. | Real Editor and React Strict Mode regressions. Native browser fixture.                    |
| React ProseMirror | `@handlewithcare/react-prosemirror` 3.2.11, React and React DOM 19.2.8, react-reconciler 0.33.0 | `useEditorEffect`, application-owned controlled state, and the dedicated recorder.    | Real controlled-model, live-panel, and remount regressions. Native browser fixture.       |

React ProseMirror 3.2.11 requires ProseMirror view 1.42.3. The workspace pins a single compatible
ProseMirror runtime. Consumers must satisfy their editor's peer requirements and avoid duplicate
ProseMirror versions. A cast does not resolve incompatible `EditorView` classes.

Tiptap 2 has no native middleware verification here. Dynamically registered Tiptap plugins do not
automatically gain hook instrumentation. React ProseMirror's later React view commit remains
outside synchronous model timing.

## Collaborative providers

| System          | Native dependencies                      | Verification and limits                                                                                                                                                            |
| --------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Official collab | prosemirror-collab 1.3.1                 | Two actual EditorViews converge after concurrent edits and rebase. Paused remote receipt advances live state and leaves a capture gap. Transport signals are application-observed. |
| Yjs and Tiptap  | Yjs 13.6.33, Tiptap collaboration 3.31.4 | Two real Tiptap Collaboration bindings synchronize. Local collaborative undo preserves the peer's edit. The binding's own UndoManager supplies depths.                             |

The official collab and Yjs providers remain distinct. Neither provider guesses network causality.
External signals have independent freshness and are sampled at query or dispatch boundaries.

## Panel hosts

| Host                    | Status and checks                                                                                   | Production behavior                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Framework-neutral mount | Same Solid renderer as the adapters. Mount, update, idempotent unmount, and production no-op tests. | Disabled unless `NODE_ENV` is `development`.                   |
| React                   | Panel prop and lifecycle tests, including Strict Mode. TanStack demo.                               | Normal entry disables UI and registration outside development. |
| Preact                  | Panel prop and lifecycle tests. Native framework demo.                                              | Normal entry disables UI and registration outside development. |
| Solid                   | Getter-backed host props and cleanup tests. Native framework demo.                                  | Normal entry disables UI and registration outside development. |
| Vue                     | Reactive prop and cleanup tests. Native framework demo.                                             | Normal entry disables UI and registration outside development. |
| Svelte                  | Svelte 5 imperative mount and cleanup test. Native framework demo.                                  | Normal entry disables UI and registration outside development. |
| Angular                 | Registration cleanup and plugin tests. Native framework demo.                                       | Normal entry disables UI and registration outside development. |
| Native root panel       | Direct Solid component.                                                                             | Requires the application's development guard.                  |

The editor integration and panel host are independent choices. Framework adapter tests do not
establish native editor lifecycle support. SSR support is limited to paths covered by the repository's
checks. No blanket SSR parity is claimed for all frameworks. Explicit `<framework>/production`
entries keep their adapters active by choice. Core and Tiptap calls require a development guard.

## Capture profiles and evidence

| Profile or feature       | Available observations                                                                      | Limits                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Attach-only              | Current state, dispatches, observed application outcome, schema, and plugin order.          | Existing uninstrumented hooks are unobserved.                            |
| Instrument before state  | Hook timings, observed filter and append provenance, and diagnostic callbacks when enabled. | Replacement plugin objects preserve keys, not identity.                  |
| Diagnostics disabled     | Current state and dispatch capture remain available.                                        | Events, decorations, and NodeViews return `disabled`.                    |
| Bounded capture          | Explicit budgets, pause and resume, retention gaps, and expired references.                 | Omitted detail cannot establish a complete causal trace.                 |
| Historical state         | Retained document, selection, dispatch detail, and captured provider projections.           | No implicit current schema, arbitrary plugin state, or DOM substitution. |
| Offline recordings       | Bounded captured queries with a separate source and read-only viewer.                       | Exact captured scopes only. No replay, live restore, or DOM resolution.  |
| Agent queries and checks | Serializable bounded evidence, explicit targets, and per-expectation verdicts.              | Browser rendering requires external browser proof.                       |
| Chrome discovery bridge  | Opt-in adapter over the common agent tools.                                                 | Experimental browser and MCP support is required.                        |

## Evidence locations

The package tests cover capture, query identity, input metadata exclusion, host context, provider
projections, native editors, and checkpoint restore. Native fixtures live in `packages/standalone-demo`,
`packages/tiptap-demo`, and `packages/react-prosemirror-demo`. The
[execution ledger](./roadmap/execution.md) records final commands and scenario results.
