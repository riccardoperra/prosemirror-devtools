# Angular adapter demo

Runs the ProseMirror DevTools Angular adapter inside TanStack Angular Devtools.

The app uses the Angular CLI application builder, Angular's default zoneless change detection,
and signal-based state, inputs, and view queries.

The local CLI cache and dependency prebundling are disabled so `ng serve` keeps generated assets
inside the active Git worktree.

```sh
pnpm --filter @prosemirror-devtools/angular-demo dev
```
