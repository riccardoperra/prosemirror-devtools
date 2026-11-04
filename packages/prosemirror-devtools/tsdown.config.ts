import { defineConfig } from "tsdown";
import solid from "unplugin-solid/rolldown";

const isWatchMode = process.argv.includes("--watch");

export default defineConfig({
  plugins: [solid()],
  entry: {
    index: "src/index.ts",
    core: "src/core/index.ts",
    recordings: "src/recordings/index.ts",
    performance: "src/performance/index.ts",
    "styles/index": "src/styles/index.ts",
    // The extension is usable without the panel. Keeping it as an internal
    // entry lets production no-op adapters tree-shake React extension support.
    "internal/react-extension": "src/adapters/react/extension.ts",
    "react/index": "src/adapters/react/index.ts",
    "react/production/index": "src/adapters/react/production/index.ts",
    "preact/index": "src/adapters/preact/index.ts",
    "preact/production/index": "src/adapters/preact/production/index.ts",
    "solid/index": "src/adapters/solid/index.ts",
    "solid/production/index": "src/adapters/solid/production/index.ts",
    "vue/index": "src/adapters/vue/index.ts",
    "vue/production/index": "src/adapters/vue/production/index.ts",
    "svelte/index": "src/adapters/svelte/index.ts",
    "svelte/production/index": "src/adapters/svelte/production/index.ts",
    "angular/index": "src/adapters/angular/index.ts",
    "angular/production/index": "src/adapters/angular/production/index.ts",
    tiptap: "src/adapters/tiptap/index.ts",
    standalone: "src/standalone.ts",
    "react-prosemirror": "src/adapters/react-prosemirror/index.ts",
    "inspectors/history": "src/inspectors/history.ts",
    "inspectors/collab": "src/inspectors/collab.ts",
    "inspectors/transport": "src/inspectors/transport.ts",
    "inspectors/yjs": "src/inspectors/yjs.ts",
    "inspectors/tiptap": "src/inspectors/tiptap.ts",
  },
  format: "esm",
  dts: true,
  sourcemap: true,
  css: {
    fileName: "prosemirror-inspector.css",
    inject: true,
    modules: {
      generateScopedName: "[local]_[hash]",
      localsConvention: "camelCaseOnly",
    },
    splitting: false,
    target: false,
  },
  clean: !isWatchMode,
  // Preserve adapter NODE_ENV branches for the consuming application to fold.
  platform: "neutral",
  deps: {
    // Keep the chart renderer in the lazy performance chunk.
    alwaysBundle: [
      /^@tanstack\/charts(?:\/|$)/,
      /^@tanstack\/solid-charts(?:\/|$)/,
      /^d3-scale(?:\/|$)/,
    ],
    onlyBundle: [
      "@tanstack/charts",
      "@tanstack/solid-charts",
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
