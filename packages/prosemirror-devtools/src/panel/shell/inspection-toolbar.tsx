import { readInstanceState } from "../store/instance-state";
import { createMemo, createSignal, For, Show, type JSX } from "solid-js";

import { usePanelInspection, usePanelMeta, usePanelNavigation } from "../panel-provider";
import { serializeInspectionValue, resolveInspectionLimits } from "../../inspection/serialization";
import { InspectionReadout } from "../ui/inspection-readout";
import { CopyDiagnosticContext } from "../ui/copy-diagnostic-context";
import { panelStyles } from "../styles";
import { Badge } from "../ui/badge";

export function InspectionToolbar(): JSX.Element {
  const inspection = usePanelInspection();
  const meta = usePanelMeta();
  const navigation = usePanelNavigation();
  const [detailsOpen, setDetailsOpen] = createSignal(false);
  const historical = () => {
    const moment = inspection.moment();
    return moment.kind === "transaction" ? moment : undefined;
  };
  const capabilities = createMemo(() =>
    detailsOpen() ? inspection.read({ kind: "capabilities" }) : undefined,
  );
  const contributions = createMemo(() =>
    detailsOpen() ? inspection.read({ kind: "contributions" }) : undefined,
  );
  const diagnosticContext = (): string => {
    const position = inspection.position();
    const instance = inspection.instance();
    const pinned = inspection.readPoint();
    const context = {
      version: 1,
      source: { kind: "live", id: inspection.target()?.sourceId ?? null },
      target: inspection.target() ?? null,
      editorLabel: instance?.label ?? null,
      point: pinned?.point ?? null,
      pointAvailability: pinned?.kind ?? "unsupported",
      selected: {
        panel: navigation.activePanel(),
        eventId:
          inspection.eventId() ??
          (navigation.activePanel() === "events"
            ? (instance?.diagnostics?.getSnapshot().events.at(-1)?.id ?? null)
            : null),
        pluginKey: inspection.pluginKey() ?? null,
        position: position
          ? {
              pos: position.pos,
              isRoot: position.isRoot,
              currentDocument:
                !!instance &&
                position.doc === readInstanceState(instance).doc &&
                position.doc === instance.view.state.doc,
            }
          : null,
      },
      evidence:
        inspection.read(
          { kind: "capabilities" },
          { maxItems: 20, maxBytes: 8_000, maxStringLength: 500, maxNodes: 1_000 },
        ) ?? null,
    };
    const serialized = serializeInspectionValue(
      context,
      resolveInspectionLimits({ maxBytes: 16_000, maxNodes: 2_000, maxStringLength: 2_000 }),
    );
    return JSON.stringify(
      serialized.kind === "available"
        ? serialized.value
        : { version: 1, kind: serialized.kind, reason: serialized.reason },
    );
  };

  return (
    <Show when={inspection.instance()}>
      <div class={panelStyles.pmInspectionToolbar} aria-label="Inspection context">
        <Show when={historical()} fallback={<Badge tone="green">Live editor</Badge>}>
          {(moment) => (
            <Badge tone={inspection.transaction() ? "blue" : "yellow"}>
              Dispatch #{moment().id} · {moment().phase}
            </Badge>
          )}
        </Show>
        <Show when={historical() && !inspection.transaction()}>
          <span role="status">This dispatch is unavailable in the current editor session.</span>
        </Show>
        <Show when={historical()}>
          {(moment) => (
            <div
              class={panelStyles.pmViewSwitch}
              role="group"
              aria-label="Historical dispatch phase"
            >
              <For each={["before", "after"] as const}>
                {(phase) => (
                  <button
                    type="button"
                    aria-pressed={moment().phase === phase}
                    disabled={!inspection.transaction()}
                    onClick={() =>
                      inspection.selectTransaction({
                        instanceId: moment().target?.editorId ?? inspection.instance()?.id ?? "",
                        id: moment().id,
                        phase,
                      })
                    }
                  >
                    {phase === "before" ? "Before dispatch" : "After dispatch"}
                  </button>
                )}
              </For>
            </div>
          )}
        </Show>
        <span class={panelStyles.pmSpacer} />
        <CopyDiagnosticContext read={diagnosticContext} ownerDocument={meta.ownerDocument()} />
        <button
          type="button"
          class={panelStyles.pmButton}
          aria-pressed={!historical()}
          onClick={inspection.followLive}
        >
          Follow live
        </button>
        <details
          class={panelStyles.pmDocumentDisclosure}
          style={{ width: "100%", "max-height": "260px", overflow: "auto" }}
          aria-label="Inspectors and capture coverage"
          open={detailsOpen()}
          onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
        >
          <summary>Inspectors and capture coverage</summary>
          <Show when={detailsOpen()}>
            <Show when={capabilities()}>
              {(value) => <InspectionReadout result={value()} label="Capabilities and coverage" />}
            </Show>
            <Show when={contributions()}>
              {(value) => (
                <InspectionReadout result={value()} label="Semantic inspector evidence" />
              )}
            </Show>
          </Show>
        </details>
      </div>
    </Show>
  );
}
