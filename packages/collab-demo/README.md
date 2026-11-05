# Run the ProseMirror Inspector kitchen sink

Build the inspector and start the demo.

```sh
pnpm --filter prosemirror-inspector build
pnpm --filter @prosemirror-devtools/collab-demo dev
```

Open [the kitchen sink on port 4183](http://localhost:4183). Both modes use two real editors connected through an in-memory application transport.

1. In **Official ProseMirror collab**, check **Hold delivery** and click **Insert sample in A**. Open **Collaboration** for editor A. It shows one pending step. Click **Deliver queued updates**. The pending count returns to zero, the confirmed version increases, and B receives the edit. Open **Undo history**, try **Undo in A** and **Redo in A**, and watch the counters change. Deliver again to propagate each change.
2. Select a dispatch in **Transactions** and open **Rendering** to inspect the inline decoration, highlighted block, widget, and paragraph NodeView. Switch to **Attach only** and repeat an edit to compare coverage with plugin instrumentation disabled.
3. Switch to **Tiptap Collaboration with Yjs** and repeat the edits and delivery. **Collaboration** shows whether the latest Yjs update was local or remote. **Undo history** shows the Yjs undo stack. Undo in A preserves B's edit. Open **Raw data** in either view to inspect the sample. Find Tiptap extension and storage samples under **Context → Technical details → Tiptap extensions data**.
4. Use **Pause capture A** to create a capture gap while collaboration continues. Use **Open another inspector** to compare two selections. In **Diagnostic recordings**, export an editor and open the exported recording to inspect it offline. Refresh the export editor list after switching modes, changing capture profiles, or resetting the fixture.

Chrome and WebMCP bridges read the same live editor sessions as the panel. The WebMCP bridge registers when the browser exposes its API. The diagnostic panel, recording controls and agent bridges are development-only.

In a wide panel, drag the divider in views such as **Transactions** and **State** to give either pane more room. You can also focus the divider and use the arrow keys.

The official fixture applies steps to an authority document and confirms them with `receiveTransaction`. Collaboration diagnostics use public `getVersion` and `sendableSteps`. The Yjs fixture uses the collaboration binding's actual UndoManager. Current provider samples can show an undo stack change that completed after the corresponding dispatch sample. Transport signals come from the in-memory transport and have their own sequence and time. Their proximity to an editor dispatch leaves the relationship unknown.
