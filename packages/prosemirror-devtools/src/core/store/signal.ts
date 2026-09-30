export type SignalListener = () => void;

/**
 * A tiny mutable value cell used by the framework-neutral store.
 *
 * Calling the signal and calling {@link StoreSignal.get | get} are equivalent. A write changes the
 * value immediately, so code already executing inside a transaction can always read the latest
 * state. Subscriber delivery is the only part that may wait: when a write belongs to a scheduler
 * batch, subscribers run synchronously when the outermost batch ends.
 *
 * Keeping that boundary in core is important. Rendering adapters may choose to defer expensive
 * rendering, but they cannot make several store writes atomic for non-UI subscribers or repair the
 * completion order of nested dispatches after notifications have already escaped.
 */
export interface StoreSignal<T> {
  /** Returns the current value. Equivalent to `get()`. */
  (): T;
  /** Returns the current value. */
  get(): T;
  /** Replaces the current value immediately. */
  set(value: T): void;
  /**
   * Runs after the value changes and the surrounding batch, if any, commits. Multiple writes in
   * one batch produce one notification for this signal.
   */
  subscribe(listener: SignalListener): () => void;
}

/**
 * Coordinates synchronous, nested notification batches.
 *
 * This is deliberately not an asynchronous scheduler: it creates no timer, task, or microtask.
 * Values are updated as soon as they are written, while callbacks are collected until the
 * outermost batch closes. That gives every subscriber one coherent post-operation snapshot without
 * imposing a rendering policy on consumers.
 */
export interface SignalScheduler {
  /** Runs a self-contained mutation and publishes its notifications atomically. */
  batch<T>(run: () => T): T;
  /** Opens a batch whose lifetime may span separate begin/finish functions. Batches may nest. */
  begin(): void;
  /** Closes one nesting level and publishes pending callbacks at the outermost boundary. */
  end(): void;
  /** Publishes now or queues the callback once by identity while a batch is open. */
  schedule(publish: () => void): void;
}

/**
 * Creates the store's notification coordinator.
 *
 * The nesting depth matters because ProseMirror may dispatch again while an earlier dispatch is
 * still being recorded. The inner operation finishes first, but publishing at that point would
 * expose a half-finished outer operation. Waiting for depth zero makes the complete dispatch tree
 * one atomic notification boundary.
 */
export function createSignalScheduler(): SignalScheduler {
  const pending = new Set<() => void>();
  let depth = 0;
  let publishing = false;

  const publish = (): void => {
    if (depth > 0 || publishing) return;
    publishing = true;
    try {
      // A listener may synchronously mutate another signal. Copy and clear before calling effects,
      // then keep draining until no publication remains.
      while (pending.size > 0) {
        const current = Array.from(pending);
        pending.clear();
        for (const notify of current) notify();
      }
    } finally {
      publishing = false;
    }
  };

  const scheduler: SignalScheduler = {
    batch(run) {
      scheduler.begin();
      try {
        return run();
      } finally {
        scheduler.end();
      }
    },
    begin() {
      depth += 1;
    },
    end() {
      if (depth === 0) {
        throw new Error("[prosemirror-inspector] Cannot end a signal batch that was not started.");
      }
      depth -= 1;
      publish();
    },
    schedule(effect) {
      pending.add(effect);
      publish();
    },
  };
  return scheduler;
}

/**
 * Creates a callable signal whose subscriber failures cannot escape editor execution.
 *
 * The stable `notify` function is also the scheduler's deduplication key. Consequently, changing a
 * signal several times within one batch still wakes its subscribers only once with the final value.
 */
export function createStoreSignal<T>(initialValue: T, scheduler: SignalScheduler): StoreSignal<T> {
  let value = initialValue;
  const listeners = new Set<SignalListener>();

  const notify = (): void => {
    for (const listener of Array.from(listeners)) {
      try {
        listener();
      } catch (error) {
        // Observers are independent: one integration must not prevent the remaining integrations
        // from receiving the committed value or interrupt editor execution.
        console.error("[prosemirror-inspector] Store subscriber failed", error);
      }
    }
  };

  const signal = (() => value) as StoreSignal<T>;
  signal.get = () => value;
  signal.set = (nextValue) => {
    if (Object.is(value, nextValue)) return;
    value = nextValue;
    scheduler.schedule(notify);
  };
  signal.subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return signal;
}
