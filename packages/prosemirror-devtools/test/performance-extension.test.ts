import { describe, expect, it } from "vitest";

import { findCustomCodeTimings } from "../src/core/performance-extension";

describe("Chrome Performance custom-code attribution", () => {
  it("returns exact gaps after merging overlapping apply and view intervals", () => {
    expect(
      findCustomCodeTimings([
        { phase: "customDispatch", startOffset: 0, duration: 20 },
        { phase: "apply", startOffset: 2, duration: 5 },
        { phase: "viewUpdate", startOffset: 6, duration: 4 },
      ]),
    ).toEqual([
      { startOffset: 0, duration: 2 },
      { startOffset: 10, duration: 10 },
    ]);
  });

  it("clips observed phases to the custom callback and emits nothing without one", () => {
    expect(
      findCustomCodeTimings([
        { phase: "apply", startOffset: 0, duration: 3 },
        { phase: "customDispatch", startOffset: 2, duration: 4 },
        { phase: "viewUpdate", startOffset: 5, duration: 4 },
      ]),
    ).toEqual([{ startOffset: 3, duration: 2 }]);
    expect(findCustomCodeTimings([{ phase: "apply", startOffset: 0, duration: 3 }])).toEqual([]);
  });
});
