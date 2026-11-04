import { expect, type Page } from "@playwright/test";

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error("Expected a diagnostic object.");
  }
  return value;
}

export async function callTool(page: Page, name: string, args: unknown = {}): Promise<unknown> {
  return page.evaluate(
    ({ name, args }) => {
      let response: unknown;
      let discovered = false;
      const event = new Event("devtoolstooldiscovery");
      Object.defineProperty(event, "respondWith", {
        value(group: unknown) {
          if (
            group === null ||
            typeof group !== "object" ||
            !("tools" in group) ||
            !Array.isArray(group.tools)
          ) {
            throw new Error("The discovery group has no tools.");
          }
          const selected: unknown = group.tools.find(
            (entry: unknown) =>
              entry !== null && typeof entry === "object" && "name" in entry && entry.name === name,
          );
          if (
            selected === null ||
            typeof selected !== "object" ||
            !("execute" in selected) ||
            typeof selected.execute !== "function"
          ) {
            throw new Error(`Missing diagnostic tool ${name}.`);
          }
          discovered = true;
          response = selected.execute(args);
        },
      });
      window.dispatchEvent(event);
      if (!discovered) throw new Error("No opted-in ProseMirror discovery bridge responded.");
      return response;
    },
    { name, args },
  );
}

export async function editorTarget(page: Page): Promise<Record<string, unknown>> {
  await expect
    .poll(async () => {
      const listing = object(await callTool(page, "prosemirror_editors"));
      return Array.isArray(listing.editors) ? listing.editors.length : 0;
    })
    .toBe(1);
  const listing = object(await callTool(page, "prosemirror_editors"));
  if (!Array.isArray(listing.editors) || listing.editors.length !== 1) {
    throw new Error("The fixture must expose exactly one editor.");
  }
  return object(object(listing.editors[0]).target);
}

export function available(value: unknown): Record<string, unknown> {
  const result = object(value);
  if (result.kind !== "available")
    throw new Error(`Unavailable diagnostic result ${JSON.stringify(result)}.`);
  return result;
}
