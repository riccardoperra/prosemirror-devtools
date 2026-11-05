import { expect, test } from "@playwright/test";

for (const host of ["standalone", "tanstack"]) {
  for (const width of [390, 1280]) {
    test(`${host} keeps context in a separate tab at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`http://127.0.0.1:${host === "tanstack" ? 4174 : 4180}`);
      if (host === "tanstack")
        await page.getByRole("button", { name: "Open TanStack Devtools", exact: true }).click();
      const panel = page.getByRole("tabpanel");
      await expect(
        page.getByRole("button", { name: "Copy diagnostic context", exact: true }),
      ).toHaveCount(0);
      await page.getByRole("tab", { name: "Context", exact: true }).click();
      const initialBounds = await panel.boundingBox();
      expect(initialBounds).not.toBeNull();
      await expect(panel.getByRole("region", { name: "Captured data" })).toContainText("Recording");
      await expect(panel.getByRole("region", { name: "Installed inspectors" })).toBeVisible();
      await page.getByRole("button", { name: "Copy diagnostic context", exact: true }).click();
      const context = page.getByRole("textbox", { name: "Diagnostic context JSON" });
      await expect(context).toBeVisible();
      await page.getByText("Technical details", { exact: true }).click();
      await expect(
        page.getByRole("region", { name: "Capabilities and coverage", exact: true }),
      ).toBeVisible();
      const tabs = page.getByRole("tablist", { name: "ProseMirror Inspector panels" });
      const tabsBounds = await tabs.boundingBox();
      const contextBounds = await context.boundingBox();
      const panelBounds = await panel.boundingBox();
      expect(tabsBounds).not.toBeNull();
      expect(contextBounds).not.toBeNull();
      expect(panelBounds).not.toBeNull();
      expect(contextBounds!.width).toBeLessThanOrEqual(width);
      expect(panelBounds!.height).toBeGreaterThan(100);
      expect(panelBounds!.y - (tabsBounds!.y + tabsBounds!.height)).toBeLessThanOrEqual(2);
      expect(panelBounds!.height).toBe(initialBounds!.height);
      await page.getByRole("tab", { name: "Selection", exact: true }).click();
      await expect(panel).toContainText("Head");
      await expect(context).not.toBeVisible();
      await page
        .getByRole("textbox", {
          name: host === "tanstack" ? "Playground document rich text editor" : "Standalone editor",
          exact: true,
        })
        .press("x");
      await page.getByRole("tab", { name: /^Transactions/ }).click();
      const dispatch = page.getByRole("region", { name: /^Dispatch \d+ inspector$/ });
      await expect(dispatch.getByText("Related evidence", { exact: true })).toBeVisible();
      await expect(
        dispatch.getByRole("navigation", { name: "Related dispatch evidence" }),
      ).not.toBeVisible();
      if (width === 1280 && host === "tanstack") {
        await expect(
          dispatch.getByRole("complementary", { name: "Transaction details" }),
        ).toBeInViewport({ ratio: 0.01 });
      }
    });
  }
}
