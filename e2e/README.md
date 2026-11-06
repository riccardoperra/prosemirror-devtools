# Verify the browser consumers

Build the workspace, install Playwright's Chromium, then run the browser suite from the repository root.

```sh
pnpm build
pnpm exec playwright install chromium
pnpm test:browser
```

The configuration starts development and production servers for standalone ProseMirror, Tiptap, controlled React ProseMirror, and collaboration. Local runs reuse servers on ports 4180 to 4183 and 4280 to 4283. Stop older servers before testing a changed package export map. CI starts fresh servers.

To test an installed Chrome executable, set `PLAYWRIGHT_EXECUTABLE_PATH` to its absolute path. The default uses Playwright's installed Chromium.

## Observations

The suite performs Enter, Undo, reset, panel navigation, and profile selection through browser controls. The structured route reads the opt-in diagnostic discovery bridge. It does not dispatch hidden editor transactions.

The UI-only V5 test does not evaluate JavaScript or use the bridge. It reads editor content, caret and dispatch status, event links, historical context, and history projections through named controls.

| Scenario | Browser proof                                                                                                                                                                                                                                                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2       | Enter creates a second list item and caret 12. Undo restores the original document, caret 8, and public history depths. A pinned historical document stays readable.                                                                                                                                                                               |
| V3       | Official collaboration converges while capture is paused, exposes confirmed version 2 and an explicit gap, and leaves trace completeness inconclusive. Yjs local undo preserves the other peer's concurrent edit.                                                                                                                                  |
| V4       | Reset expires the earlier live target. An exported recording opens as a separate offline source. Its before and after selection and history projections remain readable. A rejected import preserves the prior viewer and live document.                                                                                                           |
| V5       | The list scenario runs through structured evidence and through UI alone. The narrow viewport retains named navigation and context.                                                                                                                                                                                                                 |
| V6       | Attach-only capture preserves the correct document while an input-trace expectation returns inconclusive.                                                                                                                                                                                                                                          |
| I2       | Two standalone hosts retain different dispatch selections while sharing one capture. Closing the additional host leaves the live editor and first host active.                                                                                                                                                                                     |
| V7       | Tiptap and controlled React ProseMirror each survive three remounts without duplicate gesture capture. The controlled State and Selection panels follow the authoritative model and agree with pinned query reads. Production fixtures retain editor behavior and expose no diagnostics or discovery bridge, including both collaboration systems. |

Screenshots and structured observation JSON are test attachments. Failures retain a trace and a screenshot under `test-results`. The HTML report is under `playwright-report`.

The bridge test uses Chrome's experimental diagnostic discovery event. It does not prove a particular MCP client is connected. The suite does not claim asynchronous paint timings, automatic command naming, or causal attribution for work outside observed handlers.

## Verify the official Chrome MCP connection

After the package build and browser installation, run the isolated MCP check.

```sh
pnpm test:chrome-mcp
```

The runner starts a standalone fixture on an available loopback port. Playwright launches a browser with a temporary profile. Chrome DevTools MCP connects to that browser over a loopback CDP endpoint. It discovers all five Inspector tools through the official MCP client, reads the document and selection at the same point, and checks a semantic expectation. It disables caller JavaScript evaluation, usage statistics, and global MCP configuration discovery. It closes its browser and fixture after success or failure.

The proof is written to `test-results/chrome-mcp.json`. `PLAYWRIGHT_EXECUTABLE_PATH` selects an installed Chrome executable. Without that variable the check uses Playwright's installed Chromium. The bridge remains experimental even when this pinned client passes.
