---
"prosemirror-inspector": minor
---

`createYjsInspector` labels which dispatch is a remote Yjs change. Pass the binding's `syncPluginKey`, such as `ySyncPluginKey` from `y-prosemirror` or `@tiptap/y-tiptap`, and each captured dispatch carries `dispatchOrigin`: `local`, `remote-yjs`, `yjs-undo-redo`, `yjs-local-transaction`, `yjs-render` or `yjs-snapshot`, for the root transaction and each appended one. The Timeline shows `Remote · Yjs` on dispatches the binding applied from a remote update. Without the key, `dispatchOrigin` is `unobserved` and the panel keeps the sampled update text.
