import {
  attachTiptapDevtools,
  detachTiptapDevtools,
  dispatchTiptapTransaction,
  setupTiptapDevtools,
  type TiptapDevtoolsEditor,
  type TiptapDevtoolsOptions,
  type TiptapDispatchTransactionProps,
} from "./lifecycle";

/** The `this` Tiptap binds in extension hooks, reduced to the part the hooks read. */
export interface TiptapDevtoolsHookContext<TEditor extends TiptapDevtoolsEditor> {
  readonly editor: TEditor;
}

/** Extension hooks to spread into the application's own `Extension.create` config. */
export interface TiptapDevtoolsHooks<TEditor extends TiptapDevtoolsEditor> {
  onBeforeCreate(this: TiptapDevtoolsHookContext<TEditor>): void;
  onCreate(this: TiptapDevtoolsHookContext<TEditor>): void;
  dispatchTransaction(
    this: TiptapDevtoolsHookContext<TEditor>,
    props: TiptapDispatchTransactionProps,
  ): void;
  onDestroy(this: TiptapDevtoolsHookContext<TEditor>): void;
}

/**
 * Returns the four Tiptap extension hooks that set up, attach, measure, and detach the inspector.
 * Pass a function when an option needs the editor, such as `createTiptapInspector({ editor })`.
 */
export function createTiptapDevtoolsHooks<
  TEditor extends TiptapDevtoolsEditor = TiptapDevtoolsEditor,
>(
  options: TiptapDevtoolsOptions | ((editor: TEditor) => TiptapDevtoolsOptions),
): TiptapDevtoolsHooks<TEditor> {
  return {
    onBeforeCreate() {
      setupTiptapDevtools(
        this.editor,
        typeof options === "function" ? options(this.editor) : options,
      );
    },
    onCreate() {
      attachTiptapDevtools(this.editor);
    },
    dispatchTransaction(props) {
      dispatchTiptapTransaction(this.editor, props);
    },
    onDestroy() {
      detachTiptapDevtools(this.editor);
    },
  };
}
