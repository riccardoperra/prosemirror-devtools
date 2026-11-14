import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "prosemirror-model",
      "prosemirror-state",
      "prosemirror-view",
      "prosemirror-transform",
      "solid-js",
    ],
  },
  server: { port: 4184, strictPort: true },
  // A literal, even when unset, lets the bundler drop the devtools shell from ordinary builds.
  define: {
    "import.meta.env.VITE_SHOWCASE": JSON.stringify(process.env.VITE_SHOWCASE ?? "false"),
  },
});
