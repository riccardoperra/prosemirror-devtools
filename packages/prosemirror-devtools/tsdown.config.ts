import { defineConfig } from "tsdown";

const isWatchMode = process.argv.includes("--watch");

export default defineConfig({
  entry: {
    index: "src/index.ts",
    core: "src/core/index.ts",
    performance: "src/performance/index.ts",
    // The extension is usable without the panel. Keeping it as an internal
    // entry lets production no-op adapters tree-shake the live React renderer.
    "internal/react-extension": "src/panel/react-extension.tsx",
    "react/index": "src/react/index.ts",
    "react/production/index": "src/react/production/index.ts",
    "preact/index": "src/preact/index.ts",
    "preact/production/index": "src/preact/production/index.ts",
    "solid/index": "src/solid/index.ts",
    "solid/production/index": "src/solid/production/index.ts",
    "vue/index": "src/vue/index.ts",
    "vue/production/index": "src/vue/production/index.ts",
    "svelte/index": "src/svelte/index.ts",
    "svelte/production/index": "src/svelte/production/index.ts",
    "angular/index": "src/angular/index.ts",
    "angular/production/index": "src/angular/production/index.ts",
    tiptap: "src/tiptap/index.ts",
  },
  format: "esm",
  dts: true,
  sourcemap: true,
  clean: !isWatchMode,
  // Preserve adapter NODE_ENV branches for the consuming application to fold.
  platform: "neutral",
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
      /^@angular\/core/,
      /^@tanstack\/devtools-utils/,
      /^@tanstack\/react-devtools/,
      /^preact(?:\/|$)/,
      /^prosemirror-/,
      /^react(?:\/|$)/,
      /^react-dom(?:\/|$)/,
      /^solid-js(?:\/|$)/,
      /^svelte(?:\/|$)/,
      /^vue(?:\/|$)/,
    ],
  },
});
