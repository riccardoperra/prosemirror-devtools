import { defineConfig, mergeConfig } from "vite";
import react from "@vitejs/plugin-react";
import { showcaseConfig } from "../vite-showcase";

export default mergeConfig(
  defineConfig({
    plugins: [react()],
    resolve: {
      dedupe: [
        "react",
        "react-dom",
        "prosemirror-model",
        "prosemirror-state",
        "prosemirror-view",
        "prosemirror-transform",
      ],
    },
    server: { port: 4182, strictPort: true },
  }),
  showcaseConfig(["react"]),
);
