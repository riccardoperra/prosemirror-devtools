import { mountComparisonControls } from "@prosemirror-devtools/demo-kit/comparison-ui";
import { mountRecordingControls } from "@prosemirror-devtools/demo-kit/recording-ui";
import {
  createProseMirrorDevtoolsStore,
  createProseMirrorInspectionClient,
} from "prosemirror-inspector/core";
import {
  installProseMirrorChromeBridge,
  installProseMirrorWebMCPBridge,
} from "prosemirror-inspector/agent";
import { mountProseMirrorDevtools } from "prosemirror-inspector/standalone";
import "prosemirror-view/style/prosemirror.css";
import "prosemirror-inspector/styles.css";
import "./style.css";

import { mountOfficial } from "./official";
import { mountYjs } from "./yjs";
import { commandLabels, commands, peers, type CollaborationFixture, type Peer } from "./types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing application container");
app.innerHTML = `<main class="kitchen-sink">
  <h1>ProseMirror Inspector kitchen sink</h1>
  <p>Two editors, a shared document, and controls to see what happens before and after delivery.</p>
  <details class="demo-guide" ${import.meta.env.DEV ? "" : "hidden"}>
    <summary>Try the kitchen sink</summary>
    <ol>
      <li>Hold delivery and insert a sample in A. In <strong>Collaboration</strong>, check the pending step and watch the version change on delivery. Try undo and redo in A with <strong>Undo history</strong> open.</li>
      <li>Pick a transaction and inspect <strong>Rendering</strong> for the highlighted text, paragraph decoration, widget and paragraph NodeView. Compare capture profiles to see which events require instrumentation.</li>
      <li>Switch to <strong>Tiptap Collaboration with Yjs</strong> to inspect local and remote updates and the Yjs undo stack. Find Tiptap extension data in <strong>Context</strong>.</li>
      <li>Export an editor session and open the recording below. Refresh editor sessions after a fixture reset. Open a second inspector to compare two live selections.</li>
    </ol>
    <p>Both agent bridges expose the same live editor sessions in development.</p>
  </details>
  <div class="toolbar">
    <label>Collaboration system <select id="system"><option value="official">Official ProseMirror collab</option><option value="yjs">Tiptap Collaboration with Yjs</option></select></label>
    <label id="profile-control">Capture profile <select id="profile"><option value="instrumented">Instrument before state</option><option value="attach">Attach only</option></select></label>
    <label><input id="hold" type="checkbox"/>Hold delivery</label>
    <label>Delivery delay <input id="delay" type="number" value="250" min="0" max="5000" aria-label="Delivery delay in milliseconds"/>ms</label>
    <button id="deliver">Deliver queued updates</button><button id="reset">Reset fixture</button>
  </div>
  <div class="peers">${peers
    .map(
      (peer) => `<section><h2>Peer ${peer}</h2><div class="toolbar">
    ${commands.map((command) => `<button id="${command}-${peer}">${commandLabels[command]} in ${peer}</button>`).join("")}
    <button id="pause-${peer}" aria-pressed="false">Pause capture ${peer}</button></div>
    <div id="editor-${peer}" class="editor"></div></section>`,
    )
    .join("")}</div>
  <output id="status" aria-live="polite"></output>
  <p id="coverage"></p>
  <div id="inspector" class="inspector" aria-label="ProseMirror Inspector"></div>
  <div id="demo-actions"></div>
</main>`;
function element<T extends HTMLElement>(selector: string, type: { new (): T }): T {
  const found = app?.querySelector(selector);
  if (!(found instanceof type)) throw new Error(`Missing ${selector}`);
  return found;
}
const system = element("#system", HTMLSelectElement);
const profile = element("#profile", HTMLSelectElement);
const hold = element("#hold", HTMLInputElement);
const delay = element("#delay", HTMLInputElement);
const status = element("#status", HTMLOutputElement);
const coverage = element("#coverage", HTMLParagraphElement);
const containers = {
  A: element("#editor-A", HTMLDivElement),
  B: element("#editor-B", HTMLDivElement),
};
const store = createProseMirrorDevtoolsStore();
const client = createProseMirrorInspectionClient({ store });
const disposeBridge = import.meta.env.DEV ? installProseMirrorChromeBridge(client) : null;
const disposeWebMCP = import.meta.env.DEV ? await installProseMirrorWebMCPBridge(client) : null;
const panel = import.meta.env.DEV
  ? mountProseMirrorDevtools(element("#inspector", HTMLDivElement), {
      store,
      theme: "light",
      defaultPanel: "history",
    })
  : null;
if (!panel) {
  element("#inspector", HTMLDivElement).hidden = true;
  element("#profile-control", HTMLLabelElement).hidden = true;
  for (const peer of peers) element(`#pause-${peer}`, HTMLButtonElement).hidden = true;
}
let fixture: CollaborationFixture | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let active = true;
let flushing = false;
let renderQueued = false;
let lastError: string | null = null;
const paused: Record<Peer, boolean> = { A: false, B: false };

function render(): void {
  if (!active || !fixture) return;
  status.textContent = lastError ?? fixture.status();
  for (const peer of peers) {
    const button = element(`#pause-${peer}`, HTMLButtonElement);
    button.textContent = `${paused[peer] ? "Resume" : "Pause"} capture ${peer}`;
    button.setAttribute("aria-pressed", String(paused[peer]));
  }
}
function changed(): void {
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(() => {
    renderQueued = false;
    render();
  });
}
function deliver(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  flushing = true;
  try {
    fixture?.flush();
    lastError = null;
  } catch (error) {
    lastError = error instanceof Error ? error.message : "Delivery failed.";
  } finally {
    flushing = false;
    changed();
  }
}
function queued(): void {
  if (!active || flushing || hold.checked || timer !== null) return;
  const milliseconds = Number(delay.value);
  timer = setTimeout(
    deliver,
    Number.isFinite(milliseconds) ? Math.max(0, Math.min(5000, milliseconds)) : 250,
  );
}
function reset(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  fixture?.dispose();
  for (const peer of peers) {
    containers[peer].replaceChildren();
    paused[peer] = false;
  }
  lastError = null;
  const options = {
    containers,
    store,
    changed,
    queued,
    instrumentPlugins: profile.value === "instrumented",
  };
  fixture = system.value === "yjs" ? mountYjs(options) : mountOfficial(options);
  coverage.textContent = !import.meta.env.DEV
    ? "Diagnostics are disabled in this production build."
    : profile.value === "attach"
      ? "Attach only captures editor state, dispatches and provider samples. Instrument before state to see plugin callbacks and rendering observations."
      : "";
  coverage.hidden = !coverage.textContent;
  render();
}
const handlers = [
  [element("#deliver", HTMLButtonElement), deliver],
  [element("#reset", HTMLButtonElement), reset],
  ...peers.flatMap((peer): [HTMLButtonElement, () => void][] => [
    ...commands.map((command): [HTMLButtonElement, () => void] => [
      element(`#${command}-${peer}`, HTMLButtonElement),
      () => fixture?.runCommand(peer, command),
    ]),
    [
      element(`#pause-${peer}`, HTMLButtonElement),
      () => {
        paused[peer] = !paused[peer];
        fixture?.setPaused(peer, paused[peer]);
        changed();
      },
    ],
  ]),
] satisfies [HTMLButtonElement, () => void][];
for (const [button, listener] of handlers) button.addEventListener("click", listener);
function holdChanged(): void {
  if (hold.checked && timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (!hold.checked) queued();
}
system.addEventListener("change", reset);
profile.addEventListener("change", reset);
hold.addEventListener("change", holdChanged);
const unsubscribe = store.subscribe(changed);
reset();
const actions = element("#demo-actions", HTMLDivElement);
const disposeComparison = import.meta.env.DEV
  ? mountComparisonControls({ container: actions, store })
  : null;
const disposeRecordings = import.meta.env.DEV
  ? mountRecordingControls({ container: actions, client })
  : null;
function dispose(): void {
  if (!active) return;
  active = false;
  window.removeEventListener("pagehide", dispose);
  if (timer !== null) clearTimeout(timer);
  for (const [button, listener] of handlers) button.removeEventListener("click", listener);
  system.removeEventListener("change", reset);
  profile.removeEventListener("change", reset);
  hold.removeEventListener("change", holdChanged);
  unsubscribe();
  disposeRecordings?.();
  disposeComparison?.();
  fixture?.dispose();
  panel?.unmount();
  disposeBridge?.();
  disposeWebMCP?.();
}
window.addEventListener("pagehide", dispose, { once: true });
import.meta.hot?.dispose(dispose);
