import { createMemo, createSignal, For, Show, type JSX } from "solid-js";

import { resolveInspectionLimits, serializeInspectionValue } from "../../inspection/serialization";
import { usePanelInspection, usePanelMeta, usePanelNavigation } from "../panel-provider";
import { readInstanceState } from "../store/instance-state";
import { cx, panelStyles } from "../styles";
import { Badge } from "../ui/badge";
import { CopyDiagnosticContext } from "../ui/copy-diagnostic-context";
import { InspectionReadout } from "../ui/inspection-readout";

export function InspectionContextView(): JSX.Element {
  const inspection = usePanelInspection();
  const meta = usePanelMeta();
  const navigation = usePanelNavigation();
  const capture = () => inspection.instance()?.inspection?.capture;
  const inspectors = () => inspection.instance()?.inspection?.inspectors ?? [];
  const gaps = () => (capture()?.gaps.length ?? 0) + (capture()?.omittedGapCount ?? 0);
  const [detailsOpen, setDetailsOpen] = createSignal(false);
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
        eventId: inspection.eventId(),
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
    <div class={cx(panelStyles.pmScroll, panelStyles.pmInspectionContext)}>
      <div class={panelStyles.pmInspectionContextHeading}>
        <h2>Context</h2>
        <Show when={inspection.moment().kind === "live"}>
          <Badge tone="green">Live editor</Badge>
        </Show>
      </div>
      <div class={panelStyles.pmInspectionSummary}>
        <section aria-label="Captured data">
          <h3>Captured data</h3>
          <Show when={capture()} fallback={<p>Capture information is unavailable.</p>}>
            {(current) => (
              <>
                <Badge tone={current().kind === "recording" ? "green" : "yellow"}>
                  {current().kind === "recording" ? "Recording" : "Paused"}
                </Badge>
                <p>
                  {inspection.instance()?.transactions.length ?? 0} retained dispatches
                  {" · "}
                  {gaps() === 0
                    ? "No recorded gaps"
                    : gaps() === 1
                      ? "1 recorded gap"
                      : `${gaps()} recorded gaps`}
                </p>
              </>
            )}
          </Show>
        </section>
        <section aria-label="Installed inspectors">
          <h3>Installed inspectors</h3>
          <Show
            when={inspectors().length}
            fallback={<p>No inspectors installed for this editor.</p>}
          >
            <ul>
              <For each={inspectors()}>
                {({ descriptor }) => <li title={descriptor.description}>{descriptor.label}</li>}
              </For>
            </ul>
          </Show>
        </section>
      </div>
      <details
        class={panelStyles.pmDisclosure}
        open={detailsOpen()}
        onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
      >
        <summary>Technical details</summary>
        <Show when={detailsOpen()}>
          <div class={panelStyles.pmInspectionDetailsContent}>
            <Show when={capabilities()}>
              {(value) => <InspectionReadout result={value()} label="Capabilities and coverage" />}
            </Show>
            <Show when={contributions()}>
              {(value) => (
                <InspectionReadout result={value()} label="Semantic inspector evidence" />
              )}
            </Show>
          </div>
        </Show>
      </details>
      <div class={panelStyles.pmInspectionContextActions}>
        <CopyDiagnosticContext read={diagnosticContext} ownerDocument={meta.ownerDocument()} />
      </div>
    </div>
  );
}
