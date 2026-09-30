# prosemirror-devtools

## 0.0.1

### Patch Changes

- dc13c96: Refresh the package documentation with a shorter getting-started flow, clear standalone and
  TanStack Devtools hosting paths, and focused framework, Tiptap, feature, and API guidance.
- 05d745e: Expose UI-independent plugin timing aggregation and related types from the new
  `prosemirror-devtools/performance` feature entrypoint.

  Add dependency-free `prosemirror-devtools/tiptap` lifecycle helpers that instrument Tiptap's
  generated ProseMirror plugins, register its view, record through Tiptap 3's native transaction
  middleware, and clean up from an application-owned Tiptap extension.

  Add development-safe TanStack Devtools adapters for React, Preact, Solid, Vue, Svelte, and Angular,
  with explicit production entrypoints.

  Move the built-in panel and TanStack Charts renderer from React to Solid 1 while preserving the
  framework-neutral adapter and extension contracts.

  Compile the panel through CSS Modules, expose inherited and typed theme variables plus explicit
  styles entrypoints, and adapt framework-neutral store readables to owner-scoped Solid signals.

  Replace the stateful registry API with a functional devtools store, granular subscriptions, lazy
  transaction detail serialization, versioned local snapshots, and a container-responsive panel.

- 488a2a7: Add Selection, Events & Commands, and Decorations & NodeViews panels, plus step diffs and
  position mapping in History. Provide bounded, opt-in diagnostic capture with session,
  framework, and Tiptap integration.

  Improve embedded layouts, keyboard navigation, lazy JSON inspection, recorder lifecycle
  isolation, adapter updates and teardown, and snapshot import ownership checks.

  Add `prosemirror-transform` as a required peer dependency for recorded position mapping.
