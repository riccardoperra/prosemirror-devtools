import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = resolve(root, "packages/standalone-demo");
const fixtureRequire = createRequire(resolve(fixture, "package.json"));
const require = createRequire(import.meta.url);
const { createServer } = await import(pathToFileURL(fixtureRequire.resolve("vite")).href);
const mcp = resolve(
  dirname(require.resolve("chrome-devtools-mcp/package.json")),
  "build/src/bin/chrome-devtools-mcp.js",
);
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

async function availableLoopbackPort() {
  const listener = createTcpServer().listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  await listener[Symbol.asyncDispose]();
  return port;
}

async function waitForDebugEndpoint(port) {
  const versionUrl = new URL(`http://127.0.0.1:${port}/json/version`);
  const signal = AbortSignal.timeout(5_000);
  let lastError;
  while (!signal.aborted) {
    try {
      const response = await fetch(versionUrl, { signal, redirect: "error" });
      assert(response.ok, `Chrome CDP returned HTTP ${response.status}.`);
      const { webSocketDebuggerUrl } = await response.json();
      const endpoint = new URL(webSocketDebuggerUrl);
      assert(
        endpoint.protocol === "ws:" &&
          endpoint.host === versionUrl.host &&
          endpoint.pathname.startsWith("/devtools/browser/"),
        "Chrome did not return a loopback browser CDP endpoint.",
      );
      return endpoint.href;
    } catch (error) {
      lastError = error;
      await delay(50);
    }
  }
  throw new Error(`Chrome CDP endpoint did not become ready at ${versionUrl}.`, {
    cause: lastError,
  });
}

let server;
let browser;
let profile;
try {
  await rm(reportPath, { force: true });
  server = await createServer({
    root: fixture,
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  assert(url, "Vite did not provide a loopback URL for the fixture.");
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  await response.body?.cancel();
  assert(response.ok, `Fixture returned HTTP ${response.status} at ${url}.`);
  const port = await availableLoopbackPort();
  profile = await mkdtemp(resolve(tmpdir(), "inspector-chrome-mcp-"));
  browser = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    args: ["--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${port}`],
  });
  const endpoint = await waitForDebugEndpoint(port);
  const client = start(
    [
      mcp,
      `--wsEndpoint=${endpoint}`,
      "--usageStatistics=false",
      "--javascriptEvaluation=false",
      "--categoryExperimentalThirdParty=true",
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
  try {
    await Promise.all([server?.close(), ...children.map(stop)]);
  } finally {
    try {
      await browser?.close();
    } finally {
      if (profile) await rm(profile, { recursive: true, force: true });
    }
  }
}
