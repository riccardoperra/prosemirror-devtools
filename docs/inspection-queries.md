# Inspection query reference

Generated from the public inspection catalogue. Run `pnpm docs:generate` after a catalogue change.

All query results declare a target, an observation point, and coverage. A historical query never substitutes current editor state.

| Query           | Meaning                                                             | Prerequisites                                                                    |
| --------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `document`      | Read document JSON or a bounded position range.                     | A current state or retained dispatch document.                                   |
| `selection`     | Read the selection at the selected point.                           | A current state or retained dispatch selection.                                  |
| `transactions`  | Search retained dispatch summaries in invocation order.             | Dispatch capture.                                                                |
| `transaction`   | Read one retained dispatch, applied steps, and observed provenance. | The requested dispatch remains retained.                                         |
| `contributions` | Read installed semantic inspector projections.                      | Register at least one semantic inspector.                                        |
| `contribution`  | Read one named semantic inspector projection.                       | Register the requested semantic inspector.                                       |
| `capabilities`  | Discover installed queries and their prerequisites.                 | None.                                                                            |
| `events`        | Search observed synchronous handler and command events.             | Enable diagnostics and instrument the relevant plugin or command.                |
| `decorations`   | Read observed decoration ranges and their current validity.         | Enable diagnostics and observe the decorations callback.                         |
| `nodeViews`     | Read observed NodeView lifecycle summaries.                         | Enable diagnostics and instrument NodeView factories.                            |
| `schema`        | Read declarative schema constraints at the current state.           | A current editor state.                                                          |
| `plugins`       | Read plugin order, props, and bounded current state evidence.       | A current editor state. Historical state needs an explicit inspector serializer. |

## Default query limits

| Limit             | Value  |
| ----------------- | ------ |
| `maxItems`        | 100    |
| `maxDepth`        | 24     |
| `maxNodes`        | 4000   |
| `maxStringLength` | 16000  |
| `maxBytes`        | 128000 |

Requested query limits can reduce these defaults. A value that exceeds a serialization budget returns explicit evidence of the error.
A list shortened by an item limit sets `coverage.truncated`. Unavailable, disabled, expired, and unobserved evidence remain distinct.
