#!/usr/bin/env node
// Builds the GitHub Pages site: the landing page at the root and the invoice workbench under invoice/.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = `${root}pages-dist`;
const siteBase = process.env.PAGES_SITE_BASE ?? "/prosemirror-devtools/";

function run(args, env = {}) {
  execFileSync("pnpm", args, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
}

run(["build:package"]);
run(["--filter", "@prosemirror-devtools/invoice-demo", "run", "build:pages"], {
  PAGES_BASE: `${siteBase}invoice/`,
});

rmSync(output, { recursive: true, force: true });
cpSync(`${root}site`, output, { recursive: true });
cpSync(`${root}examples/invoice/pages-dist`, `${output}/invoice`, { recursive: true });

if (!existsSync(`${output}/index.html`) || !existsSync(`${output}/invoice/index.html`)) {
  throw new Error("pages-dist is missing the landing page or the invoice workbench.");
}
console.log(`Pages site assembled in ${output} for ${siteBase}`);
