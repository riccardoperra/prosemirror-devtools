import { expect, test } from "@playwright/test";

import { available, callTool, object } from "./inspection-tools";

const cases = [
  { panel: "State", expected: ["6 chars", "14 node size", "9–9"] },
  { panel: "Selection", expected: ["pos 9"] },
] as const;

for (const scenario of cases) {
  test(`V7 controlled React ${scenario.panel} follows the committed model`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.env.INSPECTOR_REACT_FIXTURE_URL ?? "http://127.0.0.1:4182");
    await page.getByRole("tab", { name: "Document", exact: true }).click();
    await page.getByRole("tab", { name: scenario.panel, exact: true }).click();
    await expect(page.getByRole("button", { name: "Follow live", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Focus editor", exact: true }).click();
    const editor = page.getByRole("textbox", { name: "React ProseMirror editor", exact: true });
    await editor.press("End");
    await editor.press("Z");
    await expect(editor).toHaveText("AlphaZ");
    await expect(page.getByRole("button", { name: "Follow live", exact: true })).toHaveCount(0);
    const panel = page.getByRole("tabpanel");
    for (const expected of scenario.expected) {
      await expect(panel.getByText(expected, { exact: true })).toBeVisible();
    }

    const discovered = object(await callTool(page, "prosemirror_editors"));
    if (!Array.isArray(discovered.editors) || discovered.editors.length !== 1) {
      throw new Error("Expected the single controlled React editor.");
    }
    const target = object(object(discovered.editors[0]).target);
    const document = available(
      await callTool(page, "prosemirror_inspect", { target, query: { kind: "document" } }),
    );
    const selection = available(
      await callTool(page, "prosemirror_read", {
        point: document.point,
        query: { kind: "selection" },
      }),
    );
    expect(JSON.stringify(document.value)).toContain('"text":"AlphaZ"');
    expect(selection.value).toMatchObject({ anchor: 9, head: 9, from: 9, to: 9 });
    expect(selection.point).toEqual(document.point);
    expect(errors).toEqual([]);
    await testInfo.attach("controlled-live-inspection", {
      body: JSON.stringify({ panel: scenario.panel, document, selection }, null, 2),
      contentType: "application/json",
    });
    await testInfo.attach("controlled-live-panel", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });
}
