# Debug undo and collaboration from captured events

**Status.** Contextual prototype for review.

The first kitchen sink prototype gave Undo history and Collaboration their own tabs with counters and a JSON disclosure. Those counters describe an editor, but a developer investigating a missing edit still has to find the relevant action, dispatch, or provider signal. A view should help them finish that investigation before it earns space in the tab bar.

## Start with three investigations

| Question                                                              | What the inspector should show                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why did this edit disappear when I pressed Undo?                      | The observed command and its dispatch, the changed document range, and the undo and redo depths before and after. For an edit with `addToHistory: false`, show the explicit exclusion on that edit.                                                                   |
| A sees an edit. Why does B still show the old document?               | The pending steps and confirmed version on A. Show the latest transport signal separately when the host observes it. Let the developer inspect B at its own observation point.                                                                                        |
| Did Yjs apply a local edit, a remote update, or a collaborative undo? | The latest observed Yjs transaction and update, their local or remote direction, and the origin if the host can describe it. Show the binding's undo counts when available. Open the related ProseMirror dispatch only if the integration recorded that relationship. |

## Two layouts to compare

| Layout                                         | What you can do in it                                                                                                                 | Cost                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Contextual sections in Transactions and Events | Read the effect of a specific edit or command next to the document diff. Keep one selected dispatch and use the existing event links. | Comparing peers requires switching editors. Provider changes can happen between editor dispatches.                                         |
| One Collaboration workspace for both bindings  | Compare A and B, then follow a pending edit through observed send, receive, and acknowledgement. Use binding-specific columns.        | It needs bounded provider history, freshness, and explicit correlation. A latest-signal sample alone yields another dashboard of counters. |

Prototype the contextual layout first. In **Transactions**, add compact **Undo effect** and **Sync effect** sections only when the selected dispatch has those samples. Reuse **Events** to inspect a command and the dispatches observed during it. Keep **Context** for capture coverage and inspector details. Start with one sentence per finding. Expand supporting observations and raw JSON on demand.

Prototype a peer comparison separately if switching editors prevents a user from finding where delivery stopped. Show each peer’s observation time and the last stage the app actually observed. An absent acknowledgement remains unknown unless the provider reports a timeout or error. A dedicated Collaboration view earns its place if a developer can compare two explicitly identified peers, follow retained delivery events, and jump to observed linked dispatches. A dedicated Undo history view would need a navigable set of undo events or groups, with evidence for membership and undo effects. The current history adapter already supports dispatch-level explanations.

### Example readouts

These are illustrative readouts for a fixture run. The values and links come from the selected editor, its retained samples, and its observation point.

> **A · Dispatch 18 · After**
>
> - **Undo effect** · Undo depth stayed at 2. This edit set `addToHistory: false`.
> - **Sync effect** · Pending steps rose from 0 to 1. Confirmed version stayed at 7.
> - **Transport** · The host last observed receive message 12. Link to this dispatch unknown.
> - **Actions** · Inspect document diff · Show raw sample

> **B · Current Yjs sample**
>
> - **Latest document update** · Remote · sequence 9 · 182 bytes.
> - **Undo scope** · Binding UndoManager · one undo available.
> - **Dispatch link** · Unknown. The Yjs update and editor dispatch were sampled separately.

At a narrow panel width, show the selected observation as a single column. At a wider width, keep the existing resizable list and detail panes. Use the same order in both layouts so the finding precedes its evidence.

## Evidence and ownership

- **ProseMirror history** captures depths before and after a dispatch and classifies root and observed applied transactions using public APIs and metadata. Treat an unchanged depth as a fact. Group membership and the reason edits merged into one undo event require more evidence. [ProseMirror history source](https://github.com/ProseMirror/prosemirror-history/blob/master/src/history.ts)
- **ProseMirror collab** captures confirmed version, unconfirmed step count, and origins of pending steps before any rebase. Show an origin as original transaction metadata. A matching timestamp does not establish a dispatch link. Read message direction and acknowledgement from the optional host transport observer. The observer retains the latest signal and aggregate counts today. [ProseMirror collab source](https://github.com/ProseMirror/prosemirror-collab/blob/master/src/collab.ts)
- **Yjs** samples the latest transaction and update, their direction, the binding UndoManager when supplied, and an optional transport snapshot. Preserve independent sequences and sample time. Provider changes can arrive without a ProseMirror dispatch. A Yjs update sequence is specific to this observer. If the prototype needs undo activity beyond depths, evaluate the binding manager’s stack events. [Y.Doc API](https://docs.yjs.dev/api/y.doc) · [Yjs UndoManager API](https://docs.yjs.dev/api/undo-manager)
- **Observation points** belong to an editor session and generation. The existing contribution query exposes retained dispatch projections at After. Where the same retained projection explicitly includes Before fields, present them as a labeled comparison in the dispatch detail. Explain missing, expired, and truncated observations. Keep live samples separate from pinned or offline data.
- **Presentation** turns structured contributions into findings, values, and links. Keep that mapping in the panel layer. Inspectors own capture and serialization. Keep raw JSON behind a disclosure and use the existing contributions for MCP and recordings. Add a versioned observation type only if the collaboration prototype proves that current projections cannot answer a real investigation.

## Work and acceptance

1. **Prototype the contextual sections with current data.** In the kitchen sink, deliver an excluded edit and use Transactions to identify its explicit opt-out. Undo an eligible edit and inspect its changed range and depth transition. An observed command in Events links to the right retained dispatch. An unknown link stays labeled unknown.
2. **Verify the boundary cases in both collaboration modes.** Hold an official Collab edit in A, find the pending step and unchanged version, then deliver it and verify the version advance and B's document. In Yjs, make one edit per peer and undo A's local edit. Verify B's edit remains and a remote update is visible on the receiving peer. With no provider observer, show that transport was unobserved.
3. **Compare the peer workspace only if the contextual flow leaves a gap.** Reproduce a held message or a provider-reported acknowledgement timeout. Check whether the workspace can identify the last observed stage and offer a next action with fewer view switches. If it needs a bounded event feed, first specify host observation, retained identity and links, freshness, and export limits. Compare the two layouts on the same trace at wide and narrow widths before adding a tab.
4. **Verify offline and agent parity.** Export the same case and reopen it offline. The detail labels the recorded observation and preserves gaps. Query the same editor and point via MCP. The panel and agent receive matching counts and link availability without reading the editor DOM.

## What the prototype shows

The selected dispatch in Transactions shows the captured undo and sync changes above its details or diff. An Events call shows the same summary for its retained dispatch links. The raw samples open on demand in Transactions. The panel reads the existing captured projections, and the prototype adds a kitchen sink button for an edit explicitly excluded from undo history.

The dispatch list shows a badge when a projection describes a meaningful change or an explicit history action. The demo traces the official collaboration receive and confirmation calls at the application boundary. Both calls include the batch ID and link to their retained editor dispatch in Events.

Transactions and Events render the same presentation model. A presenter matches a captured inspector ID and version and returns an optional badge, list label, and detail. Editors that do not install the inspector have no corresponding projection or badge. The presenters read serialized data and require no optional editor dependencies. Hosts can register their own presenters through `DevtoolsExtension.dispatchPresenters`. The kitchen sink's Text impact inspector registers its presenter in one host and shares the same captured data with the second host.

Holding one official Collab edit makes pending steps rise from zero to one. The confirmation dispatch clears that step and advances the confirmed version. The observed Undo call links to the dispatch that changes the document and moves one entry from undo to redo.

In the Yjs fixture, the Undo call links to the dispatch that removes A's edit while preserving B's. The sample captured during that dispatch can still refer to a preceding remote update. The view labels the last observed update separately from the dispatch and keeps unsettled UndoManager counts in the raw sample. A peer workspace would need independent update retention and explicit linkage to make a delivery timeline useful. Review the contextual flow in the kitchen sink before adding that workspace.
