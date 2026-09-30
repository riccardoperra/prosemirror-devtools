# Devtools review and panel roadmap

The current separation between the framework-neutral recorder, Solid panel, feature models, and
framework adapters is useful. Keep it. This pass concentrates on work performed during dispatch,
mount/update/teardown behavior, and inspectors that remain usable inside a small TanStack pane.

## Implemented

| Area                | Change                                                                                                                                        | Why it matters                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selection           | New built-in Selection panel                                                                                                                  | Exposes anchor/head ancestry, offsets, content boundaries, node boundaries, ranges, adjacent nodes and marks without manually resolving positions in the console. |
| Panel layout        | Embedded height follows its host; narrow splits keep two scrollable panes; long labels can shrink                                             | A long document or history list no longer pushes the detail pane beyond the visible host area.                                                                    |
| Navigation          | Stable tab refs by ID, Home/End, directional arrows, RTL support, active-tab scrolling                                                        | Extension registry changes no longer leave keyboard navigation pointing at the wrong tab.                                                                         |
| JSON inspection     | Lazy property reads, one read per visible property/update, 100-child pages, per-property error handling                                       | Collapsed plugin state avoids evaluating its children; wide values do not create thousands of DOM rows on mount.                                                  |
| Dispatch inspection | Closed transaction payloads and document disclosures do not mount their JSON trees                                                            | Inspecting history does not serialize before/after documents until requested.                                                                                     |
| State inspection    | Lazy document statistics cached by immutable document identity; selected node JSON and schema inspection use stable identity                  | Cursor-only transactions avoid repeated whole-document text scans and selected-document serialization.                                                            |
| Instrumentation     | Wrapper cache includes instance/session/label; rewrapping uses the original plugin; lifecycle callbacks are weakly held through their wrapper | Sharing plugins between editor lifecycles cannot silently reuse the wrong recorder or retain a dead editor through a cache callback.                              |
| Node views          | Property getters use the original NodeView receiver                                                                                           | Class-based NodeViews with private fields remain compatible with instrumentation.                                                                                 |
| Store               | Registration leases target their original entry; dispatch listeners are snapshotted before delivery                                           | Stale cleanup cannot remove a replacement registration, and listeners can safely rebind during delivery.                                                          |
| History             | Common append skips an insertion scan; nested completion uses binary search; summary maximum uses iteration                                   | Avoids extra history scans and argument-limit crashes for large retained sessions.                                                                                |
| Framework hosts     | Stable mount plus explicit prop updates; teardown does not depend on a surviving DOM ref                                                      | React, Preact, Vue and Angular appearance updates preserve panel state; Solid getter props remain reactive; Svelte disposes with its host.                        |
| Tiptap              | Detached chained getters stop recording; cleanup releases ownership even on errors                                                            | A retained wrapper cannot reattach a destroyed integration.                                                                                                       |
| Snapshots           | Async imports verify the original editor and owner before publishing                                                                          | Switching editors or closing the panel while a file loads cannot put that snapshot into a different editor.                                                       |

The public `defaultPanel` / `activePanel` navigation contract also accepts `"selection"`, `"events"`,
and `"decorations"`. Framework
adapters retain their existing public signatures. Extensions receive fresh host context on theme
changes and may therefore remount their own contents; the surrounding panel retains its state.

## Implemented debugging tools

### 1. Changes & mapping

Answer: **Which step changed this position, and why did my selection move?**

History now has a Changes & mapping detail mode with lazy per-step content diffs, each step's
old/new ranges, and a position probe showing deletion flags and association direction. Appended
transactions remain in application order. Normalized StepMap ranges and mirror indexes are captured
when recording, so custom steps do not need JSON reconstruction. Empty maps still expose mark and
attribute changes. Root attribute changes show whole documents. Filtered and unobserved custom
dispatches do not claim applied mapping results. Intermediate immutable documents are retained
until the corresponding diff is inspected or the record is released.

### 2. Decorations & node views

Answer: **Which plugin draws this highlight or widget, and which node view keeps updating?**

The new Decorations & node views panel filters observed ranges by plugin and inline/node/widget
type, highlights current ranges, and shows NodeView creation/update/destruction counts and durations.
Capture observes existing plugin calls without invoking them again. Old-document results are marked
stale and cannot be highlighted. Overlays live in the editor's document, including when the panel
is popped out, and are removed on cleanup. DOM nodes are not retained in diagnostic snapshots.

### 3. Events & commands

Answer: **Who handled this key or paste, and why did the command stop?**

The new Events & commands panel shows wrapped handled props and DOM handlers in invocation order,
with their boolean outcomes, errors, duration, nested callers, and synchronous dispatch IDs. Calls
without transactions still appear. Applications name commands with `diagnostics.traceCommand`;
there is no automatic command registry. Capture excludes DOM events and clipboard/text payloads,
uses independent subscriptions, and supports source/outcome/search filters and 100-row pages.

Events and rendering diagnostics are opt-in via `diagnostics: true` or `{ limit: 200 }` on a devtools
session. The limit separately bounds events, NodeViews, decoration sources, ranges per source, and
dispatch references per event. A shared lower-level controller can be passed through instrumentation,
attachment, Tiptap, and framework registration APIs. It should belong to one editor lifecycle.

## Deferred

### Collaboration

Answer: **Is this change local, remote, rebased, or still unconfirmed?**

Deferred at the user's request. A future panel can show local/remote transaction origin, unconfirmed step count, version, mapped selection, and
provider connection state on one timeline. Implement provider-specific extensions for
`prosemirror-collab`, Yjs, or the application's transport using the existing data/marker contracts.
The core recorder cannot infer transport acknowledgments or provider state from generic steps.

## Further improvements

- Add explicit capture profiles and pause/resume with visible gap markers. A lightweight mode could
  retain dispatch summaries while detailed hook timings and payloads are enabled on demand.
- Offer an opt-in retention preset in the toolbar. History remains unbounded by default for
  compatibility, and every dispatch still copies its retained immutable array. Binary insertion
  removes a search cost, not that allocation; a chunked store needs separate API/design work.
- Consider a resizable inspector divider with per-host persistence after checking interaction with
  TanStack's own splitters. The current responsive split deliberately has no new persisted settings.
- Add browser-based CI coverage for short/narrow TanStack panels and the framework demo mounts.
  Unit tests cannot validate real layout or every host-specific teardown order.
- Replace the Svelte utility wrapper with a compiled component for reactive host prop updates and
  development SSR. This pass fixes its teardown; those broader integration capabilities remain future work.
- Benchmark large documents and long sessions before claiming a percentage improvement. The
  current tests establish avoided work and correctness, not representative end-to-end speedups.

## Verification scope

The review covered runtime recording, instrumentation, serialization, the panel shell and feature
views, framework adapters, Tiptap lifecycle helpers, demos, package exports, and workspace checks.
Regression coverage exercises lazy document access, wide/getter-based JSON, backward/node/all
selections, stale async imports, plugin reuse, registration replacement, listener rebinding,
large performance summaries, adapter updates/cleanup, and changing tab registries.

Snapshot storage remains browser-local and history timing remains synchronous dispatch timing.
Async editor work, browser paint, collaboration transport state, and complete command provenance
are outside the existing recorder's guarantees.

Validation for this pass: workspace builds and typechecks, the test suite, lint, formatting, and
package export validation (`publint`). Manual browser checks cover live editing, Selection,
History, Performance, the diagnostic panels, and a 420px-wide embedded host with independently
scrolling panes. Mapping tests compare boundary/association behavior with ProseMirror, including
appended steps, custom steps, mirrored maps, and mark/document-attribute changes. Capture tests cover
payload exclusion, bounded retention, handler returns/errors, staleness, overlays, and teardown.
