import { useEffect, useState } from "react";

import type { DevtoolsTheme } from "../../core/types";

export function useResolvedTheme(theme: DevtoolsTheme): "light" | "dark" {
  const [prefersDark, setPrefersDark] = useState(() =>
    typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)").matches : false,
  );

  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setPrefersDark(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return theme === "system" ? (prefersDark ? "dark" : "light") : theme;
}
