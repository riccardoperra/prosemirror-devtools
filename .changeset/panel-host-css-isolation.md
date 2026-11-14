---
"prosemirror-inspector": patch
---

The panel keeps its layout when the host page styles elements globally, for example `button { height: 28px }` or `* { line-height: 1 }`. Timeline rows, tab labels and controls no longer clip or change size in such hosts.
