---
"prosemirror-inspector": minor
---

Add `createTiptapDevtoolsHooks` so a Tiptap extension wires the inspector by spreading four hooks into `Extension.create`. The package no longer depends on `@tiptap/core`, not even as an optional peer: `createTiptapInspector` reads the editor structurally.
