import { Plugin } from "prosemirror-state";
import type { PluginSpec, PluginView, StateField } from "prosemirror-state";
import type { EditorProps, NodeView } from "prosemirror-view";

import { prosemirrorDevtoolsStore } from "./store/create-devtools-store";
import type { InstrumentPluginsOptions, PluginHook, DevtoolsStore } from "./types";

type LooseFunction = (this: unknown, ...args: unknown[]) => unknown;
type LooseRecord = Record<PropertyKey, unknown>;

const instrumentedPlugins = new WeakMap<
  Plugin,
  WeakMap<
    DevtoolsStore,
    Map<string, { plugin: WeakRef<Plugin>; isActive: (() => boolean) | undefined }>
  >
>();
const instrumentedPluginMetadata = new WeakMap<
  Plugin,
  {
    instanceId: string;
    sessionId: string | undefined;
    isActive: (() => boolean) | undefined;
    store: DevtoolsStore;
  }
>();

function runtimePluginKey(plugin: Plugin): string {
  return (plugin as unknown as { key: string }).key;
}

function defaultPluginLabel(plugin: Plugin, index: number): string {
  const normalized = runtimePluginKey(plugin).replace(/\$\d*$/, "");
  return normalized === "plugin" ? `plugin #${index + 1}` : normalized;
}

function wrapNodeView(
  nodeView: NodeView,
  measure: <T>(hook: PluginHook, run: () => T) => T,
): NodeView {
  const timedMethods = new Set([
    "update",
    "selectNode",
    "deselectNode",
    "setSelection",
    "stopEvent",
    "ignoreMutation",
    "destroy",
  ]);
  const wrappers = new Map<PropertyKey, { source: LooseFunction; wrapped: LooseFunction }>();
  return new Proxy(nodeView, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver) as unknown;
      if (typeof property !== "string" || !timedMethods.has(property)) return value;
      if (typeof value !== "function") return value;
      const ownDescriptor = Reflect.getOwnPropertyDescriptor(target, property);
      if (
        ownDescriptor &&
        ownDescriptor.configurable === false &&
        "value" in ownDescriptor &&
        ownDescriptor.writable === false
      ) {
        return value;
      }
      const cached = wrappers.get(property);
      if (cached?.source === value) return cached.wrapped;
      const source = value as LooseFunction;
      const wrapped: LooseFunction = (...args: unknown[]) =>
        measure(`nodeView.${property}`, () => Reflect.apply(source, target, args));
      wrappers.set(property, { source, wrapped });
      return wrapped;
    },
  });
}

function wrapProps(
  props: EditorProps<Plugin>,
  measure: <T>(hook: PluginHook, run: () => T) => T,
  originalPlugin: Plugin,
): EditorProps<Plugin> {
  const wrapped: LooseRecord = { ...props };
  for (const [name, value] of Object.entries(props)) {
    if (typeof value === "function") {
      wrapped[name] = function (this: unknown, ...args: unknown[]) {
        return measure(`props.${name}`, () =>
          Reflect.apply(value as LooseFunction, originalPlugin, args),
        );
      };
      continue;
    }
    if (name === "handleDOMEvents" && value && typeof value === "object") {
      wrapped[name] = Object.fromEntries(
        Object.entries(value).map(([eventName, handler]) => [
          eventName,
          typeof handler === "function"
            ? function (this: unknown, ...args: unknown[]) {
                return measure(`props.handleDOMEvents.${eventName}`, () =>
                  Reflect.apply(handler as LooseFunction, originalPlugin, args),
                );
              }
            : handler,
        ]),
      );
      continue;
    }
    if (name === "nodeViews" && value && typeof value === "object") {
      wrapped[name] = Object.fromEntries(
        Object.entries(value).map(([nodeName, factory]) => [
          nodeName,
          typeof factory === "function"
            ? function (this: unknown, ...args: unknown[]) {
                return measure(`props.nodeViews.${nodeName}`, () => {
                  const result = Reflect.apply(factory as LooseFunction, this, args);
                  return result && typeof result === "object"
                    ? wrapNodeView(result as NodeView, measure)
                    : result;
                });
              }
            : factory,
        ]),
      );
    }
  }
  return wrapped as EditorProps<Plugin>;
}

function wrapPlugin(original: Plugin, index: number, options: InstrumentPluginsOptions): Plugin {
  const store = options.store ?? prosemirrorDevtoolsStore;
  const metadata = instrumentedPluginMetadata.get(original);
  if (
    metadata?.instanceId === options.instanceId &&
    metadata.sessionId === options.sessionId &&
    metadata.isActive === options.isActive &&
    metadata.store === store
  ) {
    return original;
  }
  const cacheKey = options.sessionId ?? options.instanceId;
  const cached = instrumentedPlugins.get(original)?.get(store)?.get(cacheKey);
  const cachedPlugin = cached?.plugin.deref();
  if (cachedPlugin && cached?.isActive === options.isActive) return cachedPlugin;

  const pluginKey = runtimePluginKey(original);
  const pluginLabel =
    options.getPluginLabel?.(original, index) ?? defaultPluginLabel(original, index);
  const measure = <T>(hook: PluginHook, run: () => T): T => {
    if (options.isActive && !options.isActive()) return run();
    return store.measurePluginHook(
      options.instanceId,
      pluginKey,
      pluginLabel,
      hook,
      run,
      options.sessionId,
    );
  };
  const spec = original.spec as PluginSpec<unknown>;
  const wrappedSpec: PluginSpec<unknown> = { ...spec };

  if (spec.state) {
    const field = spec.state;
    const wrappedState: StateField<unknown> = {
      init(config, state) {
        return measure("state.init", () => field.init.call(original, config, state));
      },
      apply(transaction, value, oldState, newState) {
        return measure("state.apply", () =>
          field.apply.call(original, transaction, value, oldState, newState),
        );
      },
    };
    if (field.toJSON) {
      wrappedState.toJSON = (value) => field.toJSON?.call(original, value);
    }
    if (field.fromJSON) {
      wrappedState.fromJSON = (config, value, state) =>
        field.fromJSON?.call(original, config, value, state);
    }
    wrappedSpec.state = wrappedState;
  }

  if (spec.filterTransaction) {
    wrappedSpec.filterTransaction = (transaction, state) =>
      measure(
        "filterTransaction",
        () => spec.filterTransaction?.call(original, transaction, state) ?? true,
      );
  }
  if (spec.appendTransaction) {
    wrappedSpec.appendTransaction = (transactions, oldState, newState) =>
      measure("appendTransaction", () =>
        spec.appendTransaction?.call(original, transactions, oldState, newState),
      );
  }
  if (spec.props) {
    wrappedSpec.props = wrapProps(spec.props as EditorProps<Plugin>, measure, original);
  }
  if (spec.view) {
    const createView = spec.view;
    wrappedSpec.view = (view) =>
      measure("view.create", () => {
        const pluginView = createView.call(original, view);
        const wrappedView: PluginView = {};
        if (pluginView.update) {
          wrappedView.update = (nextView, previousState) =>
            measure("view.update", () =>
              pluginView.update?.call(pluginView, nextView, previousState),
            );
        }
        if (pluginView.destroy) {
          wrappedView.destroy = () =>
            measure("view.destroy", () => pluginView.destroy?.call(pluginView));
        }
        return wrappedView;
      });
  }

  const wrapped = new Plugin(wrappedSpec);
  // A PluginSpec without an explicit PluginKey receives an internal generated key.
  // Reusing the original string keeps state lookup stable for originalPlugin.getState.
  if (!spec.key) {
    (wrapped as unknown as { key: string }).key = runtimePluginKey(original);
  }

  const byStore = instrumentedPlugins.get(original) ?? new WeakMap();
  const bySession = byStore.get(store) ?? new Map();
  bySession.set(cacheKey, { plugin: new WeakRef(wrapped), isActive: options.isActive });
  byStore.set(store, bySession);
  instrumentedPlugins.set(original, byStore);
  instrumentedPluginMetadata.set(wrapped, {
    instanceId: options.instanceId,
    sessionId: options.sessionId,
    isActive: options.isActive,
    store,
  });
  return wrapped;
}

/**
 * Returns semantically equivalent plugins whose public lifecycle hooks are timed.
 * Call this before EditorState.create and do not include the originals as well.
 */
export function instrumentProseMirrorPlugins(
  plugins: readonly Plugin[],
  options: InstrumentPluginsOptions,
): Plugin[] {
  return plugins.map((plugin, index) => wrapPlugin(plugin, index, options));
}
