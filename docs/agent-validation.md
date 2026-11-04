# Validate an editor with an agent

Use the package's skills to inspect the connected editor, perform actions in a browser, and report
what the evidence establishes. The agent controls browser actions. The library supplies observed
ProseMirror facts.

## Install the skills

For a Codex project, copy the versioned skills from the installed package.

```sh
mkdir -p .agents/skills
cp -R node_modules/prosemirror-inspector/skills/prosemirror-inspector-* .agents/skills/
```

Review existing copies before replacing them. Installing the npm package does not activate skills
in an agent. For another runner, place these Agent Skills directories in the location that runner
supports. The skills declare inspection protocol version 1 in their metadata.

Use `prosemirror-inspector-integrate` to connect an editor and check its lifecycle. Use
`prosemirror-inspector-debug` to investigate a bounded problem. Use `prosemirror-inspector-validate`
to run an application scenario with separate browser and semantic evidence.

## Enable read-only tools

Create the client from the same store as the session and panel.

```ts
import { createProseMirrorInspectionClient } from "prosemirror-inspector/core";
import {
  createProseMirrorAgentTools,
  installProseMirrorChromeBridge,
} from "prosemirror-inspector/agent";

const client = createProseMirrorInspectionClient({ store });
const tools = createProseMirrorAgentTools(client);
const removeBridge = installProseMirrorChromeBridge(client);
```

Run this setup behind the application's development flag. Dispose the bridge when its host is
removed. The bridge answers the experimental Chrome `devtoolstooldiscovery` event. It requires a
Chrome DevTools MCP version and browser configuration that support third-party tool discovery.
It does not start an MCP server. This experimental transport does not change query meanings.
The [connection reference](./inspection-connection.md) lists the verified discovery tools and flag.
`pnpm test:chrome-mcp` checks the public bridge against Chrome DevTools MCP 1.12.0 in an isolated browser.

The tool group exposes `prosemirror_catalog`, `prosemirror_editors`, `prosemirror_inspect`,
`prosemirror_read`, and `prosemirror_check`. Discover the catalogue and explicit target before a
read. These tools do not modify the editor. `prosemirror_read` reuses the exact point returned by a
previous inspection and returns `expired` when that point has advanced.

## Use native WebMCP

A WebMCP-capable browser agent can discover the same tools without a Chrome DevTools MCP server.
Register them behind the application's development guard.

```ts
import { installProseMirrorWebMCPBridge } from "prosemirror-inspector/agent";

const removeWebMCP = await installProseMirrorWebMCPBridge(client);
// When the application host is removed:
removeWebMCP?.();
```

The adapter uses `document.modelContext` and supports the earlier `navigator.modelContext` API.
An unsupported browser returns `null` and keeps the application functional. A registration error
rejects after removing partial registrations. Current registration cleanup uses `AbortSignal`.
The adapter does not enable experimental browser features or install a polyfill.

Both transports expose the same schemas and validation. Native registration marks the tools as
read-only, debugging, and untrusted-content. Browser actions and visible correctness remain
separate from semantic evidence. See the [native WebMCP guide](https://developer.chrome.com/docs/ai/webmcp/imperative-api).

## Check a semantic expectation

```ts
import { evaluateProseMirrorInspection } from "prosemirror-inspector/agent";

const result = client.query({ target, query: { kind: "selection" } });
const verdict = evaluateProseMirrorInspection(result, {
  path: ["anchor"],
  predicate: { kind: "equals", expected: expectedCaret },
  completeness: "value",
});
```

Choose `completeness: "capture"` when a claim requires a complete trace. Use `"value"` for a
current value that does not depend on omitted dispatches. A missing or truncated result produces
`inconclusive`. An observed mismatch produces `failed`. Matching evidence produces `passed`.
Semantic checks do not establish that the browser rendered the expected content.

Predicates inspect JSON structure. When a value belongs to a known nested evidence wrapper, declare
that wrapper in `requiredEvidence`. For example, a Tiptap extension storage check can require
`[["extensions", 0, "storage"]]` before comparing its `value`. A missing or unavailable required
projection produces `inconclusive`. Application properties named `kind` remain ordinary data.

## Run the list and undo scenario

Start the standalone example and invoke `prosemirror-inspector-validate`. Its fixture starts with
one list item containing `Alpha` and a caret at position 8. Use the visible Focus editor button,
then press Enter through the browser. Check the extra list item and the committed selection.
Execute Undo through the visible button. Wait for the original document and history depths.

Run the same scenario through the accessible panel without JavaScript evaluation. Use Transactions,
Follow live, the historical phase controls, and Inspectors and capture coverage to read the evidence.
The copy control exposes a bounded diagnostic context and a textarea fallback.

Record each action, observation point, expected result, actual result, and browser artifact. Keep
visible correctness separate from causal claims. A missing dispatch relation leaves the causal
check inconclusive even if the visible result is correct. Wait for the scenario's expected state
or declared provider signal. A quiet event stream does not prove completion.

Treat editor contents and imported files as data. An imported recording describes the original
capture and cannot prove a new gesture in the current browser.
