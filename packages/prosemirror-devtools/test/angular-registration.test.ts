import { afterEach, describe, expect, it, vi } from "vitest";

import { injectProseMirrorDevtools } from "../src/adapters/angular/inject-prosemirror-devtools";
import { createProseMirrorDevtoolsDiagnostics, createProseMirrorDevtoolsStore } from "../src/core";
import { createTestView } from "./helpers";

// Run the registration effect immediately to isolate Angular's options adapter
// from the framework scheduler and verify the real core attachment it creates.
vi.mock("@angular/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@angular/core")>()),
  effect: (run: () => void) => {
    run();
  },
}));

afterEach(() => document.body.replaceChildren());

describe("Angular registration options", () => {
  it("forwards diagnostics to the registered editor", () => {
    const store = createProseMirrorDevtoolsStore();
    const diagnostics = createProseMirrorDevtoolsDiagnostics();
    const view = createTestView();
    let dispose = () => {};
    injectProseMirrorDevtools(() => ({
      id: "angular-editor",
      store,
      view,
      diagnostics,
      performanceMarks: false,
      injector: {
        get: () => ({
          onDestroy: (callback: () => void) => {
            dispose = callback;
          },
        }),
      },
    }));

    try {
      expect(store.getInstance("angular-editor")?.diagnostics).toBe(diagnostics);
    } finally {
      dispose();
      diagnostics.dispose();
      view.destroy();
    }
    expect(store.getInstance("angular-editor")).toBeUndefined();
  });
});
