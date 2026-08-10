import { defineConfig } from "tsdown";

const isWatchMode = process.argv.includes("--watch");

export default defineConfig({
  entry: ["src/index.ts", "src/core.ts", "src/performance.ts", "src/tanstack.tsx", "src/tiptap.ts"],
  format: "esm",
  dts: true,
  sourcemap: true,
  clean: !isWatchMode,
  platform: "browser",
  deps: {
    // Keep the chart renderer in the lazy performance chunk. In particular,
    // this prevents a consumer bundler from resolving react-charts against a
    // second React installation when this package is linked in a workspace.
    alwaysBundle: [
      /^@tanstack\/charts(?:\/|$)/,
      /^@tanstack\/react-charts(?:\/|$)/,
      /^d3-scale(?:\/|$)/,
    ],
    onlyBundle: [
      "@tanstack/charts",
      "@tanstack/react-charts",
      "d3-array",
      "d3-color",
      "d3-format",
      "d3-interpolate",
      "d3-scale",
      "d3-shape",
      "internmap",
    ],
    neverBundle: [
      /^@tanstack\/react-devtools/,
      /^prosemirror-/,
      /^react(?:\/|$)/,
      /^react-dom(?:\/|$)/,
    ],
  },
});
