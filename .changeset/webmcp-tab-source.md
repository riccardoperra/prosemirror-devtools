---
"prosemirror-inspector": patch
---

The WebMCP panel separates the call history from the available tools. The call history shows each call's source (native WebMCP or Chrome DevTools MCP) and the result kind returned by the tool, such as `expired` or `inconclusive`, and the selected call's input, result and reason in a detail pane. Available tools lists native WebMCP registrations and the tools offered to Chrome DevTools MCP, including when an MCP client discovered them. `installProseMirrorChromeBridge` reports its tools to the WebMCP inspector passed as `inspector`.
