import type { Plugin, Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { createProseMirrorDispatchRecorder } from "../../core/attach";
import { instrumentProseMirrorPlugins } from "../../core/instrument";
import { createDevtoolsSessionId } from "../../core/session-id";
import { prosemirrorDevtoolsStore } from "../../core/store/create-devtools-store";
import type { AttachProseMirrorDevtoolsOptions } from "../../core/types";

/** The part of a Tiptap editor used by the adapter. */
export interface TiptapDevtoolsEditor {
  readonly extensionManager: object;
  readonly view: EditorView;
}

export interface TiptapDevtoolsOptions extends Omit<AttachProseMirrorDevtoolsOptions, "view"> {
  /** Instrument Tiptap's generated ProseMirror plugins. Defaults to true. */
  instrumentPlugins?: boolean;
  getPluginLabel?: (plugin: Plugin, index: number) => string;
}

/** The dependency-free shape of Tiptap 3's dispatchTransaction hook argument. */
export interface TiptapDispatchTransactionProps {
  transaction: Transaction;
  next: (transaction: Transaction) => void;
}

type DispatchRecorder = ReturnType<typeof createProseMirrorDispatchRecorder>;

type TiptapIntegration = Readonly<{
  options: TiptapDevtoolsOptions;
  setup: () => void;
  attach: () => void;
  dispatch: (props: TiptapDispatchTransactionProps) => void;
  detach: () => void;
}>;

const integrations = new WeakMap<TiptapDevtoolsEditor, TiptapIntegration>();

function findPropertyDescriptor(target: object, property: PropertyKey): PropertyDescriptor | null {
  let current: object | null = target;
  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, property);
    if (descriptor) return descriptor;
    current = Object.getPrototypeOf(current) as object | null;
  }
  return null;
}

function installPluginInstrumentation(
  editor: TiptapDevtoolsEditor,
  options: TiptapDevtoolsOptions,
  sessionId: string,
  isActive: () => boolean,
  onPluginsCreated: () => void,
): () => void {
  const manager = editor.extensionManager;
  if (!manager || (typeof manager !== "object" && typeof manager !== "function")) {
    throw new Error(
      "[prosemirror-devtools] Tiptap editor.extensionManager is not available in onBeforeCreate.",
    );
  }

  const ownDescriptor = Object.getOwnPropertyDescriptor(manager, "plugins");
  const sourceDescriptor = ownDescriptor ?? findPropertyDescriptor(manager, "plugins");
  if (typeof sourceDescriptor?.get !== "function") {
    throw new Error(
      "[prosemirror-devtools] Tiptap extensionManager.plugins is not exposed as a getter. " +
        "Set instrumentPlugins to false to attach without plugin-hook timings.",
    );
  }
  if (ownDescriptor?.configurable === false) {
    throw new Error(
      "[prosemirror-devtools] Tiptap extensionManager.plugins cannot be instrumented because its own descriptor is not configurable.",
    );
  }

  const instrumentationOptions = {
    instanceId: options.id,
    sessionId,
    isActive,
    ...(options.store ? { store: options.store } : {}),
    ...(options.getPluginLabel ? { getPluginLabel: options.getPluginLabel } : {}),
    ...(options.diagnostics ? { diagnostics: options.diagnostics } : {}),
  };
  const originalGet = sourceDescriptor.get;
  const instrumentedGet = function instrumentedTiptapPlugins(this: object): unknown {
    const plugins = originalGet.call(this) as unknown;
    if (!isActive() || !Array.isArray(plugins)) return plugins;

    const instrumented = instrumentProseMirrorPlugins(plugins as Plugin[], instrumentationOptions);
    onPluginsCreated();
    return instrumented;
  };
  const replacementDescriptor: PropertyDescriptor = {
    configurable: true,
    enumerable: sourceDescriptor.enumerable ?? false,
    get: instrumentedGet,
    ...(sourceDescriptor.set ? { set: sourceDescriptor.set } : {}),
  };

  try {
    Object.defineProperty(manager, "plugins", replacementDescriptor);
  } catch (error) {
    throw new Error(
      "[prosemirror-devtools] Could not instrument Tiptap's extensionManager.plugins getter.",
      { cause: error },
    );
  }

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    const currentDescriptor = Object.getOwnPropertyDescriptor(manager, "plugins");
    if (
      currentDescriptor?.get !== instrumentedGet ||
      currentDescriptor.set !== replacementDescriptor.set
    ) {
      return;
    }
    try {
      if (ownDescriptor) {
        Object.defineProperty(manager, "plugins", ownDescriptor);
      } else {
        Reflect.deleteProperty(manager, "plugins");
      }
    } catch (error) {
      console.error("[prosemirror-devtools] Could not restore Tiptap's plugins getter.", error);
    }
  };
}

function readyView(editor: TiptapDevtoolsEditor): EditorView | null {
  try {
    const view = editor.view;
    if (
      !view ||
      view.isDestroyed ||
      typeof view.setProps !== "function" ||
      typeof view.dispatch !== "function" ||
      !view.state
    ) {
      return null;
    }
    return view;
  } catch {
    // Tiptap 3 exposes a throwing proxy before the real EditorView is mounted.
    return null;
  }
}

function createTiptapIntegration(
  editor: TiptapDevtoolsEditor,
  options: TiptapDevtoolsOptions,
): TiptapIntegration {
  const sessionId = options.sessionId ?? createDevtoolsSessionId("tiptap");
  let active = true;
  let recorder: DispatchRecorder | null = null;
  let registering = false;
  let restorePluginGetter = (): void => {};
  let unregister: (() => void) | null = null;
  let registeredView: EditorView | null = null;

  const registerWhenReady = (): void => {
    if (!active || registering) return;
    const view = readyView(editor);
    if (!view || registeredView === view) return;

    registering = true;
    try {
      unregister?.();
      recorder = null;
      unregister = null;
      registeredView = null;

      const store = options.store ?? prosemirrorDevtoolsStore;
      const registrationOptions = {
        id: options.id,
        view,
        sessionId,
        ...(options.diagnostics ? { diagnostics: options.diagnostics } : {}),
        ...(options.label === undefined ? {} : { label: options.label }),
        ...(options.transactionLimit === undefined
          ? {}
          : { transactionLimit: options.transactionLimit }),
      };
      const nextUnregister = store.register(registrationOptions);
      const recorderOptions: AttachProseMirrorDevtoolsOptions = {
        ...registrationOptions,
        ...(options.store ? { store: options.store } : {}),
        ...(options.performanceMarks === undefined
          ? {}
          : { performanceMarks: options.performanceMarks }),
        ...(options.performanceExtension === undefined
          ? {}
          : { performanceExtension: options.performanceExtension }),
      };
      try {
        recorder = createProseMirrorDispatchRecorder(recorderOptions);
        unregister = nextUnregister;
        registeredView = view;
      } catch (error) {
        nextUnregister();
        throw error;
      }
    } finally {
      registering = false;
    }
  };

  const requireRecorder = (operation: string): DispatchRecorder => {
    registerWhenReady();
    if (recorder) return recorder;
    throw new Error(`[prosemirror-devtools] Tiptap's EditorView is not available in ${operation}.`);
  };

  return {
    options,
    setup() {
      if (options.instrumentPlugins !== false) {
        restorePluginGetter = installPluginInstrumentation(
          editor,
          options,
          sessionId,
          () => active,
          registerWhenReady,
        );
      }
      registerWhenReady();
    },
    attach() {
      requireRecorder("attachTiptapDevtools");
    },
    dispatch(props) {
      requireRecorder("dispatchTiptapTransaction").record(props.transaction, () =>
        props.next(props.transaction),
      );
    },
    detach() {
      if (!active) return;
      active = false;
      try {
        unregister?.();
      } finally {
        recorder = null;
        unregister = null;
        registeredView = null;
        try {
          (options.store ?? prosemirrorDevtoolsStore).closeSession(options.id, sessionId);
        } finally {
          restorePluginGetter();
        }
      }
    },
  };
}

/**
 * Prepares plugin instrumentation for a Tiptap editor. Call this from the
 * application's Tiptap extension `onBeforeCreate` hook.
 *
 * The EditorView is registered eagerly when Tiptap exposes it while generating
 * plugins; `attachTiptapDevtools` remains the explicit lifecycle fallback.
 */
export function setupTiptapDevtools(
  editor: TiptapDevtoolsEditor,
  options: TiptapDevtoolsOptions,
): void {
  const existing = integrations.get(editor);
  if (existing) {
    if (existing.options.id !== options.id || existing.options.store !== options.store) {
      throw new Error(
        `[prosemirror-devtools] This Tiptap editor is already configured as "${existing.options.id}".`,
      );
    }
    return;
  }

  const integration = createTiptapIntegration(editor, options);
  integrations.set(editor, integration);
  try {
    integration.setup();
  } catch (error) {
    integrations.delete(editor);
    integration.detach();
    throw error;
  }
}

/**
 * Registers the Tiptap EditorView. Call this from the application's Tiptap
 * extension `onCreate` hook.
 */
export function attachTiptapDevtools(editor: TiptapDevtoolsEditor): void {
  const integration = integrations.get(editor);
  if (!integration) {
    throw new Error(
      "[prosemirror-devtools] setupTiptapDevtools must be called from onBeforeCreate before attachTiptapDevtools.",
    );
  }
  integration.attach();
}

/**
 * Measures Tiptap 3's native dispatch middleware without replacing the
 * EditorView dispatcher. Call this from the application's `dispatchTransaction`
 * extension hook and always pass its complete props object.
 */
export function dispatchTiptapTransaction(
  editor: TiptapDevtoolsEditor,
  props: TiptapDispatchTransactionProps,
): void {
  const integration = integrations.get(editor);
  if (!integration) {
    throw new Error(
      "[prosemirror-devtools] setupTiptapDevtools must be called from onBeforeCreate before dispatchTiptapTransaction.",
    );
  }
  integration.dispatch(props);
}

/**
 * Restores the plugin getter and unregisters the view. Call this from the
 * application's Tiptap extension `onDestroy` hook. Repeated calls are safe.
 */
export function detachTiptapDevtools(editor: TiptapDevtoolsEditor): void {
  const integration = integrations.get(editor);
  if (!integration) return;
  integrations.delete(editor);
  integration.detach();
}
