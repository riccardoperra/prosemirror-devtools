import { Plugin } from "prosemirror-state";
import type { PluginSpec, PluginView, StateField } from "prosemirror-state";
import type { EditorProps, NodeView } from "prosemirror-view";
import {
  getDiagnosticsRecorder,
  type DevtoolsDiagnosticsController,
  type DevtoolsDiagnosticsRecorder,
  type DevtoolsNodeViewTracker,
} from "./diagnostics";
import type { EditorState } from "prosemirror-state";

import { prosemirrorDevtoolsStore } from "./store/create-devtools-store";
import type { InstrumentPluginsOptions, PluginHook, DevtoolsStore } from "./types";

type LooseFunction = (this: unknown, ...args: unknown[]) => unknown;
type LooseRecord = Record<PropertyKey, unknown>;
const diagnosticsIds = new WeakMap<DevtoolsDiagnosticsController, number>();
let nextDiagnosticsId = 0;

const instrumentedPlugins = new WeakMap<
  Plugin,
  WeakMap<DevtoolsStore, Map<string, WeakRef<Plugin>>>
>();
const instrumentedPluginMetadata = new WeakMap<
  Plugin,
  {
    original: Plugin;
    instanceId: string;
    sessionId: string | undefined;
    pluginLabel: string;
    isActive: (() => boolean) | undefined;
    store: DevtoolsStore;
    diagnostics: DevtoolsDiagnosticsController | undefined;
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
  tracker?: DevtoolsNodeViewTracker,
  diagnosticsActive?: () => DevtoolsDiagnosticsRecorder | undefined,
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
  const destroy = () => {
    if (diagnosticsActive?.()) tracker?.run("destroy", () => {});
  };
  return new Proxy(nodeView, {
    get(target, property) {
      // Accessors on class-based NodeViews may read private fields, which require the original
      // instance as their receiver just like the lifecycle methods below.
      const value = Reflect.get(target, property, target) as unknown;
      if (typeof property !== "string" || !timedMethods.has(property)) return value;
      const ownDescriptor = Reflect.getOwnPropertyDescriptor(target, property);
      if (
        ownDescriptor &&
        ownDescriptor.configurable === false &&
        "value" in ownDescriptor &&
        ownDescriptor.writable === false
      ) {
        return value;
      }
      if (property === "destroy" && value == null && tracker) return destroy;
      if (typeof value !== "function") return value;
      const cached = wrappers.get(property);
      if (cached?.source === value) return cached.wrapped;
      const source = value as LooseFunction;
      const wrapped: LooseFunction = (...args: unknown[]) =>
        measure(`nodeView.${property}`, () =>
          tracker && diagnosticsActive?.()
            ? tracker.run(property, () => Reflect.apply(source, target, args))
            : Reflect.apply(source, target, args),
        );
      wrappers.set(property, { source, wrapped });
      return wrapped;
    },
  });
}

function wrapProps(
  props: EditorProps<Plugin>,
  measure: <T>(hook: PluginHook, run: () => T) => T,
  originalPlugin: Plugin,
  pluginKey: string,
  pluginLabel: string,
  diagnostics?: () => DevtoolsDiagnosticsRecorder | undefined,
): EditorProps<Plugin> {
  const wrapped: LooseRecord = { ...props };
  for (const [name, value] of Object.entries(props)) {
    if (typeof value === "function") {
      wrapped[name] = function (this: unknown, ...args: unknown[]) {
        return measure(`props.${name}`, () => {
          const recorder = diagnostics?.();
          const run = () => Reflect.apply(value as LooseFunction, originalPlugin, args);
          if (recorder && name.startsWith("handle")) {
            return recorder.traceEvent({ kind: "prop", name, pluginKey, pluginLabel }, args, run);
          }
          const result = run();
          if (recorder && name === "decorations") {
            const state = args[0] as EditorState;
            recorder.observeDecorations(
              pluginKey,
              pluginLabel,
              state.doc,
              result as ReturnType<NonNullable<EditorProps["decorations"]>>,
            );
          }
          return result;
        });
      };
      continue;
    }
    if (name === "handleDOMEvents" && value && typeof value === "object") {
      wrapped[name] = Object.fromEntries(
        Object.entries(value).map(([eventName, handler]) => [
          eventName,
          typeof handler === "function"
            ? function (this: unknown, ...args: unknown[]) {
                return measure(`props.handleDOMEvents.${eventName}`, () => {
                  const recorder = diagnostics?.();
                  const run = () => Reflect.apply(handler as LooseFunction, originalPlugin, args);
                  return recorder
                    ? recorder.traceEvent(
                        { kind: "dom-event", name: eventName, pluginKey, pluginLabel },
                        args,
                        run,
                      )
                    : run();
                });
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
                  const tracker = diagnostics?.()?.nodeView(
                    pluginKey,
                    pluginLabel,
                    nodeName,
                    args[2],
                  );
                  const run = () => Reflect.apply(factory as LooseFunction, this, args);
                  const result = tracker ? tracker.run("create", run) : run();
                  return result && typeof result === "object"
                    ? wrapNodeView(result as NodeView, measure, tracker, diagnostics)
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

function wrapPlugin(plugin: Plugin, index: number, options: InstrumentPluginsOptions): Plugin {
  const store = options.store ?? prosemirrorDevtoolsStore;
  const metadata = instrumentedPluginMetadata.get(plugin);
  // A wrapper reused in another editor/session must not call the old session's instrumentation.
  const original = metadata?.original ?? plugin;
  const pluginLabel =
    options.getPluginLabel?.(original, index) ?? defaultPluginLabel(original, index);
  if (
    metadata?.instanceId === options.instanceId &&
    metadata.sessionId === options.sessionId &&
    metadata.pluginLabel === pluginLabel &&
    metadata.isActive === options.isActive &&
    metadata.diagnostics === options.diagnostics &&
    metadata.store === store
  ) {
    return plugin;
  }
  let diagnosticsId = 0;
  if (options.diagnostics) {
    diagnosticsId = diagnosticsIds.get(options.diagnostics) ?? ++nextDiagnosticsId;
    diagnosticsIds.set(options.diagnostics, diagnosticsId);
  }
  const cacheKey = JSON.stringify([
    options.instanceId,
    options.sessionId ?? null,
    pluginLabel,
    diagnosticsId,
  ]);
  const cached = instrumentedPlugins.get(original)?.get(store)?.get(cacheKey);
  const cachedPlugin = cached?.deref();
  if (cachedPlugin && instrumentedPluginMetadata.get(cachedPlugin)?.isActive === options.isActive) {
    return cachedPlugin;
  }

  const pluginKey = runtimePluginKey(original);
  const diagnostics = options.diagnostics
    ? () =>
        options.isActive && !options.isActive()
          ? undefined
          : getDiagnosticsRecorder(options.diagnostics)
    : undefined;
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
    wrappedSpec.props = wrapProps(
      spec.props as EditorProps<Plugin>,
      measure,
      original,
      pluginKey,
      pluginLabel,
      diagnostics,
    );
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
  // The cache must not retain isActive closures (and their editor/session) after a wrapper dies.
  // Reclaim expired keys when a shared plugin is instrumented for a subsequent editor lifecycle.
  for (const [key, reference] of bySession) {
    if (!reference.deref()) bySession.delete(key);
  }
  bySession.set(cacheKey, new WeakRef(wrapped));
  byStore.set(store, bySession);
  instrumentedPlugins.set(original, byStore);
  instrumentedPluginMetadata.set(wrapped, {
    original,
    instanceId: options.instanceId,
    sessionId: options.sessionId,
    pluginLabel,
    isActive: options.isActive,
    store,
    diagnostics: options.diagnostics,
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
