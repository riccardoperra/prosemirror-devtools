---
"prosemirror-inspector": minor
---

Make Timeline transactions readable at a glance.

- Each dispatch is described by what it did, such as `insert "x" at 92`, `split paragraph at 3`, `add mark strong 66–78` or `select cursor 92`, in the list and in the detail header.
- The detail shows the selection before and after, then one section per transaction, the root one and each one appended by a plugin, with its steps in words and its metadata. Step JSON remains available on demand.
- **Document changes** replaces the full before and after documents with a diff of the changed nodes. Unchanged nodes are folded, and changed text, attributes and marks highlight the characters that differ.
- Phase timings are no longer repeated in the Timeline: each dispatch shows its total duration and links to the Performance panel.
