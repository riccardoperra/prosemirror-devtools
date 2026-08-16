import { useEffect, useState, useSyncExternalStore } from "react";
import { AllSelection } from "prosemirror-state";
import type {
  DevtoolsDataClient,
  DevtoolsExtensionContext,
  DevtoolsReadable,
  RegisteredProseMirrorInstance,
} from "prosemirror-devtools";

type LatestDispatch = {
  durationMs: number;
  id: number;
  instanceId: string;
  selection: string;
  stateSize: number;
  stepCount: number;
};

function useDevtoolsReadable<T>(readable: DevtoolsReadable<T>): T {
  return useSyncExternalStore(readable.subscribe, readable.getSnapshot, readable.getSnapshot);
}

function formatSelection(instance: RegisteredProseMirrorInstance): string {
  const { from, to } = instance.view.state.selection;
  return from === to ? `Cursor at ${from}` : `${from}–${to}`;
}

function readDocumentStats(instance: RegisteredProseMirrorInstance | undefined) {
  if (!instance) return { characters: 0, words: 0 };
  const text = instance.view.state.doc.textBetween(0, instance.view.state.doc.content.size, " ");
  const trimmed = text.trim();
  return {
    characters: text.length,
    words: trimmed.length === 0 ? 0 : trimmed.split(/\s+/u).length,
  };
}

function useLatestDispatch(
  data: DevtoolsDataClient,
  activeInstanceId: string | undefined,
): LatestDispatch | undefined {
  const [latest, setLatest] = useState<LatestDispatch>();

  useEffect(
    () =>
      data.subscribeDispatch((events) => {
        for (let index = events.length - 1; index >= 0; index -= 1) {
          const event = events[index];
          if (!event || event.instanceId !== activeInstanceId) continue;
          const { from, to } = event.stateAfter.selection;
          setLatest({
            durationMs: event.record.totalDuration,
            id: event.record.id,
            instanceId: event.instanceId,
            selection: from === to ? String(from) : `${from}–${to}`,
            stateSize: event.stateAfter.doc.content.size,
            stepCount: event.record.stepCount,
          });
          return;
        }
      }),
    [activeInstanceId, data],
  );

  return latest?.instanceId === activeInstanceId ? latest : undefined;
}

function selectDocument(instance: RegisteredProseMirrorInstance): void {
  const { view } = instance;
  view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
  view.focus();
}

export function DevtoolsIntegrationPanel({ context }: { context: DevtoolsExtensionContext }) {
  const instance = useDevtoolsReadable(context.data.activeInstance);
  const instances = useDevtoolsReadable(context.data.instanceDescriptors);
  const latestDispatch = useLatestDispatch(context.data, instance?.id);
  const documentStats = readDocumentStats(instance);
  const selection = instance ? formatSelection(instance) : "No active editor";

  return (
    <section
      className="playground-extension"
      data-density={context.host.density}
      data-theme={context.host.theme}
    >
      <header className="playground-extension__command-bar">
        <div className="playground-extension__identity">
          <span className="playground-extension__status" data-connected={Boolean(instance)}>
            <span aria-hidden="true" />
            {instance ? "Live" : "Offline"}
          </span>
          <span className="playground-extension__identity-copy">
            <small>React extension</small>
            <strong>Editor bridge</strong>
          </span>
        </div>

        <div
          aria-label="Editor bridge actions"
          className="playground-extension__actions"
          role="toolbar"
        >
          <button
            aria-label="Focus editor"
            disabled={!instance}
            onClick={() => instance?.view.focus()}
            type="button"
          >
            Focus
          </button>
          <button
            aria-label="Select document"
            disabled={!instance}
            onClick={() => instance && selectDocument(instance)}
            type="button"
          >
            Select all
          </button>
          <button
            aria-label="Open history"
            disabled={!instance}
            onClick={() => context.host.selectPanel("history")}
            type="button"
          >
            History
          </button>
          <button
            aria-label="Clear history"
            data-tone="danger"
            disabled={!instance?.transactions.length}
            onClick={() => instance && context.actions.clearTransactions(instance.id)}
            type="button"
          >
            Clear
          </button>
        </div>
      </header>

      <div className="playground-extension__metrics" aria-label="Live editor data">
        <div>
          <span>Editor</span>
          <strong title={instance?.label}>{instance?.label ?? "None"}</strong>
          <small>{instance?.id ?? `${instances.length} registered`}</small>
        </div>
        <div>
          <span>Doc</span>
          <strong>{documentStats.words} words</strong>
          <small>{documentStats.characters} chars</small>
        </div>
        <div>
          <span>Selection</span>
          <strong>{selection}</strong>
          <small>{instance ? instance.view.state.selection.constructor.name : "—"}</small>
        </div>
        <div>
          <span>History</span>
          <strong>{instance?.transactions.length ?? 0} retained</strong>
          <small>{instance ? `${instance.dispatchCount} observed` : "unbounded"}</small>
        </div>
      </div>

      <div className="playground-extension__rows">
        <div aria-label="Dispatch subscription" className="playground-extension__row" role="group">
          <span className="playground-extension__row-label">
            <strong>Dispatch stream</strong>
            <small>subscribeDispatch</small>
          </span>
          <span className="playground-extension__row-value">
            <strong>{latestDispatch ? `#${latestDispatch.id}` : "Waiting for a batch"}</strong>
            <small>
              {latestDispatch
                ? `${latestDispatch.stepCount} steps · ${latestDispatch.durationMs.toFixed(2)} ms · selection ${latestDispatch.selection}`
                : "Edit the document to receive a transient EditorState."}
            </small>
          </span>
          <code>{latestDispatch ? `${latestDispatch.stateSize} positions` : "state —"}</code>
        </div>

        <div aria-label="Extension host context" className="playground-extension__row" role="group">
          <span className="playground-extension__row-label">
            <strong>Host context</strong>
            <small>framework-neutral</small>
          </span>
          <dl className="playground-extension__host-values">
            <div>
              <dt>Theme</dt>
              <dd>{context.host.theme}</dd>
            </div>
            <div>
              <dt>Density</dt>
              <dd>{context.host.density}</dd>
            </div>
            <div>
              <dt>Panel</dt>
              <dd>{context.host.activePanelId}</dd>
            </div>
            <div>
              <dt>Editors</dt>
              <dd>{instances.length}</dd>
            </div>
          </dl>
          <code>{context.host.signal.aborted ? "disposed" : "mounted"}</code>
        </div>
      </div>
    </section>
  );
}
