import { createContext, use, useCallback, useEffect, useId, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import type { DevtoolsStore, DevtoolsTheme } from "../core/types";
import { useResolvedTheme } from "./hooks/use-resolved-theme";
import type { PanelDensity, ProseMirrorDevtoolsTab } from "./panel.types";
import { ensurePanelStyles } from "./styles";

type PanelNavigation = Readonly<{
  activeTab: ProseMirrorDevtoolsTab;
  selectTab: (tab: ProseMirrorDevtoolsTab) => void;
}>;

type PanelAppearance = Readonly<{
  themeChoice: DevtoolsTheme;
  resolvedTheme: "light" | "dark";
  density: PanelDensity;
  cycleTheme: () => void;
  toggleDensity: () => void;
}>;

type PanelMeta = Readonly<{
  panelId: string;
  tabPanelId: string;
}>;

const PanelStoreContext = createContext<DevtoolsStore | null>(null);
const PanelNavigationContext = createContext<PanelNavigation | null>(null);
const PanelAppearanceContext = createContext<PanelAppearance | null>(null);
const PanelMetaContext = createContext<PanelMeta | null>(null);

function nextTheme(theme: DevtoolsTheme): DevtoolsTheme {
  if (theme === "system") return "light";
  if (theme === "light") return "dark";
  return "system";
}

export function PanelProvider({
  store,
  theme,
  defaultTab,
  styleTarget,
  children,
}: {
  store: DevtoolsStore;
  theme: DevtoolsTheme;
  defaultTab: ProseMirrorDevtoolsTab;
  styleTarget: Document | undefined;
  children: ReactNode;
}): ReactElement {
  useEffect(() => ensurePanelStyles(styleTarget), [styleTarget]);

  const [activeTab, selectTab] = useState<ProseMirrorDevtoolsTab>(defaultTab);
  const [themePreference, setThemePreference] = useState(() => ({ source: theme, value: theme }));
  const [density, setDensity] = useState<PanelDensity>("compact");
  const panelId = useId();
  const themeChoice = themePreference.source === theme ? themePreference.value : theme;
  const resolvedTheme = useResolvedTheme(themeChoice);

  const cycleTheme = useCallback(() => {
    setThemePreference((current) => {
      const value = current.source === theme ? current.value : theme;
      return { source: theme, value: nextTheme(value) };
    });
  }, [theme]);
  const toggleDensity = useCallback(() => {
    setDensity((current) => (current === "compact" ? "comfortable" : "compact"));
  }, []);

  const navigation = useMemo<PanelNavigation>(() => ({ activeTab, selectTab }), [activeTab]);
  const appearance = useMemo<PanelAppearance>(
    () => ({ themeChoice, resolvedTheme, density, cycleTheme, toggleDensity }),
    [themeChoice, resolvedTheme, density, cycleTheme, toggleDensity],
  );
  const meta = useMemo<PanelMeta>(
    () => ({ panelId, tabPanelId: `${panelId}-tabpanel` }),
    [panelId],
  );

  return (
    <PanelStoreContext value={store}>
      <PanelNavigationContext value={navigation}>
        <PanelAppearanceContext value={appearance}>
          <PanelMetaContext value={meta}>{children}</PanelMetaContext>
        </PanelAppearanceContext>
      </PanelNavigationContext>
    </PanelStoreContext>
  );
}

function requiredContext<T>(value: T | null): T {
  if (value === null) throw new Error("Panel components must be rendered inside PanelProvider.");
  return value;
}

export function usePanelStore(): DevtoolsStore {
  return requiredContext(use(PanelStoreContext));
}

export function usePanelNavigation(): PanelNavigation {
  return requiredContext(use(PanelNavigationContext));
}

export function usePanelAppearance(): PanelAppearance {
  return requiredContext(use(PanelAppearanceContext));
}

export function usePanelMeta(): PanelMeta {
  return requiredContext(use(PanelMetaContext));
}
