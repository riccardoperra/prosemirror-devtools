---
"prosemirror-inspector": minor
---

`createHistoryInspector()` no longer needs the `history()` plugin. Without a `plugin` option it finds the installed history plugin in each state it reads, so Tiptap apps can register it in `onBeforeCreate`, before StarterKit's UndoRedo installs history. It reports `unsupported` when no history plugin is installed. Passing `{ plugin }` still inspects that specific instance.
