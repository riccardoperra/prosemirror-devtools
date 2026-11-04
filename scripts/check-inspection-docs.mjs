import assert from "node:assert/strict";
import { format } from "oxfmt";
import { readFile, writeFile, access, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createProseMirrorInspectionClient,
  defaultInspectionLimits,
  inspectionQueryCatalog,
} from "../packages/prosemirror-devtools/dist/core.js";

import { createProseMirrorAgentTools } from "../packages/prosemirror-devtools/dist/agent.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const reference = resolve(root, "docs/inspection-queries.md");
const row = (cells) =>
  `| ${cells.map((cell) => String(cell).replaceAll("|", "\\|")).join(" | ")} |`;
const source = [
  "# Inspection query reference",
  "",
  "Generated from the public inspection catalogue. Run `pnpm docs:generate` after a catalogue change.",
  "",
  "All query results declare a target, an observation point, and coverage. A historical query never substitutes current editor state.",
  "",
  row(["Query", "Meaning", "Prerequisites"]),
  row(["---", "---", "---"]),
  ...inspectionQueryCatalog.map((entry) =>
    row([`\`${entry.kind}\``, entry.description, entry.prerequisites.join(" ") || "None."]),
  ),
  "",
  "## Default query limits",
  "",
  row(["Limit", "Value"]),
  row(["---", "---"]),
  ...Object.entries(defaultInspectionLimits).map(([key, value]) => row([`\`${key}\``, value])),
  "",
  "Requested query limits can reduce these defaults. A value that exceeds a serialization budget returns explicit evidence of the error.",
  "A list shortened by an item limit sets `coverage.truncated`. Unavailable, disabled, expired, and unobserved evidence remain distinct.",
  "",
].join("\n");
const formatted = await format(reference, source, { printWidth: 100 });
assert.deepEqual(formatted.errors, []);
const text = formatted.code;
assert.equal(
  new Set(inspectionQueryCatalog.map((entry) => entry.kind)).size,
  inspectionQueryCatalog.length,
);
if (process.argv.includes("--write")) await writeFile(reference, text);
else
  assert.equal(
    await readFile(reference, "utf8"),
    text,
    "The inspection query reference is stale. Run pnpm docs:generate.",
  );
const connection = await format(
  "connection.md",
  [
    "# Connect to inspection evidence",
    "",
    "This reference travels with each skill. Read the installed prosemirror-inspector README for editor setup. Its package.json identifies the installed version. In this repository the guide is packages/prosemirror-devtools/README.md.",
    "",
    "## Native WebMCP",
    "",
    "Await installProseMirrorWebMCPBridge(client) from prosemirror-inspector/agent behind the application development guard. It registers the same five read-only tools on document.modelContext, or the earlier navigator.modelContext when available. It returns a cleanup function, or null when the browser does not support registration. Registration failures reject and remove the partial registration.",
    "",
    "A WebMCP-capable browser agent discovers and calls the registered tools directly. No Chrome DevTools MCP server is required for this route. Dispose the registration when its host is removed. Current browsers use AbortSignal cleanup. The adapter supports unregisterTool cleanup for the earlier navigator API. It does not install a polyfill or enable browser features.",
    "",
    "The [native WebMCP guide](https://developer.chrome.com/docs/ai/webmcp/imperative-api) documents registration and browser support. Tools are annotated read-only, debugging, and untrusted-content because editor content can be user supplied. Native WebMCP remains experimental.",
    "",
    "## Chrome DevTools MCP",
    "",
    "The application opts in through installProseMirrorChromeBridge(client) from prosemirror-inspector/agent, behind its development guard. No Inspector window global is required.",
    "",
    "A compatible Chrome DevTools MCP server enables third-party tools with --categoryExperimentalThirdParty=true. Its list_3p_developer_tools MCP tool discovers the page's tool group and input schemas. execute_3p_developer_tool executes a discovered tool for that pageId. Its params argument is JSON text. Read the actual schemas before constructing a request.",
    "",
    "The upstream [third-party tool guide](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/third-party-developer-tools.md) and [tool reference](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md) describe this experimental contract. Do not change the agent's global MCP configuration automatically.",
    "",
    "The bridge answers devtoolstooldiscovery on window. It does not install a window.__dtmcp global. That global, when present, belongs to the Chrome MCP client. A plain browser runner does not establish that an MCP client is connected.",
    "",
    row(["Tool", "Meaning"]),
    row(["---", "---"]),
    ...createProseMirrorAgentTools(createProseMirrorInspectionClient()).tools.map((tool) =>
      row([`\`${tool.name}\``, tool.description]),
    ),
    "",
    "## Browser and computer use",
    "",
    "Without third-party MCP tools, use the visible editor selector and Inspectors and capture coverage. Expand Coverage and read point for target, session, source, protocol, and coverage evidence. Use Transactions, Events, and Follow live to keep observations at an explicit point.",
    "",
    "Use Copy diagnostic context only when the environment permits it. The panel provides a textarea fallback. Reading the visible diagnostic panes is sufficient when clipboard access is unavailable. Do not request clipboard permissions merely to inspect evidence.",
    "",
    "A host-side runner can use createProseMirrorInspectionClient({store}) and createProseMirrorAgentTools(client) through the public package entries. Neither requires a window global. The plain browser route can remain entirely UI based. Missing structured access leaves only the affected checks inconclusive.",
    "",
    "The standalone fixture also exposes a diagnostic recording download. Treat it as captured evidence, not proof of a new browser action. No hidden transaction or document mutation is part of discovery.",
    "",
  ].join("\n"),
  { printWidth: 100 },
);
assert.deepEqual(connection.errors, []);
const connectionFiles = [resolve(root, "docs/inspection-connection.md")];
for (const name of ["integrate", "debug", "validate"]) {
  connectionFiles.push(
    resolve(
      root,
      `packages/prosemirror-devtools/skills/prosemirror-inspector-${name}/references/connection.md`,
    ),
  );
}
for (const file of connectionFiles) {
  if (process.argv.includes("--write")) {
    await mkdir(resolve(file, ".."), { recursive: true });
    await writeFile(file, connection.code);
  } else {
    assert.equal(
      await readFile(file, "utf8"),
      connection.code,
      "The packaged connection reference is stale. Run pnpm docs:generate.",
    );
  }
}
for (const name of ["integrate", "debug", "validate"]) {
  const folder = resolve(
    root,
    `packages/prosemirror-devtools/skills/prosemirror-inspector-${name}`,
  );
  const skill = await readFile(resolve(folder, "SKILL.md"), "utf8");
  assert.match(skill, new RegExp(`name: prosemirror-inspector-${name}\\n`));
  assert.match(skill, /inspection-protocol: "1"/);
  for (const match of skill.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
    if (!match[1].includes(":")) await access(resolve(folder, match[1]));
  }
}
console.log("Inspection catalogue, generated reference, and skill references agree.");
