---
"prosemirror-inspector": patch
---

The Rendering panel now records Tiptap node views. Tiptap 3 passes node views from `addNodeView`, including `ReactNodeViewRenderer`, to the EditorView directly rather than through a plugin, so they were never observed. `setupTiptapDevtools` now instruments them with the same create, update and destroy records as plugin node views, listed under the "Tiptap node views" source. `instrumentPlugins: false` turns this off too.
