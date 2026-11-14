import { defineConfig, mergeConfig } from "vite";
import preact from "@preact/preset-vite";
import { showcaseConfig } from "../vite-showcase.ts";
export default mergeConfig(
  defineConfig({
    plugins: [preact({ reactAliasesEnabled: false })],
    resolve: { dedupe: ["preact"] },
    server: { port: 4175 },
  }),
  showcaseConfig(["preact"]),
);
