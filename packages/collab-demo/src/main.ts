import {
  createProseMirrorDevtoolsStore,
  createProseMirrorInspectionClient,
} from "prosemirror-inspector/core";
import { installProseMirrorChromeBridge } from "prosemirror-inspector/agent";
import { mountProseMirrorDevtools } from "prosemirror-inspector/standalone";
import "prosemirror-view/style/prosemirror.css";
import "prosemirror-inspector/styles.css";
import "./style.css";

import { mountOfficial } from "./official";
import { mountYjs } from "./yjs";
import { peers, type CollaborationFixture, type Peer } from "./types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing application container");
app.innerHTML = `<main>
  <h1>Collaboration Inspector</h1>
  <p>Edit both peers while delivery is held, then deliver their updates. The inspector distinguishes confirmed versions, pending local work, and application-observed transport signals.</p>
  <div class="toolbar">
    <label>Collaboration system <select id="system"><option value="official">Official ProseMirror collab</option><option value="yjs">Tiptap Collaboration with Yjs</option></select></label>
    <label><input id="hold" type="checkbox"/>Hold delivery</label>
    <label>Delivery delay <input id="delay" type="number" value="250" min="0" max="5000" aria-label="Delivery delay in milliseconds"/>ms</label>
    <button id="deliver">Deliver queued updates</button><button id="reset">Reset fixture</button>
  </div>
  <div class="peers"><section><h2>Peer A</h2><div class="toolbar"><button id="undo-A">Undo in A</button><button id="pause-A" aria-pressed="false">Pause capture A</button></div><div id="editor-A" class="editor"></div></section>
  <section><h2>Peer B</h2><div class="toolbar"><button id="undo-B">Undo in B</button><button id="pause-B" aria-pressed="false">Pause capture B</button></div><div id="editor-B" class="editor"></div></section></div>
  <p id="coverage"></p><output id="status" aria-live="polite"></output>
  <details><summary>Current provider samples and coverage</summary><pre id="samples"></pre></details>
  <div id="inspector" class="inspector" aria-label="ProseMirror Inspector"></div>
</main>`;
function element<T extends HTMLElement>(selector: string, type: { new (): T }): T {
  const found = app?.querySelector(selector);
  if (!(found instanceof type)) throw new Error(`Missing ${selector}`);
  return found;
}
const system = element("#system", HTMLSelectElement);
const hold = element("#hold", HTMLInputElement);
const delay = element("#delay", HTMLInputElement);
const status = element("#status", HTMLOutputElement);
const samples = element("#samples", HTMLPreElement);
const coverage = element("#coverage", HTMLParagraphElement);
const containers = {
  A: element("#editor-A", HTMLDivElement),
  B: element("#editor-B", HTMLDivElement),
};
const store = createProseMirrorDevtoolsStore();
const client = createProseMirrorInspectionClient({ store });
const disposeBridge = import.meta.env.DEV ? installProseMirrorChromeBridge(client) : null;
const panel = import.meta.env.DEV
  ? mountProseMirrorDevtools(element("#inspector", HTMLDivElement), {
      store,
      theme: "light",
      defaultPanel: "history",
    })
  : null;
if (!panel) element("#inspector", HTMLDivElement).hidden = true;
let fixture: CollaborationFixture | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let active = true;
let flushing = false;
let renderQueued = false;
let lastError: string | null = null;
const paused: Record<Peer, boolean> = { A: false, B: false };

function render(): void {
  if (!active || !fixture) return;
  status.textContent = lastError ?? JSON.stringify(fixture.summary());
  samples.textContent = JSON.stringify(
    client.listEditors().map((editor) => ({
      target: editor.target,
      capture: editor.capture,
      contribution: client.query({
        target: editor.target,
        query: { kind: "contribution", id: fixture?.inspectorId ?? "" },
      }),
    })),
    null,
    2,
  );
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
  const options = { containers, store, changed, queued };
  fixture = system.value === "yjs" ? mountYjs(options) : mountOfficial(options);
  coverage.textContent = !import.meta.env.DEV
    ? "Diagnostics are disabled in this production build."
    : system.value === "yjs"
      ? "Tiptap uses Yjs collaborative undo. Document and transport signals have independent freshness. A dispatch sample may precede the UndoManager's final stack update."
      : "The official collab plugin reports confirmed version and pending steps. Holding delivery preserves real concurrent local edits. Paused capture keeps an explicit gap while editors and transport continue.";
  render();
}
const handlers = [
  [element("#deliver", HTMLButtonElement), deliver],
  [element("#reset", HTMLButtonElement), reset],
  ...peers.flatMap((peer): [HTMLButtonElement, () => void][] => [
    [element(`#undo-${peer}`, HTMLButtonElement), () => fixture?.undo(peer)],
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
hold.addEventListener("change", holdChanged);
const unsubscribe = store.subscribe(changed);
reset();
function dispose(): void {
  if (!active) return;
  active = false;
  window.removeEventListener("pagehide", dispose);
  if (timer !== null) clearTimeout(timer);
  for (const [button, listener] of handlers) button.removeEventListener("click", listener);
  system.removeEventListener("change", reset);
  hold.removeEventListener("change", holdChanged);
  unsubscribe();
  fixture?.dispose();
  panel?.unmount();
  disposeBridge?.();
}
window.addEventListener("pagehide", dispose, { once: true });
import.meta.hot?.dispose(dispose);
