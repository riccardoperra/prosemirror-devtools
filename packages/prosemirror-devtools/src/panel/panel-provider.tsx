import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  from,
  onCleanup,
  useContext,
  type Accessor,
  type JSX,
} from "solid-js";

import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import type { DevtoolsDataAccess } from "../core/data-client";
import {
  resolveExperimentalFeatures,
  type ExperimentalFeature,
  type ExperimentalFeatures,
} from "../core/panel-types";
import { createProseMirrorInspectionClient } from "../inspection/client";
import type {
  InspectionLimits,
  InspectionQuery,
  InspectionReadPoint,
  InspectionResult,
  InspectionTarget,
} from "../inspection/types";
import type {
  DevtoolsStore,
  DevtoolsTheme,
  RegisteredProseMirrorInstance,
  TransactionRecord,
} from "../core/types";
import { useResolvedTheme } from "./hooks/use-resolved-theme";
import type { DispatchPresenters } from "./features/dispatch/read-dispatch-effects";
import type { ResolvedPanelDefinition } from "./panel-registry";
import type { PanelDensity } from "./panel.types";
import { ensurePanelStyles } from "./styles";
import { createHostDataAccess } from "./store/host-data-access";

export type PanelInspectionMoment =
  | { kind: "live" }
  | {
      kind: "transaction";
      view: EditorView;
      target: InspectionTarget | null;
      sessionId: string;
      id: number;
      phase: "before" | "after";
    };

export type PanelInspectionPosition = Readonly<{
  doc: ProseMirrorNode;
  pos: number;
  isRoot: boolean;
}>;

export type PanelInspectionContext = Readonly<{
  instance: Accessor<RegisteredProseMirrorInstance | undefined>;
  moment: Accessor<PanelInspectionMoment>;
  transaction: Accessor<TransactionRecord | undefined>;
  position: Accessor<PanelInspectionPosition | undefined>;
  pluginKey: Accessor<string | undefined>;
  eventId: Accessor<number | null>;
  target: Accessor<InspectionTarget | undefined>;
  readPoint: Accessor<InspectionResult<InspectionReadPoint> | undefined>;
  read: (
    query: InspectionQuery,
    limits?: Partial<InspectionLimits>,
  ) => InspectionResult | undefined;
  followLive: () => void;
  selectTransaction: (request: {
    instanceId: string;
    id: number;
    panel?: string;
    phase?: "before" | "after";
  }) => boolean;
  selectPosition: (position: PanelInspectionPosition) => void;
  selectPlugin: (key: string) => void;
  selectEvent: (id: number | null) => void;
}>;

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
  inspection: PanelInspectionContext;
  dispatchPresenters: Accessor<DispatchPresenters | undefined>;
  experiments: Accessor<ReadonlySet<ExperimentalFeature>>;
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
  dispatchPresenters?: DispatchPresenters;
  experimental: ExperimentalFeatures | undefined;
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
  const dataAccess = createHostDataAccess(props.store);
  onCleanup(dataAccess.dispose);
  const instance = from(
    (setValue) =>
      dataAccess.data.activeInstance.subscribe(() =>
        setValue(() => dataAccess.data.activeInstance()),
      ),
    dataAccess.data.activeInstance(),
  );
  const [moment, setMoment] = createSignal<PanelInspectionMoment>({ kind: "live" });
  const [position, setPosition] = createSignal<PanelInspectionPosition>();
  const [pluginKey, setPluginKey] = createSignal<string>();
  const [eventId, setEventId] = createSignal<number | null>(null);
  createEffect<string | undefined>((previousId) => {
    const currentId = instance()?.id;
    if (currentId !== previousId) {
      setMoment({ kind: "live" });
      setPosition(undefined);
      setPluginKey(undefined);
      setEventId(null);
    }
    return currentId;
  });
  const transaction = createMemo(() => {
    const current = instance();
    const point = moment();
    if (!current) return undefined;
    return point.kind === "live"
      ? current.transactions.at(-1)
      : current.view === point.view &&
          (point.target === null ||
            point.target.generation === current.inspection?.target.generation)
        ? current.transactions.find(
            (record) => record.id === point.id && record.sessionId === point.sessionId,
          )
        : undefined;
  });
  const client = createProseMirrorInspectionClient({ store: props.store });
  const target = createMemo(() => {
    const point = moment();
    return point.kind === "transaction"
      ? (point.target ?? undefined)
      : instance()?.inspection?.target;
  });
  const [queryRevision, setQueryRevision] = createSignal(0);
  createEffect(() => {
    const selected = target();
    if (selected)
      onCleanup(
        client.subscribe({ target: selected }, () => setQueryRevision((revision) => revision + 1)),
      );
  });
  const readPoint = createMemo(() => {
    const selected = target();
    const current = moment();
    if (!selected) return undefined;
    if (current.kind === "live") queryRevision();
    else transaction();
    return client.pin({
      target: selected,
      at:
        current.kind === "live"
          ? { kind: "current" }
          : { kind: "transaction", id: current.id, phase: current.phase },
    });
  });

  const experiments = createMemo(() => resolveExperimentalFeatures(props.experimental), undefined, {
    equals: (previous, next) =>
      previous.size === next.size && [...next].every((feature) => previous.has(feature)),
  });

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
  const inspection: PanelInspectionContext = {
    instance,
    moment,
    transaction,
    position,
    pluginKey,
    eventId,
    target,
    readPoint,
    read(query, limits) {
      const pinned = readPoint();
      if (!pinned) return undefined;
      return pinned.kind === "available"
        ? client.read({ point: pinned.value, query, ...(limits ? { limits } : {}) })
        : pinned;
    },
    followLive: () => setMoment({ kind: "live" }),
    selectTransaction(request) {
      const target = dataAccess.data.instance(request.instanceId)();
      const record = target?.transactions.find(({ id }) => id === request.id);
      if (!target || !record) return false;
      dataAccess.actions.setActiveInstance(request.instanceId);
      setMoment({
        kind: "transaction",
        view: target.view,
        target: target.inspection?.target ?? null,
        sessionId: record.sessionId,
        id: record.id,
        phase: request.phase ?? "after",
      });
      setPosition(undefined);
      if (request.panel) selectPanel(request.panel);
      return true;
    },
    selectPosition(next) {
      if (!Number.isInteger(next.pos) || next.pos < 0 || next.pos > next.doc.content.size) return;
      setPosition(next);
    },
    selectPlugin(key) {
      setPluginKey(key);
      selectPanel("plugins");
    },
    selectEvent: setEventId,
  };
  const context: PanelContextValue = {
    data: dataAccess,
    navigation,
    appearance,
    meta,
    inspection,
    dispatchPresenters: () => props.dispatchPresenters,
    experiments,
  };

  return <PanelContext.Provider value={context}>{props.children}</PanelContext.Provider>;
}

export function useOptionalPanelContext(): PanelContextValue | undefined {
  return useContext(PanelContext);
}

function usePanelContext(): PanelContextValue {
  const value = useOptionalPanelContext();
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

export function usePanelInspection(): PanelInspectionContext {
  return usePanelContext().inspection;
}

const NO_EXPERIMENTS: ReadonlySet<ExperimentalFeature> = new Set();

/** Enabled experimental features. Empty outside a panel provider. */
export function usePanelExperiments(): Accessor<ReadonlySet<ExperimentalFeature>> {
  return useContext(PanelContext)?.experiments ?? (() => NO_EXPERIMENTS);
}

export function useOptionalPanelInspection(): PanelInspectionContext | undefined {
  return useContext(PanelContext)?.inspection;
}
