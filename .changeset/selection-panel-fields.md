---
"prosemirror-inspector": minor
---

Rework the Selection panel around readable fields instead of JSON.

- The selection shows its type, range, direction, selected node and active marks, and says where the marks come from: stored marks, the cursor, or the whole selection.
- Each endpoint has its own card, or a single **Cursor** card for an empty selection, with its path, parent, offset, the nodes before and after it, and its marks. The Anchor / Head switch and the ancestors table are removed.
- Type a position in **Resolve** to inspect any position in the document.
- Click a node to inspect it in the State panel.
