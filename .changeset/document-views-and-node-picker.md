---
"prosemirror-inspector": minor
---

Add new ways to read a document in the State panel and to find a node from the editor.

- The new default **Boxes** view shows block nodes as nested boxes and inline content as a row of chips, each with its marks and range.
- The **DOM** view replaces the **HTML** view. For the live editor it shows the rendered DOM and labels each element as a node with its before and after positions, a mark with the range it wraps, a widget, or something outside the document, such as NodeView chrome or a decoration wrapper. Every text node shows its range, and a legend explains the labels. When the panel shows a state that the editor does not render, the view shows the schema's HTML export without positions.
- The toolbar node picker (⌖) outlines the node under the pointer in the editor. Click a node to inspect it in the State panel, or press Escape to cancel.
- Hover a row in the Structure, Boxes, or DOM view to outline its node in the live editor.
