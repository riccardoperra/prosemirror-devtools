---
name: prosemirror-inspector-integrate
description: Integrate ProseMirror Inspector into ProseMirror, Tiptap or React ProseMirror and verify registration, capture capabilities and cleanup. Use when adding or repairing an integration, rather than diagnosing an already connected editor.
metadata:
  inspection-protocol: "1"
---

# Integrate ProseMirror Inspector

Connect the user's editor through its actual lifecycle. Choose the editor integration separately
from the panel host. Read the installed package guide and the capabilities returned by the
inspection client before promising support.

Read [the connection reference](references/connection.md) to find public APIs, experimental Chrome
discovery, the installed guide, or the UI-only route. Do not guess Inspector window globals.

## Connect the editor

For raw ProseMirror, create a session before creating plugins when hook diagnostics are required.
Pass the instrumented plugins into EditorState, then attach the finished view. An attach-only
integration can record dispatches but does not make uninstrumented hooks observable.

For Tiptap 3, use the dedicated lifecycle and transaction middleware integration from the installed
package guide. Keep middleware enabled. Never attach the same view through the generic core path.
Do not infer that dynamically registered plugins were instrumented.

For controlled React ProseMirror, use its view-consistent lifecycle and the dedicated integration.
The application owns state application. A synchronous model change can precede the React view
commit. Do not call view.updateState to make a measurement look complete or apply a transaction twice.

Mount the shared panel standalone or in TanStack. A framework adapter for the panel does not replace
the editor's own lifecycle integration. Registration and recording can exist without a panel.

## Verify the integration

Identify the exact editor and session through the diagnostic catalogue or the visible editor
selector. Perform a user action in the real editor. Compare the captured dispatches with the consumer's
expected path. Focus and selection changes can produce legitimate dispatches. Confirm that each
application dispatch is recorded once. Several appended transactions can belong to one dispatch.

Check the resulting document and selection, then remount and dispose the editor. Old registrations
and overlays must not target the replacement session. Check the capture capabilities instead of
treating an empty diagnostics view as proof that no handler ran.

Inspect the consuming application's production build. Normal framework adapters disable themselves
outside development. Core, native panel and Tiptap calls require the documented development guard.
An explicit production entry is a separate user choice.

Report the versions, editor integration, host, capture profile, observed behavior and unsupported
capabilities. Do not change package managers, provider implementations or production activation
unless that change belongs to the user's request.

If disposal or overlay controls are absent, mark those checks unverified. Obtain versions from the
installed package and consumer guide. A visible panel alone does not establish dependency versions.
