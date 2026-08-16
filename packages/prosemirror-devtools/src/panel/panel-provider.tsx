import { createContext, use, useCallback, useEffect, useId, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { createDevtoolsDataAccess, type DevtoolsDataAccess } from "../core/data-client";
import type { DevtoolsStore, DevtoolsTheme } from "../core/types";
import { useResolvedTheme } from "./hooks/use-resolved-theme";
import type { ResolvedPanelDefinition } from "./panel-registry";
import type { PanelDensity } from "./panel.types";
import { ensurePanelStyles } from "./styles";

type PanelNavigation = Readonly<{
  activePanel: string;
  panels: readonly ResolvedPanelDefinition[];
  selectPanel: (panelId: string) => void;
}>;

type PanelAppearance = Readonly<{
  themeChoice: DevtoolsTheme;
  resolvedTheme: "light" | "dark";
  density: PanelDensity;
  cycleTheme: () => void;
  toggleDensity: () => void;
}>;

type PanelMeta = Readonly<{
  ownerDocument: Document;
  panelId: string;
  tabPanelId: string;
  tabId: (panelId: string) => string;
}>;

const PanelStoreContext = createContext<DevtoolsStore | null>(null);
const PanelNavigationContext = createContext<PanelNavigation | null>(null);
const PanelAppearanceContext = createContext<PanelAppearance | null>(null);
const PanelMetaContext = createContext<PanelMeta | null>(null);
const PanelDataContext = createContext<DevtoolsDataAccess | null>(null);

function nextTheme(theme: DevtoolsTheme): DevtoolsTheme {
  if (theme === "system") return "light";
  if (theme === "light") return "dark";
  return "system";
}

function encodePanelId(panelId: string): string {
  try {
    return encodeURIComponent(panelId);
  } catch {
    return Array.from(
      { length: panelId.length },
      (_, index) => `%u${panelId.charCodeAt(index).toString(16).padStart(4, "0")}`,
    ).join("");
  }
}

export function PanelProvider({
  store,
  theme,
  defaultPanel,
  activePanel: controlledActivePanel,
  onActivePanelChange,
  panels,
  styleTarget,
  children,
}: {
  store: DevtoolsStore;
  theme: DevtoolsTheme;
  defaultPanel: string;
  activePanel: string | undefined;
  onActivePanelChange: ((panelId: string) => void) | undefined;
  panels: readonly ResolvedPanelDefinition[];
  styleTarget: Document | undefined;
  children: ReactNode;
}): ReactElement {
  useEffect(() => ensurePanelStyles(styleTarget), [styleTarget]);

  const [uncontrolledActivePanel, setUncontrolledActivePanel] = useState(defaultPanel);
  const [themePreference, setThemePreference] = useState(() => ({ source: theme, value: theme }));
  const [density, setDensity] = useState<PanelDensity>("compact");
  const panelId = useId();
  const themeChoice = themePreference.source === theme ? themePreference.value : theme;
  const resolvedTheme = useResolvedTheme(themeChoice);
  const requestedActivePanel = controlledActivePanel ?? uncontrolledActivePanel;
  const activePanel = panels.some(({ id }) => id === requestedActivePanel)
    ? requestedActivePanel
    : (panels[0]?.id ?? "");
  const dataAccess = useMemo(() => createDevtoolsDataAccess(store), [store]);

  const cycleTheme = useCallback(() => {
    setThemePreference((current) => {
      const value = current.source === theme ? current.value : theme;
      return { source: theme, value: nextTheme(value) };
    });
  }, [theme]);
  const toggleDensity = useCallback(() => {
    setDensity((current) => (current === "compact" ? "comfortable" : "compact"));
  }, []);

  const selectPanel = useCallback(
    (panelId: string) => {
      if (!panels.some(({ id }) => id === panelId)) {
        throw new Error(`Cannot select unknown devtools panel "${panelId}".`);
      }
      if (controlledActivePanel === undefined) setUncontrolledActivePanel(panelId);
      onActivePanelChange?.(panelId);
    },
    [controlledActivePanel, onActivePanelChange, panels],
  );

  const navigation = useMemo<PanelNavigation>(
    () => ({ activePanel, panels, selectPanel }),
    [activePanel, panels, selectPanel],
  );
  const appearance = useMemo<PanelAppearance>(
    () => ({ themeChoice, resolvedTheme, density, cycleTheme, toggleDensity }),
    [themeChoice, resolvedTheme, density, cycleTheme, toggleDensity],
  );
  const meta = useMemo<PanelMeta>(
    () => ({
      ownerDocument: styleTarget ?? document,
      panelId,
      tabPanelId: `${panelId}-tabpanel`,
      tabId: (nextPanelId) => `${panelId}-tab-${encodePanelId(nextPanelId)}`,
    }),
    [panelId, styleTarget],
  );

  return (
    <PanelStoreContext value={store}>
      <PanelDataContext value={dataAccess}>
        <PanelNavigationContext value={navigation}>
          <PanelAppearanceContext value={appearance}>
            <PanelMetaContext value={meta}>{children}</PanelMetaContext>
          </PanelAppearanceContext>
        </PanelNavigationContext>
      </PanelDataContext>
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

export function usePanelDataAccess(): DevtoolsDataAccess {
  return requiredContext(use(PanelDataContext));
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
