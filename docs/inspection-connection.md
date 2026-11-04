# Connect to inspection evidence

This reference travels with each skill. Read the installed prosemirror-inspector README for editor setup. Its package.json identifies the installed version. In this repository the guide is packages/prosemirror-devtools/README.md.

## Chrome DevTools MCP

The application opts in through installProseMirrorChromeBridge(client) from prosemirror-inspector/agent, behind its development guard. No Inspector window global is required.

A compatible Chrome DevTools MCP server enables third-party tools with --categoryExperimentalThirdParty=true. Its list_3p_developer_tools MCP tool discovers the page's tool group and input schemas. execute_3p_developer_tool executes a discovered tool for that pageId. Its params argument is JSON text. Read the actual schemas before constructing a request.

The upstream [third-party tool guide](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/third-party-developer-tools.md) and [tool reference](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md) describe this experimental contract. Do not change the agent's global MCP configuration automatically.

The bridge answers devtoolstooldiscovery on window. It does not install a window.__dtmcp global. That global, when present, belongs to the Chrome MCP client. A plain browser runner does not establish that an MCP client is connected.

| Tool                  | Meaning                                                                                                                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prosemirror_catalog` | Read protocol version, source and supported query descriptions.                                                                                                                                                                                                            |
| `prosemirror_editors` | List up to 100 live or recorded editors and their explicit session targets and capabilities.                                                                                                                                                                               |
| `prosemirror_inspect` | Read evidence for an explicit editor/session. Query parameters include document from/to, transaction id, transactions afterId/beforeId/applicationStatus, contribution id or events afterId/name.                                                                          |
| `prosemirror_read`    | Read another query at the exact point returned by an earlier inspection. Expired points require a new inspection.                                                                                                                                                          |
| `prosemirror_check`   | Evaluate a semantic expectation. Set completeness to value for current state or capture when complete trace evidence is required. Declare requiredEvidence paths for known nested evidence wrappers before comparing their values. This does not verify browser rendering. |

## Browser and computer use

Without third-party MCP tools, use the visible editor selector and Inspectors and capture coverage. Expand Coverage and read point for target, session, source, protocol, and coverage evidence. Use Transactions, Events, and Follow live to keep observations at an explicit point.

Use Copy diagnostic context only when the environment permits it. The panel provides a textarea fallback. Reading the visible diagnostic panes is sufficient when clipboard access is unavailable. Do not request clipboard permissions merely to inspect evidence.

A host-side runner can use createProseMirrorInspectionClient({store}) and createProseMirrorAgentTools(client) through the public package entries. Neither requires a window global. The plain browser route can remain entirely UI based. Missing structured access leaves only the affected checks inconclusive.

The standalone fixture also exposes a diagnostic recording download. Treat it as captured evidence, not proof of a new browser action. No hidden transaction or document mutation is part of discovery.
