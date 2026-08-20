import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
export default defineConfig({
  plugins: [preact({ reactAliasesEnabled: false })],
  resolve: { dedupe: ["preact"] },
  server: { port: 4175 },
});
