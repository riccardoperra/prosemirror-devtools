#!/usr/bin/env node
// Builds the GitHub Pages site: the landing page at the root and each example under <name>/.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

const source = "https://github.com/riccardoperra/prosemirror-devtools/tree/main/examples";
const escape = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const card = (example, index) => `<li class="card${index === 0 ? " featured" : ""}">
  <img src="./screenshots/${example.name}.jpg" alt="The ${escape(example.title)} example with the inspector open" loading="lazy" width="1440" height="900" />
  <div class="card-body">
    <h3>${escape(example.title)}</h3>
    <span class="framework">${escape(example.framework)}</span>
    <p>${escape(example.description)}</p>
    <div class="links"><a href="./${example.name}/">Open demo</a><a href="${source}/${example.name}">Source</a></div>
  </div>
</li>`;

rmSync(output, { recursive: true, force: true });
cpSync(`${root}site`, output, { recursive: true });
const landing = readFileSync(`${output}/index.html`, "utf8");
writeFileSync(
  `${output}/index.html`,
  landing.replace("<!-- examples -->", examples.map(card).join("\n")),
);
for (const example of examples) {
  cpSync(`${root}${example.outDir}`, `${output}/${example.name}`, { recursive: true });
}

const missing = ["", ...examples.map(({ name }) => `${name}/`)].filter(
  (path) => !existsSync(`${output}/${path}index.html`),
);
if (missing.length > 0) throw new Error(`pages-dist has no index.html in: /${missing.join(", /")}`);
console.log(`Pages site assembled in ${output} for ${siteBase}`);
