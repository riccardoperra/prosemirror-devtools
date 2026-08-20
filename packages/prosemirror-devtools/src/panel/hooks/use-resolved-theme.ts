import { createEffect, createMemo, createSignal, onCleanup, type Accessor } from "solid-js";

import type { DevtoolsTheme } from "../../core/types";

export function useResolvedTheme(
  theme: Accessor<DevtoolsTheme>,
  ownerDocument: Accessor<Document>,
): Accessor<"light" | "dark"> {
  const [prefersDark, setPrefersDark] = createSignal(false);

  createEffect(() => {
    const matchMedia = ownerDocument().defaultView?.matchMedia;
    if (!matchMedia) return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setPrefersDark(query.matches);
    update();
    query.addEventListener("change", update);
    onCleanup(() => query.removeEventListener("change", update));
  });

  return createMemo(() =>
    theme() === "system" ? (prefersDark() ? "dark" : "light") : (theme() as "light" | "dark"),
  );
}
