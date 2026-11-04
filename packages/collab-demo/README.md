# Run the collaboration fixtures

Run `pnpm --filter @prosemirror-devtools/collab-demo dev` after building `prosemirror-inspector`. Open port 4183.

Select either the official `prosemirror-collab` transport or native Tiptap Collaboration with Yjs. Both show two real editors and an in-memory application transport. The delivery delay is explicit. **Hold delivery** lets both peers edit before **Deliver queued updates** applies the queued work.

The official authority applies real ProseMirror steps. Each peer receives confirmations through `receiveTransaction`. The inspector uses public `getVersion` and `sendableSteps`, including original transaction metadata for rebased unconfirmed steps. It does not infer network state from those transactions.

The Yjs fixture uses Tiptap 3.31.4, `@tiptap/extension-collaboration` 3.31.4, `@tiptap/y-tiptap` 3.0.12, and Yjs 13.6.33. StarterKit undo is disabled. Each binding's actual Yjs UndoManager implements **Undo in A** and **Undo in B**. Remote edits are preserved by local collaborative undo.

**Pause capture A** pauses detailed diagnostic retention while editing, transport delivery, and current provider samples continue. The capture gap remains visible through the shared inspector client. Provider samples and document signals have their own sequence and time. A signal's proximity to a dispatch does not establish causality. Transport dispatch links remain unknown unless the application observes them explicitly.

Transport observation keeps current counts and the latest signal. Historical projections belong to the editor session. Signals between retained samples are not a complete transport log. A Yjs dispatch sample may occur before an UndoManager command completes its final stack update. A current query samples the final current stack.

The development guard controls registrations, the panel, and read-only agent discovery. Production keeps the actual collaboration examples and disables diagnostics. Reset and teardown remove transport listeners, queued updates, timers, views, Yjs documents, and diagnostic registrations.
