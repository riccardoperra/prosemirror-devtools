# Angular example

A private Angular CLI example showing `prosemirror-devtools/angular` inside TanStack Angular
Devtools.

Turn on **slow apply**, edit the document, then open the launcher in the lower-right corner to
inspect state, transactions, plugins, and performance.

```sh
pnpm --filter @prosemirror-devtools/angular-demo dev
```

See [`src/app/app.ts`](./src/app/app.ts) for the TanStack plugin and
[`src/app/prosemirror-editor.ts`](./src/app/prosemirror-editor.ts) for the editor lifecycle.
