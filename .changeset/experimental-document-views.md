---
"prosemirror-inspector": minor
---

Add an opt-in `experimental` panel option. Pass `true` to enable every experimental feature, or a list such as `["document-boxes", "node-picker"]` to enable only some. Experimental features are off by default and may change in any release.

- `document-boxes` adds a Boxes document view: block nodes as nested boxes and inline content as a flat row of chips with their marks.
- `rendered-dom` adds a DOM document view: the editor's live DOM, annotated with the node and range each element renders.
- `node-picker` adds a toolbar toggle to pick a node by pointing at it in the editor, and outlines a node in the editor when you hover it in the document views.
