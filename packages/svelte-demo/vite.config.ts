import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
export default defineConfig({
  plugins: [
    svelte({
      // The host ships this file precompiled despite its `.svelte.js` infix.
      experimental: { compileModule: { exclude: /@tanstack[+/]svelte-devtools/u } },
    }),
  ],
  optimizeDeps: { exclude: ["@tanstack/svelte-devtools"], include: ["dayjs"] },
  resolve: { dedupe: ["svelte"] },
  server: { port: 4178 },
});
