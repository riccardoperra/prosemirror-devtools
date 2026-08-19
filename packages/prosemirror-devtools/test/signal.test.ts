import { describe, expect, it, vi } from "vitest";

import { createSignalScheduler, createStoreSignal } from "../src/core/store/signal";

describe("store signal", () => {
  it("supports callable and explicit reads with immediate writes", () => {
    const scheduler = createSignalScheduler();
    const value = createStoreSignal(1, scheduler);
    const listener = vi.fn();
    const unsubscribe = value.subscribe(listener);

    expect(value()).toBe(1);
    expect(value.get()).toBe(1);

    value.set(2);

    expect(value()).toBe(2);
    expect(listener).toHaveBeenCalledOnce();

    value.set(2);
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    value.set(3);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("updates values immediately and notifies once after a nested batch", () => {
    const scheduler = createSignalScheduler();
    const value = createStoreSignal(0, scheduler);
    const listener = vi.fn();
    value.subscribe(listener);

    scheduler.batch(() => {
      value.set(1);
      expect(value()).toBe(1);
      expect(listener).not.toHaveBeenCalled();

      scheduler.batch(() => {
        value.set(2);
        value.set(3);
        expect(value.get()).toBe(3);
      });
      expect(listener).not.toHaveBeenCalled();
    });

    expect(value()).toBe(3);
    expect(listener).toHaveBeenCalledOnce();
  });
});
