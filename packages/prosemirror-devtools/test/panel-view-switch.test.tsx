import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";

import { ViewSwitch } from "../src/panel/ui/view-switch";

afterEach(() => document.body.replaceChildren());

describe("view switch", () => {
  it("marks the current view, reports changes and keeps buttons stable when labels change", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const [value, setValue] = createSignal<"calls" | "tools">("calls");
    const [count, setCount] = createSignal(1);
    const dispose = render(
      () => (
        <ViewSwitch
          label="Example view"
          onChange={setValue}
          options={[
            { value: "calls", label: `Calls (${count()})` },
            { value: "tools", label: "Tools", ariaLabel: "Show available tools" },
          ]}
          value={value()}
        />
      ),
      host,
    );
    try {
      const group = host.querySelector('[role="group"][aria-label="Example view"]');
      const [calls, tools] = Array.from(group?.querySelectorAll("button") ?? []);
      expect(calls?.getAttribute("aria-pressed")).toBe("true");
      expect(tools?.getAttribute("aria-label")).toBe("Show available tools");

      setCount(2);
      expect(group?.querySelectorAll("button")[0]).toBe(calls);
      expect(calls?.textContent).toBe("Calls (2)");

      tools?.click();
      expect(value()).toBe("tools");
      expect(tools?.getAttribute("aria-pressed")).toBe("true");
      expect(calls?.getAttribute("aria-pressed")).toBe("false");
    } finally {
      dispose();
    }
  });
});
