---
"prosemirror-devtools": minor
---

Expose UI-independent plugin timing aggregation and related types from the new
`prosemirror-devtools/performance` feature entrypoint.

Add dependency-free `prosemirror-devtools/tiptap` lifecycle helpers that instrument Tiptap's
generated ProseMirror plugins, register its view, record through Tiptap 3's native transaction
middleware, and clean up from an application-owned Tiptap extension.

Add development-safe TanStack Devtools adapters for React, Preact, Solid, Vue, Svelte, and Angular,
with explicit production entrypoints.

Replace the stateful registry API with a functional devtools store, granular subscriptions, lazy
transaction detail serialization, versioned local snapshots, and a container-responsive panel.
