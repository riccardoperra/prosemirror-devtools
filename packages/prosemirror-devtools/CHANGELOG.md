# prosemirror-inspector

## 0.1.0

### Minor Changes

- 1db65c9: Add read-only agent tools, semantic checks with explicit evidence requirements, experimental Chrome discovery, and three versioned agent skills with real integration fixtures.
- 4a3d144: Add explicit inspection targets, coherent bounded queries, capture gaps, semantic history and collaboration providers, native editor recorders, and diagnostic recordings.
- acafcdd: Add host-local historical navigation, contextual document inspection, checkpoint comparison, and a separate read-only recording viewer.
- 21e6e13: Add native WebMCP registration for the shared read-only inspection tools. Restore the compact live header and move diagnostic details to a separate Context panel. Group related dispatch links to keep transaction details visible.

## 0.0.2

### Patch Changes

- cd09438: Preserve plugin subclass prototypes during instrumentation so `instanceof` checks and custom fields, accessors, and methods continue to work, including methods that use private fields.

## 0.0.1

### Patch Changes

- dc13c96: Refresh the package documentation with a shorter getting-started flow, clear standalone and
  TanStack Devtools hosting paths, and focused framework, Tiptap, feature, and API guidance.
- 05d745e: Expose UI-independent plugin timing aggregation and related types from the new
  `prosemirror-inspector/performance` feature entrypoint.

  Add dependency-free `prosemirror-inspector/tiptap` lifecycle helpers that instrument Tiptap's
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
