# Evidence protocol

The inspection catalogue reports protocol version and available queries. The agent tools expose
catalogue, editor listing, inspection, reads at a returned point and semantic checks. Discover tool
schemas from the active connection rather than copying stale arguments from a previous run.

Read the query definitions and prerequisites from the active catalogue. Availability is explicit.
Responses include target, observation point and coverage.

The runtime owns committed dispatches, selected semantic projections, provenance and capture gaps.
The browser runner owns the action trace, screenshots and video. Compute detailed differences and
current DOM locations on demand. A marker identifies a time window, not the cause of every event
inside that window.

Use completeness `value` for a current-state expectation that does not require complete history.
Use completeness `capture` for a claim requiring all relevant captured transitions. Truncated values
cannot prove an equality against the whole value. A paused or evicted trace can leave causality
inconclusive while a current-document expectation passes.

An offline recording preserves observations from another run. It cannot prove current UI behavior
or receive commands that silently target a live editor. Changing an editor mount invalidates old
DOM references and live targets. Name the destination explicitly before any requested restore.

Maintain one verdict per expectation, with its proof references. Include unsupported versions or
missing capabilities. Do not claim a speedup from hook durations or a screenshot.

For a known nested evidence wrapper, pass its path in the semantic assertion's `requiredEvidence`.
Check its availability before reading `value`. The evaluator does not interpret arbitrary
application objects as evidence wrappers.
