import { afterEach, describe, expect, it } from "vitest";

import {
  createProseMirrorDevtoolsRegistrationManager,
  createProseMirrorDevtoolsStore,
} from "../src/core";
import { createTestState, createTestView } from "./helpers";

afterEach(() => {
  document.body.replaceChildren();
});

describe("ProseMirror devtools registration manager", () => {
  it("deduplicates equivalent updates and reattaches when options change", () => {
    const store = createProseMirrorDevtoolsStore();
    const view = createTestView(createTestState("before"));
    const registration = createProseMirrorDevtoolsRegistrationManager();

    registration.update(view, {
      id: "editor",
      performanceMarks: false,
      store,
    });
    const firstDispatch = view.props.dispatchTransaction;
    expect(firstDispatch).toBeTypeOf("function");
    expect(store.getSnapshot().instances).toHaveLength(1);

    registration.update(view, {
      id: "editor",
      performanceMarks: false,
      store,
    });
    expect(view.props.dispatchTransaction).toBe(firstDispatch);

    registration.update(view, {
      id: "editor",
      label: "Renamed editor",
      performanceMarks: false,
      store,
    });
    expect(view.props.dispatchTransaction).not.toBe(firstDispatch);
    expect(store.getSnapshot().instances[0]?.label).toBe("Renamed editor");

    registration.update(view, {
      enabled: false,
      id: "editor",
      store,
    });
    expect(view.props.dispatchTransaction).toBeUndefined();
    expect(store.getSnapshot().instances).toEqual([]);

    registration.dispose();
    registration.dispose();
    view.destroy();
  });
});
