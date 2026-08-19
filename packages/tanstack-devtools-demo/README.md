# TanStack Devtools demo

A private, editor-first Vite playground for the `prosemirror-devtools`
workspace package. It registers a ProseMirror view and mounts the ProseMirror
panel inside TanStack Devtools. The demo uses React 19 and explicitly deduplicates
React and ReactDOM while consuming the linked workspace package.

Start the library watcher and demo together from the workspace root with:

```sh
pnpm dev
```

The playground includes history and keymap plugins, a custom word-count plugin,
and an optional slow-transaction plugin. Turn on **Slow transaction**, edit the
document, then open the TanStack Devtools launcher in the lower-right corner to
inspect state, plugin data, and timing bars. Its **Integration** tab is an
application-provided React extension panel that subscribes to live editor data
and dispatch events, navigates the host, and calls the public data actions. The
editor uses a synchronous custom `dispatchTransaction` so that path is covered
by the demo as well.
