import { defineConfig, mergeConfig } from "vite";
import solid from "vite-plugin-solid";
import { showcaseConfig } from "../vite-showcase";
export default mergeConfig(
  defineConfig({
    plugins: [solid()],
    resolve: { dedupe: ["solid-js"] },
    server: { port: 4176 },
  }),
  showcaseConfig(["solid"]),
);
