import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createProseMirrorDevtoolsSession,
  createProseMirrorDevtoolsStore,
  createProseMirrorInspectionClient,
} from "../src/core";
import { exportProseMirrorRecording } from "../src/recordings";
import { mountProseMirrorRecordingInspector } from "../src/recordings-panel";
import { createTestState, createTestView } from "./helpers";

afterEach(() => {
  vi.unstubAllEnvs();
  document.body.replaceChildren();
});

function recordingFixture() {
  const store = createProseMirrorDevtoolsStore();
  const session = createProseMirrorDevtoolsSession({
    id: "recording-ui",
    store,
    performanceMarks: false,
  });
  const view = createTestView(createTestState("<script>untrusted</script>"));
  session.attach(view);
  view.dispatch(view.state.tr.insertText("a"));
  const client = createProseMirrorInspectionClient({ store });
  const recording = exportProseMirrorRecording({ client, target: client.listEditors()[0]!.target });
  session.dispose();
  view.destroy();
  return recording;
}

function select(host: HTMLElement, label: string, value: string): void {
  const field = host.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!;
  field.value = value;
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("recording inspector", () => {
  it("reads offline evidence and dispatch points without exposing live editor operations", () => {
    vi.stubEnv("NODE_ENV", "development");
    const recording = recordingFixture();
    const host = document.createElement("div");
    document.body.append(host);
    const panel = mountProseMirrorRecordingInspector(host, { recording, theme: "light" });
    try {
      expect(host.textContent).toContain("Offline source");
      expect(host.textContent).toContain("Read-only source recording:");
      expect(host.querySelector('[contenteditable="true"]')).toBeNull();
      expect(
        Array.from(host.querySelectorAll("button")).some((button) =>
          /restore|overlay|show positions/i.test(button.textContent ?? ""),
        ),
      ).toBe(false);
      const doc = host.querySelector('[aria-label="Document"] .pm-json');
      for (let depth = 0; depth < 4; depth += 1)
        doc
          ?.querySelectorAll<HTMLButtonElement>('[aria-label="Expand value"]')
          .forEach((button) => button.click());
      expect(doc?.textContent).toContain("<script>untrusted</script>");
      expect(host.querySelector("script")).toBeNull();
      select(host, "Recording read point", "1");
      select(host, "Recording evidence query", "transaction");
      expect(host.querySelector('[aria-label="Dispatch details"]')?.textContent).toContain(
        "applicationStatus",
      );
      panel.update({ recording, theme: "dark" });
      expect(
        host.querySelector<HTMLSelectElement>('[aria-label="Recording read point"]')?.value,
      ).toBe("1");
      expect(host.querySelector(".pm-devtools")?.getAttribute("data-theme")).toBe("dark");
      Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "Before dispatch")
        ?.click();
      expect(host.querySelector('[aria-label="Dispatch details"]')?.textContent).toContain(
        "unobserved",
      );
      Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "Copy diagnostic context")
        ?.click();
      const context = JSON.parse(
        host.querySelector<HTMLTextAreaElement>('[aria-label="Diagnostic context JSON"]')?.value ??
          "null",
      );
      expect(context.source.kind).toBe("offline");
      expect(context.point).toMatchObject({
        kind: "transaction",
        transactionId: 1,
        phase: "before",
      });
      expect(context.target.sourceId).not.toBe(recording.origin.target.sourceId);
      panel.unmount();
      expect(host.childElementCount).toBe(0);
      panel.unmount();
    } finally {
      panel.unmount();
    }
  });

  it("keeps the production mount inactive", () => {
    vi.stubEnv("NODE_ENV", "production");
    const recording = recordingFixture();
    const host = document.createElement("div");
    const existing = document.createElement("span");
    host.append(existing);
    const panel = mountProseMirrorRecordingInspector(host, { recording });
    panel.update({ recording });
    panel.unmount();
    expect(host.firstElementChild).toBe(existing);
    expect(host.childElementCount).toBe(1);
  });
});
