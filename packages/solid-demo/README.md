# Solid example

A private Vite example showing `prosemirror-devtools/solid` inside TanStack Solid Devtools.

Turn on **slow apply**, edit the document, then open the launcher in the lower-right corner to
inspect state, transactions, plugins, and performance.

```sh
pnpm --filter @prosemirror-devtools/solid-demo dev
```

See [`src/App.tsx`](./src/App.tsx) for the TanStack plugin and
[`src/ProseMirrorEditor.tsx`](./src/ProseMirrorEditor.tsx) for the editor lifecycle.
