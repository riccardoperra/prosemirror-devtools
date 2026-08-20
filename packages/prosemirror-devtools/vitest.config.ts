import { defineConfig } from "vitest/config";
import solid from "unplugin-solid/vite";

export default defineConfig({
  plugins: [solid()],
  css: {
    modules: {
      generateScopedName: "[local]",
      localsConvention: "camelCaseOnly",
    },
  },
  test: {
    css: {
      include: [/\.module\.css$/],
      modules: {
        classNameStrategy: "non-scoped",
      },
    },
    environment: "jsdom",
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
});
