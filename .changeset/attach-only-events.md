---
"prosemirror-inspector": patch
---

Attach-only sessions now explain missing handler evidence. When diagnostics are enabled but no plugins were passed through `session.instrumentPlugins`, the `events`, `decorations` and `nodeViews` capabilities and queries report `unobserved` with that reason instead of looking available or empty. An `events` read with traced commands adds a coverage note, and the Context and Events panels show the limitation. The diagnostics snapshot exposes `instrumentation`.
