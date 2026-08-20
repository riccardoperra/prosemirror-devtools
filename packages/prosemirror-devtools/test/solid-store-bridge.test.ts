import { createRoot } from "solid-js";
import { describe, expect, it } from "vitest";

import type { DevtoolsReadable } from "../src/core/data-client";
import { fromDevtoolsReadable } from "../src/panel/store/selectors";

describe("Solid store bridge", () => {
  it("updates through a signal and unsubscribes with its Solid owner", () => {
    let current = 1;
    const listeners = new Set<() => void>();
    const readable = (() => current) as DevtoolsReadable<number>;
    readable.get = () => current;
    readable.subscribe = (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };

    createRoot((dispose) => {
      const value = fromDevtoolsReadable(readable);

      expect(value()).toBe(1);
      expect(listeners.size).toBe(1);

      current = 2;
      for (const listener of listeners) listener();
      expect(value()).toBe(2);

      dispose();
      expect(listeners.size).toBe(0);
    });
  });
});
