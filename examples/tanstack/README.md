# React example

A private Vite example showing `prosemirror-inspector/react` inside TanStack React Devtools.

The editor includes history, keymaps, word count, a synchronous custom dispatcher, and an optional
slow plugin. Turn on **slow apply**, edit the document, then open the launcher in the lower-right
corner to inspect the resulting state, transactions, and timings.

The example also adds an application-owned **Integration** tab to demonstrate panel extensions,
live data subscriptions, and devtools actions.

In development, [`src/webmcp.ts`](./src/webmcp.ts) exposes the read-only inspection tools through
native WebMCP and the Chrome DevTools MCP bridge. The **WebMCP** tab records every tool call.

```sh
pnpm --filter @prosemirror-devtools/tanstack-demo dev
```

Start with [`src/App.tsx`](./src/App.tsx) for the TanStack plugin and
[`src/ProseMirrorEditor.tsx`](./src/ProseMirrorEditor.tsx) for editor registration and plugin
instrumentation.
