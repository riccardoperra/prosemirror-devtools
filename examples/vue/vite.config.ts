import { defineConfig, mergeConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { showcaseConfig } from "../vite-showcase.ts";
export default mergeConfig(
  defineConfig({
    plugins: [vue()],
    resolve: { dedupe: ["vue"] },
    server: { port: 4177 },
  }),
  showcaseConfig(["vue"]),
);
