#!/usr/bin/env node
// Builds the GitHub Pages site: the landing page at the root and each example under <name>/.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { examples } from "./examples.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = `${root}pages-dist`;
const siteBase = process.env.PAGES_SITE_BASE ?? "/prosemirror-devtools/";

function run(args) {
  execFileSync("pnpm", args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, VITE_SHOWCASE: "true" },
  });
}

run(["build:package"]);
for (const example of examples) run(example.buildCommand(`${siteBase}${example.name}/`));

rmSync(output, { recursive: true, force: true });
cpSync(`${root}site`, output, { recursive: true });
for (const example of examples) {
  cpSync(`${root}${example.outDir}`, `${output}/${example.name}`, { recursive: true });
}

const missing = ["", ...examples.map(({ name }) => `${name}/`)].filter(
  (path) => !existsSync(`${output}/${path}index.html`),
);
if (missing.length > 0) throw new Error(`pages-dist has no index.html in: /${missing.join(", /")}`);
console.log(`Pages site assembled in ${output} for ${siteBase}`);
