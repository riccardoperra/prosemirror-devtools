import { createEffect, createMemo, createSignal, onCleanup, type Accessor } from "solid-js";

import type {
  DevtoolsDiagnosticEvent,
  DevtoolsDiagnosticsSnapshot,
} from "../../../core/diagnostics";
import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { useOptionalPanelInspection } from "../../panel-provider";

export const EVENT_PAGE_SIZE = 100;
const NO_EVENTS: readonly DevtoolsDiagnosticEvent[] = [];

export type EventStatus = "handled" | "unhandled" | "unknown" | "error";

export function eventStatus(event: DevtoolsDiagnosticEvent): EventStatus {
  if (event.error !== null) return "error";
  return event.handled === null ? "unknown" : event.handled ? "handled" : "unhandled";
}

export function eventSource(event: DevtoolsDiagnosticEvent): string {
  return (
    event.pluginLabel ??
    event.pluginKey ??
    (event.kind === "command" ? "Application command" : "Unattributed callback")
  );
}

export function useEvents(instance: Accessor<RegisteredProseMirrorInstance>) {
  const controller = createMemo(() => instance().diagnostics);
  const [snapshot, setSnapshot] = createSignal<DevtoolsDiagnosticsSnapshot>();
  const [query, setQuery] = createSignal("");
  const [plugin, setPlugin] = createSignal("");
  const [status, setStatus] = createSignal<EventStatus | "">("");
  const inspection = useOptionalPanelInspection();
  const [localRequestedId, setLocalRequestedId] = createSignal<number | null>(null);
  const requestedId = inspection?.eventId ?? localRequestedId;
  const setRequestedId = inspection?.selectEvent ?? setLocalRequestedId;
  const [requestedPage, setRequestedPage] = createSignal(0);

  createEffect(() => {
    const source = controller();
    if (!inspection) setRequestedId(null);
    setRequestedPage(0);
    setPlugin("");
    if (!source) {
      setSnapshot(undefined);
      return;
    }
    const update = () => setSnapshot(source.getSnapshot());
    onCleanup(source.subscribe(update));
    update();
  });

  const events = createMemo(() => snapshot()?.events ?? NO_EVENTS);
  const plugins = createMemo(() => {
    const seen = new Map<string, string>();
    for (const event of events()) {
      if (event.pluginKey !== null) seen.set(event.pluginKey, eventSource(event));
    }
    return Array.from(seen, ([key, label]) => ({ key, label }));
  });
  const filtered = createMemo(() => {
    const search = query().trim().toLowerCase();
    const selectedPlugin = plugin();
    const selectedStatus = status();
    return events().filter((event) => {
      if (selectedPlugin === "commands" && event.kind !== "command") return false;
      if (selectedPlugin.startsWith("plugin:") && selectedPlugin.slice(7) !== event.pluginKey) {
        return false;
      }
      if (selectedStatus && eventStatus(event) !== selectedStatus) return false;
      return (
        !search ||
        `${event.name} ${event.pluginKey ?? ""} ${eventSource(event)} ${event.error ?? ""}`
          .toLowerCase()
          .includes(search)
      );
    });
  });
  const pageCount = createMemo(() => Math.max(1, Math.ceil(filtered().length / EVENT_PAGE_SIZE)));
  const page = createMemo(() => Math.min(requestedPage(), pageCount() - 1));
  const pageEnd = createMemo(() => filtered().length - page() * EVENT_PAGE_SIZE);
  const pageStart = createMemo(() => Math.max(0, pageEnd() - EVENT_PAGE_SIZE));
  const visible = createMemo(() => filtered().slice(pageStart(), pageEnd()));
  const selected = createMemo(() => {
    const id = requestedId();
    return (
      (id === null ? undefined : filtered().find((event) => event.id === id)) ?? visible().at(-1)
    );
  });
  const followLatest = (): void => {
    setRequestedId(null);
    setRequestedPage(0);
  };
  const select = (id: number): void => {
    let matching: readonly DevtoolsDiagnosticEvent[] = filtered();
    let index = matching.findIndex((event) => event.id === id);
    if (index === -1) {
      setQuery("");
      setPlugin("");
      setStatus("");
      matching = events();
      index = matching.findIndex((event) => event.id === id);
    }
    if (index === -1) return;
    setRequestedPage(Math.floor((matching.length - index - 1) / EVENT_PAGE_SIZE));
    setRequestedId(id);
  };
  const clear = (): void => {
    controller()?.clearEvents();
    followLatest();
  };

  return {
    controller,
    events,
    plugins,
    query,
    setQuery,
    plugin,
    setPlugin,
    status,
    setStatus,
    filtered,
    page,
    pageCount,
    pageStart,
    pageEnd,
    visible,
    selected,
    select,
    followLatest,
    followingLatest: () => requestedId() === null && page() === 0,
    setPage: (value: number) => {
      setRequestedId(null);
      setRequestedPage(value);
    },
    clear,
  };
}
