# Svelte example

A private Vite example showing `prosemirror-devtools/svelte` inside TanStack Svelte Devtools.

Turn on **slow apply**, edit the document, then open the launcher in the lower-right corner to
inspect state, transactions, plugins, and performance.

```sh
pnpm --filter @prosemirror-devtools/svelte-demo dev
```

See [`src/App.svelte`](./src/App.svelte) for the TanStack plugin and
[`src/ProseMirrorEditor.svelte`](./src/ProseMirrorEditor.svelte) for the editor lifecycle.
