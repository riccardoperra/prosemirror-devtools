# Split a list item and undo

Use a fixture with a known list document, the official history plugin, an isolated initial history
and working UI controls for undo. The fixture must declare the expected cursor position after
splitting. Do not reset a user's document without authorization.

1. Read editor identity, session, current document, selection and history capability. Save the
   starting observation point and visible fixture state.
2. Place the cursor at the fixture's declared split position through the browser. Wait for the
   committed selection to match it before sampling the baseline. Press Enter.
3. Wait until the extra list item is visible and the corresponding committed document is available.
   Save the new point and inspect selection, transactions and the history contribution.
4. Compare the document structure and selection with the fixture expectation. A valid schema alone
   does not prove that the application performed the requested split.
5. Execute Undo through the application's visible control or supported keyboard shortcut.
6. Wait for the fixture's initial document to return. Inspect the new dispatch and history summary.
   Keep a historical panel selection pinned if the scenario checks navigation while the live editor
   advances.
7. Report the split and undo expectations independently. Attach browser proof for the visible list
   and point references for document, selection and history. Missing history evidence leaves the
   causal claim inconclusive rather than inventing an undo group.

Run once with structured inspection and once through the accessible panel when verifying parity
with computer use. Both runs must use the real editor interaction. Browser artifacts remain with
the runner and can be referenced by the validation report.
