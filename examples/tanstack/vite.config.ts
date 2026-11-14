import { defineConfig, mergeConfig } from "vite";
import react from "@vitejs/plugin-react";
import { showcaseConfig } from "../vite-showcase";

export default mergeConfig(
  defineConfig({
    plugins: [react()],
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    server: {
      port: 4174,
    },
  }),
  showcaseConfig(["react"]),
);
