import { createEffect, createSignal, on, onCleanup, untrack, type Accessor } from "solid-js";

const IDLE_TIMEOUT_MS = 100;

function requestIdle(run: () => void): () => void {
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(run, 0);
  return () => clearTimeout(handle);
}

/**
 * Follows `source` but publishes only when the browser is idle, at most once per idle period and
 * no later than {@link IDLE_TIMEOUT_MS}. Store updates arrive inside editor event handlers, so
 * views that are expensive to render read this instead of the live value.
 */
export function createIdleValue<T>(source: Accessor<T>): Accessor<T> {
  const [value, setValue] = createSignal(untrack(source));
  let latest: T;
  let cancel: (() => void) | undefined;

  createEffect(
    on(
      source,
      (next) => {
        latest = next;
        cancel ??= requestIdle(() => {
          cancel = undefined;
          setValue(() => latest);
        });
      },
      { defer: true },
    ),
  );
  onCleanup(() => cancel?.());

  return value;
}
