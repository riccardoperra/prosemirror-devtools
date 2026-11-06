# Run the standalone list fixture

Run `pnpm --filter @prosemirror-devtools/standalone-demo dev` after building `prosemirror-inspector`. Open the address shown by Vite, using port 4180.

Click **Focus editor**, then press Enter. The single list item `Alpha` splits into a second empty item, with the caret at position 12. Click **Undo** to restore the original document and caret at position 8. **Reset fixture** recreates the editor with an isolated history.

The capture selector recreates the fixture with either instrumentation before EditorState creation or dispatch attachment alone. The latter does not capture existing plugin hooks or input handler provenance. Both use one session and the public `prosemirror-inspector/standalone` mount.

The fixture guards sessions and the panel with `import.meta.env.DEV`. The production build keeps the editor and disables diagnostics. Disposal removes the editor subscription, view, session, panel, and toolbar listeners.
