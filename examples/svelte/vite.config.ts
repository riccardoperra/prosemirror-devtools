import { defineConfig, mergeConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { showcaseConfig } from "../vite-showcase";
export default mergeConfig(
  defineConfig({
    plugins: [svelte()],
    resolve: { dedupe: ["svelte"] },
    server: { port: 4178 },
  }),
  showcaseConfig(["svelte"]),
);
