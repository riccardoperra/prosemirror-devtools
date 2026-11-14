---
"prosemirror-inspector": minor
---

Group the panel tabs into sections. The top row shows Document, Timeline, Snapshots, Performance, Plugins and Context, followed by one section for each extension panel. Document (State, Selection, Schema), Timeline (Transactions, Events) and Plugins (Plugins, Rendering) show their panels in a second row, and selecting a section reopens the panel last used in it. Panel IDs, `defaultPanel`, `activePanel` and `onActivePanelChange` are unchanged and still use panel IDs. The transaction count moves to the Timeline section tab.
