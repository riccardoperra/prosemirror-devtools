import { expect, test } from "@playwright/test";

import { available, callTool, editorTarget } from "./inspection-tools";

async function transactionCount(page: Parameters<typeof editorTarget>[0], target: unknown) {
  const result = available(
    await callTool(page, "prosemirror_inspect", { target, query: { kind: "transactions" } }),
  );
  if (!Array.isArray(result.value)) throw new Error("Expected dispatch summaries.");
  return result.value;
}

test("invoice totals follow line item edits and a paid invoice locks the editor", async ({
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
  await expect(amountDue).toHaveText("€6,112.60");
  const target = await editorTarget(page);
  const initialDispatches = (await transactionCount(page, target)).length;

  await page.getByRole("button", { name: "Add line item", exact: true }).click();
  await page.keyboard.type("Hosting");
  await page.getByLabel("Quantity", { exact: true }).last().fill("3");
  await page.getByLabel("Unit price", { exact: true }).last().fill("12.5");
  await expect(amountDue).toHaveText("€6,158.35");

  const dispatches = await transactionCount(page, target);
  expect(dispatches.length).toBeGreaterThan(initialDispatches);
  expect(dispatches.at(-1)).toMatchObject({ applicationStatus: "applied", docChanged: true });

  await expect(editor).toHaveAttribute("contenteditable", "true");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("button", { name: "Mark paid", exact: true }).click();
  await expect(editor).toHaveAttribute("contenteditable", "false");
  await expect(page.getByRole("button", { name: "Add line item", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Quantity", { exact: true }).first()).toBeDisabled();

  await page.getByRole("button", { name: "Open TanStack Devtools", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Inspect dispatch #/ }).first()).toBeVisible();
  expect(errors).toEqual([]);
});
