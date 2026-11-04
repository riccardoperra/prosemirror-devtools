import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = resolve(root, "packages/standalone-demo");
const fixtureRequire = createRequire(resolve(fixture, "package.json"));
const require = createRequire(import.meta.url);
const vite = resolve(dirname(fixtureRequire.resolve("vite/package.json")), "bin/vite.js");
const mcp = resolve(
  dirname(require.resolve("chrome-devtools-mcp/package.json")),
  "build/src/bin/chrome-devtools-mcp.js",
);
const url = "http://127.0.0.1:4194/";
const reportPath = resolve(root, "test-results/chrome-mcp.json");
const children = [];
const errors = new Map();
const pending = new Map();
let nextId = 0;

function start(args, cwd) {
  const child = spawn(process.execPath, args, {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, CHROME_DEVTOOLS_MCP_NO_CONFIG_DISCOVERY: "1" },
  });
  children.push(child);
  errors.set(child, "");
  child.stderr.on("data", (chunk) => errors.set(child, (errors.get(child) + chunk).slice(-10_000)));
  return child;
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const closed = once(child, "close");
  child.stdin.end();
  child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 3_000);
  try {
    await closed;
  } finally {
    clearTimeout(timer);
  }
}

const text = (result) =>
  result.content
    ?.filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n") ?? "";
const output = (result) => {
  assert(!result.isError, text(result));
  const value = text(result);
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  assert(start >= 0 && end > start, "MCP tool must return JSON evidence.");
  return JSON.parse(value.slice(start, end + 1));
};

try {
  await rm(reportPath, { force: true });
  const server = start([vite, "--host", "127.0.0.1", "--port", "4194", "--strictPort"], fixture);
  let fixtureReady = false;
  server.stdout.on("data", (chunk) => {
    if (String(chunk).includes(url)) fixtureReady = true;
  });
  const deadline = Date.now() + 30_000;
  while (true) {
    if (server.exitCode !== null) throw new Error(`Fixture exited: ${errors.get(server)}`);
    try {
      if (fixtureReady && (await fetch(url, { signal: AbortSignal.timeout(1_000) })).ok) break;
    } catch {}
    if (Date.now() > deadline)
      throw new Error(`Fixture did not become ready: ${errors.get(server)}`);
    await delay(50);
  }
  const client = start(
    [
      mcp,
      "--headless=true",
      "--isolated=true",
      "--usageStatistics=false",
      "--javascriptEvaluation=false",
      "--categoryExperimentalThirdParty=true",
      `--executablePath=${process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? chromium.executablePath()}`,
    ],
    root,
  );
  const failPending = (error) => {
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(error);
    }
    pending.clear();
  };
  client.on("error", failPending);
  client.on("exit", () => failPending(new Error(`MCP exited: ${errors.get(client)}`)));
  createInterface({ input: client.stdout }).on("line", (line) => {
    let response;
    try {
      response = JSON.parse(line);
    } catch {
      return;
    }
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    clearTimeout(request.timeout);
    if (response.error) request.reject(new Error(JSON.stringify(response.error)));
    else request.resolve(response.result);
  });
  const call = (method, params) =>
    new Promise((resolveRequest, reject) => {
      const id = ++nextId;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP request timed out: ${method}. ${errors.get(client)}`));
      }, 30_000);
      pending.set(id, { resolve: resolveRequest, reject, timeout });
      client.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  const initialized = await call("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "prosemirror-inspector-conformance", version: "1.0.0" },
  });
  client.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n",
  );
  const tools = await call("tools/list", {});
  assert(tools.tools.some((tool) => tool.name === "list_3p_developer_tools"));
  assert(!tools.tools.some((tool) => tool.name === "evaluate_script"));
  const tool = (name, args) => call("tools/call", { name, arguments: args });
  const opened = await tool("new_page", { url });
  assert(!opened.isError, text(opened));
  const pages = await tool("list_pages", {});
  const page = text(pages)
    .split("\n")
    .find((line) => /^\d+:/.test(line) && line.includes(url));
  assert(page, "The isolated fixture page must be listed.");
  const pageId = Number(page.slice(0, page.indexOf(":")));
  const discovered = await tool("list_3p_developer_tools", { pageId });
  const toolNames = [
    "prosemirror_catalog",
    "prosemirror_editors",
    "prosemirror_inspect",
    "prosemirror_read",
    "prosemirror_check",
  ];
  for (const name of toolNames) assert(text(discovered).includes(`name="${name}"`));
  const execute = async (toolName, params) =>
    output(
      await tool("execute_3p_developer_tool", { pageId, toolName, params: JSON.stringify(params) }),
    );
  const catalog = await execute("prosemirror_catalog", {});
  assert.equal(catalog.version, 1);
  const editors = await execute("prosemirror_editors", {});
  assert.equal(editors.editors.length, 1);
  const target = editors.editors[0].target;
  const document = await execute("prosemirror_inspect", {
    target,
    query: { kind: "document" },
    limits: { maxNodes: 100, maxBytes: 10_000 },
  });
  assert.equal(document.kind, "available");
  assert.equal(document.value.content[0].type, "bullet_list");
  assert.equal(document.value.content[0].content[0].content[0].content[0].text, "Alpha");
  const selection = await execute("prosemirror_read", {
    point: document.point,
    query: { kind: "selection" },
  });
  assert.equal(selection.kind, "available");
  assert.deepEqual(selection.point, document.point);
  assert.equal(selection.value.anchor, 8);
  const verdict = await execute("prosemirror_check", {
    request: { target, query: { kind: "document" } },
    assertion: {
      path: ["content", 0, "type"],
      predicate: { kind: "equals", expected: "bullet_list" },
      completeness: "value",
    },
  });
  assert.equal(verdict.kind, "passed");
  const report = JSON.stringify(
    {
      server: initialized.serverInfo,
      protocol: initialized.protocolVersion,
      toolNames,
      target,
      document,
      selection,
      verdict,
    },
    null,
    2,
  );
  assert(Buffer.byteLength(report) <= 100_000, "MCP proof must remain bounded.");
  await mkdir(resolve(root, "test-results"), { recursive: true });
  await writeFile(reportPath, report + "\n");
  console.log(
    `Chrome MCP ${initialized.serverInfo.version}: five Inspector tools discovered; coherent document, selection and verdict passed.`,
  );
} finally {
  await Promise.all(children.map(stop));
}
