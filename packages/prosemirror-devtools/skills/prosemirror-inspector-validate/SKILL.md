---
name: prosemirror-inspector-validate
description: Validate a requested ProseMirror editor behavior using actual browser actions and ProseMirror Inspector evidence, optionally through computer use alone. Use for behavioral verification, regression reproduction or acceptance checks, not source-only review.
metadata:
  inspection-protocol: "1"
---

# Validate an editor behavior

Validate the user's expected behavior in the running application. The expectation comes from the
user, an acceptance scenario or the application's tests. ProseMirror invariants do not define every
application's intended behavior.

Read [the evidence protocol](references/evidence.md) before the first run. Use
[the list and undo scenario](references/list-undo.md) when a compatible fixture is available.

Read [the connection reference](references/connection.md) to find public APIs, experimental Chrome
discovery, the installed guide, or the UI-only route. Do not guess Inspector window globals.

## Establish the run

Identify the browser surface, editor, session and starting document. Check runtime protocol and
capabilities. Select either browser actions plus structured inspection, or computer use with the
accessible panel. If a required capability is absent, record the affected expectation as
inconclusive or choose an equivalent source of evidence that actually proves it.

Acquire a starting observation point and record the action method. Scope the run to one editor.
Agents that modify editors concurrently need separate fixtures or ordered actions.

## Act and check

Perform the action through the application's actual controls, keyboard and editor. Directly
dispatching a hidden transaction does not prove that a shortcut or toolbar works.

Wait for the scenario's explicit condition, with a bounded timeout. The expected visible change,
committed document and provider synchronization signal can be separate conditions. Event silence
or an arbitrary sleep does not prove that all asynchronous work finished.

Inspect the resulting document, selection and relevant diagnostics. Reuse a returned read point
for related queries. A changed or expired point requires a fresh inspection. Use live current-state
checks separately from claims that require complete capture.

When using computer use alone, follow the panel's named controls and direct links. Copy the selected
diagnostic context when available. Do not assume JavaScript evaluation or a specific browser vendor
is installed. A screenshot-only route can prove visible results but may leave internal causality
inconclusive.

When checking a value inside a known nested evidence wrapper, declare its path in `requiredEvidence`.
Read the wrapper's availability before comparing its value. This includes Tiptap options, storage,
and provider-specific optional signals. Generic JSON predicates do not infer evidence from an
application property named `kind`.

## Report each expectation

Mark an expectation passed only when its required evidence satisfies it. Mark it failed when the
evidence demonstrates a difference. Mark it inconclusive when a required proof is unavailable,
truncated, expired or outside the capture.

Attach the scenario version, session target, actual actions, point/dispatch references, required
browser evidence and remaining limits. Do not turn a semantically correct document into a claim
that rendering is correct. Do not treat a screenshot as proof of hidden plugin state.
