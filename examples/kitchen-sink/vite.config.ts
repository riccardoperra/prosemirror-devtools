import { defineConfig, mergeConfig } from "vite";
import { showcaseConfig } from "../vite-showcase";

export default mergeConfig(
  defineConfig({
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
  }),
  showcaseConfig(["standalone", "recordings-panel"]),
);
