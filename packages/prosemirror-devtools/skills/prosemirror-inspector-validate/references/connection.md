# Connect to inspection evidence

This reference travels with each skill. Read the installed prosemirror-inspector README for editor setup. Its package.json identifies the installed version. In this repository the guide is packages/prosemirror-devtools/README.md.

## Native WebMCP

Await installProseMirrorWebMCPBridge(client) from prosemirror-inspector/agent behind the application development guard. It registers the same five read-only tools on document.modelContext, or the earlier navigator.modelContext when available. It returns a cleanup function, or null when the browser does not support registration. Registration failures reject and remove the partial registration.

A WebMCP-capable browser agent discovers and calls the registered tools directly. No Chrome DevTools MCP server is required for this route. Dispose the registration when its host is removed. Current browsers use AbortSignal cleanup. The adapter supports unregisterTool cleanup for the earlier navigator API. It does not install a polyfill or enable browser features.

The [native WebMCP guide](https://developer.chrome.com/docs/ai/webmcp/imperative-api) documents registration and browser support. Tools are annotated read-only, debugging, and untrusted-content because editor content can be user supplied. Native WebMCP remains experimental.

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

Without third-party MCP tools, select the editor and use Transactions, Events, or Follow live to choose the observation. Undo history and Collaboration appear when the editor has the matching inspectors. Open Raw data in either view for the sampled values. Open Context for recording status, gaps, and installed inspectors. For the observation identity, expand Technical details and then Coverage and read point under Capabilities and coverage.

In Context, use Copy diagnostic context when the environment permits it. The panel provides a textarea fallback. Reading the visible diagnostic panes is sufficient when clipboard access is unavailable. Do not request clipboard permissions merely to inspect evidence.

A host-side runner can use createProseMirrorInspectionClient({store}) and createProseMirrorAgentTools(client) through the public package entries. Neither requires a window global. The plain browser route can remain entirely UI based. Missing structured access leaves only the affected checks inconclusive.

The standalone fixture also exposes a diagnostic recording download. Treat it as captured evidence, not proof of a new browser action. No hidden transaction or document mutation is part of discovery.
