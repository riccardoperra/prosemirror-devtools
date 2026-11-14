import { defineConfig, mergeConfig } from "vite";
import { showcaseConfig } from "../vite-showcase.ts";

export default mergeConfig(
  defineConfig({
    server: { port: 4180, strictPort: true },
  }),
  showcaseConfig(["standalone", "recordings-panel"]),
);
