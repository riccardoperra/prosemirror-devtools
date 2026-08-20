import { defineConfig } from "vite";
export default defineConfig({
  resolve: { dedupe: ["@angular/core"] },
  server: { port: 4179 },
});
