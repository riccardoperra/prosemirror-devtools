# Run the controlled React ProseMirror fixture

Run `pnpm --filter @prosemirror-devtools/react-prosemirror-demo dev` after building `prosemirror-inspector`. Open port 4182.

The fixture uses `@handlewithcare/react-prosemirror` 3.2.11 and its exact `prosemirror-view` peer 1.42.3. React and React DOM 19.2.8 use React Reconciler 0.33.0. These versions are coupled and must be updated together after native lifecycle verification.

The application owns EditorState. Its dispatcher applies a transaction once, updates an authoritative model reference, and passes the resulting state to React. The dedicated `prosemirror-inspector/react-prosemirror` connection reads that model before React commits the view. It does not patch the native dispatcher or call `view.updateState`.

A child connects through the library's `useEditorEffect`. Its cleanup disposes the connection. Strict Mode replay and **Reset fixture** create a fresh connection. Toolbar commands use `useEditorEventCallback` for safe view access.

The captured timing covers synchronous model application. Later React commits and uninstrumented plugin hooks remain outside timing coverage. The fixture guards the connection and panel with `devtoolsEnabled` from `src/env.ts`: development, or a showcase build with `VITE_SHOWCASE=true`.
