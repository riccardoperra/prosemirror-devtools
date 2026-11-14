import { expect, test } from "@playwright/test";

import { available, callTool, editorTarget } from "./inspection-tools";

async function transactionCount(page: Parameters<typeof editorTarget>[0], target: unknown) {
  const result = available(
    await callTool(page, "prosemirror_inspect", { target, query: { kind: "transactions" } }),
  );
  if (!Array.isArray(result.value)) throw new Error("Expected dispatch summaries.");
  return result.value;
}

function toCents(money: string | null): number {
  return Number((money ?? "").replace(/[^\d]/g, ""));
}

test("invoice totals follow edits, paid locks the editor, and the inspector shows full rows and the Invoice tab", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("http://127.0.0.1:4184");
  const editor = page.getByRole("textbox", { name: "Invoice editor", exact: true });
  const amountDue = page.getByLabel("Amount due", { exact: true });
  const initialDue = toCents(await amountDue.textContent());
  const target = await editorTarget(page);
  const initialDispatches = (await transactionCount(page, target)).length;

  await page.getByRole("button", { name: "Add line item", exact: true }).click();
  await page.keyboard.type("Hosting");
  await page.getByLabel("Quantity", { exact: true }).last().fill("3");
  await page.getByLabel("Unit price", { exact: true }).last().fill("12.5");
  // 3 × €12.50 plus 22% VAT.
  await expect.poll(async () => toCents(await amountDue.textContent()) - initialDue).toBe(4575);

  const dispatches = await transactionCount(page, target);
  expect(dispatches.length).toBeGreaterThan(initialDispatches);
  expect(dispatches.at(-1)).toMatchObject({ applicationStatus: "applied", docChanged: true });

  const slowPlugin = page.locator(".scenario", { hasText: "Slow validation plugin" });
  await slowPlugin.locator("summary").click();
  await slowPlugin.getByRole("button", { name: "Run Slow validation plugin", exact: true }).click();
  await expect(slowPlugin.getByText("Dispatched", { exact: true })).toBeVisible();
  const afterSlowPlugin = await transactionCount(page, target);
  expect(afterSlowPlugin).toHaveLength(dispatches.length + 1);
  expect(afterSlowPlugin.at(-1)).toMatchObject({ applicationStatus: "applied", docChanged: false });

  await expect(editor).toHaveAttribute("contenteditable", "true");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("button", { name: "Mark paid", exact: true }).click();
  await expect(editor).toHaveAttribute("contenteditable", "false");
  await expect(page.getByRole("button", { name: "Add line item", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Quantity", { exact: true }).first()).toBeDisabled();

  await page.getByRole("button", { name: "Open TanStack Devtools", exact: true }).click();
  const latestDispatch = page.getByRole("button", { name: /^Inspect dispatch #/ }).first();
  await expect(latestDispatch).toBeVisible();
  // App styles once leaked into the inspector and clipped each row to its first line.
  const rowTime = latestDispatch.locator("time");
  await expect(rowTime).toBeVisible();
  const [row, time] = await Promise.all([latestDispatch.boundingBox(), rowTime.boundingBox()]);
  expect(time!.y + time!.height).toBeLessThanOrEqual(row!.y + row!.height);

  const quote = "Travel expenses are billed at cost.";
  await page.getByRole("tab", { name: "Invoice", exact: true }).click();
  const comments = page.getByRole("region", { name: "Comments", exact: true });
  const fixtureComment = comments.getByRole("button", { name: "Select comment by Giulia" });
  await expect(fixtureComment).toContainText(quote);
  await fixtureComment.click();
  await expect
    .poll(async () => {
      const selection = available(
        await callTool(page, "prosemirror_inspect", { target, query: { kind: "selection" } }),
      ).value as { from: number; to: number };
      return selection.to - selection.from;
    })
    .toBe(quote.length);
  expect(errors).toEqual([]);
});
