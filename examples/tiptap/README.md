# Run the native Tiptap fixture

Run `pnpm --filter @prosemirror-devtools/tiptap-demo dev` after building `prosemirror-inspector`. Open port 4181.

The fixture uses Tiptap core, React, StarterKit, and PM 3.31.4 with React 19.2.8. The compatible shared ProseMirror view is 1.42.3. StarterKit's trailing-node extension is disabled to keep the list fixture stable.

Tiptap owns the dispatcher. Its native `dispatchTransaction` middleware calls the recorder once. `onBeforeCreate` prepares instrumentation, and `onDestroy` performs final disposal. A React effect resumes registration and suspends it on cleanup. Suspension preserves instrumented plugins across Strict Mode replay and releases the old registration before a keyed remount. `onCreate` cannot reactivate a suspended old editor.

Use **Reset fixture** or the instrumentation selector to recreate the editor. The dispatch-only option leaves plugin hooks outside coverage. Plugins installed later with `registerPlugin` stay functional but are not instrumented by the initial extension-manager getter.

The fixture guards extension registration and the panel with `devtoolsEnabled` from `src/env.ts`: development, or a showcase build with `VITE_SHOWCASE=true`. No generic attach helper is combined with native middleware.

The real editor also registers the Tiptap extension inspector. Read-only queries expose active extensions, inherited priorities, bounded options, and current `editor.storage` samples. Storage changes between query or dispatch samples are unobserved. No plugin association is inferred for StarterKit extensions.
