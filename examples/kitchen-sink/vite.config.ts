import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 4183, strictPort: true },
  resolve: {
    dedupe: [
      "prosemirror-model",
      "prosemirror-state",
      "prosemirror-view",
      "prosemirror-transform",
      "yjs",
    ],
  },
});
