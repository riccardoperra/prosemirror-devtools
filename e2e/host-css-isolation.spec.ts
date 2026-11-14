import { expect, test, type Locator, type Page } from "@playwright/test";

// Global element rules that real host applications ship.
const hostileHostCss = `
  * { box-sizing: content-box; line-height: 1; }
  button {
    display: inline-flex;
    height: 28px;
    padding: 0 8px;
    border: none;
    background: #222;
    color: #fff;
    font: 700 15px/1 Georgia, serif;
    text-transform: uppercase;
    letter-spacing: 0.2em;
  }
  input, select, textarea {
    height: 40px;
    padding: 10px 14px;
    border: 3px solid #f0f;
    background: #ffd;
    font: 16px/1 Georgia, serif;
  }
  table { margin: 20px; border-collapse: separate; border-spacing: 8px; font-size: 18px; }
  th, td { padding: 9px; }
  ul, ol { margin: 24px; padding: 0 0 0 40px; list-style: square; }
  li { margin: 6px 0; padding: 4px; font-size: 17px; }
  p { margin: 18px 0; font: 18px/1.8 Georgia, serif; }
  h1, h2, h3, h4 {
    margin: 30px 0 12px;
    font: 700 28px/1.1 Georgia, serif;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  a { color: #f00; text-decoration: underline wavy; }
  :focus-visible { outline: 4px solid #f00; outline-offset: 4px; }
`;

async function setHostileCss(page: Page, enabled: boolean): Promise<void> {
  await page.evaluate(
    ({ css, enabled }) => {
      let style = document.getElementById("hostile-host-css");
      if (!style) {
        style = document.createElement("style");
        style.id = "hostile-host-css";
        style.textContent = css;
        document.head.append(style);
      }
      style.setAttribute("media", enabled ? "all" : "not all");
    },
    { css: hostileHostCss, enabled },
  );
}

function measureElements(panel: Locator): Promise<string[]> {
  return panel.evaluate((root) =>
    Array.from(
      root.querySelectorAll("button, select, input, textarea, table, th, td, ul, li, p, h2, h3"),
      (element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return [
          element.tagName,
          element.textContent?.trim().slice(0, 24),
          `${Math.round(rect.width)}x${Math.round(rect.height)}`,
          style.boxSizing,
          style.padding,
          style.margin,
          style.borderWidth,
          style.backgroundColor,
          style.color,
          style.fontFamily,
          style.fontSize,
          style.fontWeight,
          style.lineHeight,
          style.letterSpacing,
          style.textTransform,
        ].join(" | ");
      },
    ),
  );
}

async function expectContentInside(boxes: Locator, contentSelector?: string) {
  const overflowing = await boxes.evaluateAll(
    (elements, selector) =>
      elements.flatMap((box) => {
        const node = selector ? box.querySelector(selector) : box;
        if (!node) return [`${box.textContent?.trim()} has no content`];
        const range = document.createRange();
        range.selectNodeContents(node);
        const inner = range.getBoundingClientRect();
        const outer = box.getBoundingClientRect();
        const inside =
          inner.top >= outer.top - 0.5 &&
          inner.bottom <= outer.bottom + 0.5 &&
          inner.left >= outer.left - 0.5 &&
          inner.right <= outer.right + 0.5;
        return inside ? [] : [`${box.textContent?.trim()}: ${JSON.stringify({ inner, outer })}`];
      }),
    contentSelector,
  );
  expect(overflowing).toEqual([]);
}

for (const host of ["standalone", "tanstack"]) {
  test(`${host} panel keeps its layout under global host element styles`, async ({ page }) => {
    await page.goto(`http://127.0.0.1:${host === "tanstack" ? 4174 : 4180}`);
    if (host === "tanstack")
      await page.getByRole("button", { name: "Open TanStack Devtools", exact: true }).click();
    const panel = page.getByRole("region", { name: "ProseMirror Inspector", exact: true });
    await page
      .getByRole("textbox", {
        name: host === "tanstack" ? "Playground document rich text editor" : "Standalone editor",
        exact: true,
      })
      .pressSequentially("xyz");
    await page.getByRole("tab", { name: /^Timeline/ }).click();
    const rows = panel.getByRole("button", { name: /^Inspect dispatch #/ });
    await expect(rows.first()).toBeVisible();

    for (const tab of ["Timeline", "Document", "Selection", "Context"]) {
      await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
      await setHostileCss(page, false);
      const unstyled = await measureElements(panel);
      await setHostileCss(page, true);
      expect(await measureElements(panel), `${tab} under host CSS`).toEqual(unstyled);
    }

    await page.getByRole("tab", { name: /^Timeline/ }).click();
    expect(await rows.count()).toBeGreaterThanOrEqual(3);
    await expectContentInside(rows, "time");
    await expectContentInside(panel.getByRole("tab"));

    const timelineTab = page.getByRole("tab", { name: /^Timeline/ });
    await timelineTab.focus();
    await page.keyboard.press("ArrowRight");
    const focused = panel.locator("[role=tab]:focus-visible");
    await expect(focused).toHaveCount(1);
    expect(await focused.evaluate((element) => getComputedStyle(element).outlineWidth)).toBe("2px");
  });
}
