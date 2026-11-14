# Vue example

A private Vite example showing `prosemirror-inspector/vue` inside TanStack Vue Devtools.

Turn on **slow apply**, edit the document, then open the launcher in the lower-right corner to
inspect state, transactions, plugins, and performance.

```sh
pnpm --filter @prosemirror-devtools/vue-demo dev
```

See [`src/App.vue`](./src/App.vue) for the TanStack plugin and
[`src/ProseMirrorEditor.vue`](./src/ProseMirrorEditor.vue) for the editor lifecycle.
