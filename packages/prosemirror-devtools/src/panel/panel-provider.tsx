import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  useContext,
  type Accessor,
  type JSX,
} from "solid-js";

import { createDevtoolsDataAccess, type DevtoolsDataAccess } from "../core/data-client";
import type { DevtoolsStore, DevtoolsTheme } from "../core/types";
import { useResolvedTheme } from "./hooks/use-resolved-theme";
import type { ResolvedPanelDefinition } from "./panel-registry";
import type { PanelDensity } from "./panel.types";
import { ensurePanelStyles } from "./styles";

type PanelNavigation = Readonly<{
  activePanel: Accessor<string>;
  panels: Accessor<readonly ResolvedPanelDefinition[]>;
  selectPanel: (panelId: string) => void;
}>;

type PanelAppearance = Readonly<{
  themeChoice: Accessor<DevtoolsTheme>;
  resolvedTheme: Accessor<"light" | "dark">;
  density: Accessor<PanelDensity>;
  cycleTheme: () => void;
}>;

type PanelMeta = Readonly<{
  ownerDocument: Accessor<Document>;
  panelId: string;
  tabPanelId: string;
  tabId: (panelId: string) => string;
}>;

type PanelContextValue = Readonly<{
  data: DevtoolsDataAccess;
  navigation: PanelNavigation;
  appearance: PanelAppearance;
  meta: PanelMeta;
}>;

const PanelContext = createContext<PanelContextValue>();

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

export interface PanelProviderProps {
  store: DevtoolsStore;
  theme: DevtoolsTheme;
  defaultPanel: string;
  activePanel: string | undefined;
  onActivePanelChange: ((panelId: string) => void) | undefined;
  panels: readonly ResolvedPanelDefinition[];
  styleTarget: Document | undefined;
  children: JSX.Element;
}

export function PanelProvider(props: PanelProviderProps): JSX.Element {
  createEffect(() => ensurePanelStyles(props.styleTarget));

  const [uncontrolledActivePanel, setUncontrolledActivePanel] = createSignal(props.defaultPanel);
  const [themePreference, setThemePreference] = createSignal({
    source: props.theme,
    value: props.theme,
  });
  const density = (): PanelDensity => "compact";
  const panelId = createUniqueId();
  const ownerDocument = (): Document => props.styleTarget ?? document;
  const themeChoice = createMemo(() => {
    const preference = themePreference();
    return preference.source === props.theme ? preference.value : props.theme;
  });
  const resolvedTheme = useResolvedTheme(themeChoice, ownerDocument);
  const activePanel = createMemo(() => {
    const requested = props.activePanel ?? uncontrolledActivePanel();
    return props.panels.some(({ id }) => id === requested)
      ? requested
      : (props.panels[0]?.id ?? "");
  });
  const dataAccess = createDevtoolsDataAccess(props.store);

  const cycleTheme = (): void => {
    setThemePreference((current) => {
      const value = current.source === props.theme ? current.value : props.theme;
      return { source: props.theme, value: nextTheme(value) };
    });
  };
  const selectPanel = (nextPanelId: string): void => {
    if (!props.panels.some(({ id }) => id === nextPanelId)) {
      throw new Error(`Cannot select unknown devtools panel "${nextPanelId}".`);
    }
    if (props.activePanel === undefined) setUncontrolledActivePanel(nextPanelId);
    props.onActivePanelChange?.(nextPanelId);
  };

  const navigation: PanelNavigation = {
    activePanel,
    panels: () => props.panels,
    selectPanel,
  };
  const appearance: PanelAppearance = {
    themeChoice,
    resolvedTheme,
    density,
    cycleTheme,
  };
  const meta: PanelMeta = {
    ownerDocument,
    panelId,
    tabPanelId: `${panelId}-tabpanel`,
    tabId: (nextPanelId) => `${panelId}-tab-${encodePanelId(nextPanelId)}`,
  };
  const context: PanelContextValue = { data: dataAccess, navigation, appearance, meta };

  return <PanelContext.Provider value={context}>{props.children}</PanelContext.Provider>;
}

function usePanelContext(): PanelContextValue {
  const value = useContext(PanelContext);
  if (value === undefined) {
    throw new Error("Panel components must be rendered inside PanelProvider.");
  }
  return value;
}

export function usePanelDataAccess(): DevtoolsDataAccess {
  return usePanelContext().data;
}

export function usePanelNavigation(): PanelNavigation {
  return usePanelContext().navigation;
}

export function usePanelAppearance(): PanelAppearance {
  return usePanelContext().appearance;
}

export function usePanelMeta(): PanelMeta {
  return usePanelContext().meta;
}
