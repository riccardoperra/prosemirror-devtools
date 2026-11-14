import type { Editor } from "@tiptap/core";
import { useState } from "react";

import { useCollab } from "../collab/context";
import { useDevtools } from "../devtools/context";
import { panelSections, scenarios } from "../scenarios";
import { LoadLab } from "./LoadLab";
import { OutlinePanel } from "./OutlinePanel";

type Outcome = "applied" | "no-op";

export function ScenariosPanel({ editor }: { editor: Editor }) {
  const [outcomes, setOutcomes] = useState<Readonly<Record<string, Outcome>>>({});
  const devtools = useDevtools();
  const collab = useCollab();
  const mode = collab ? "room" : "solo";
  return (
    <aside className="sidebar sidebar-start" aria-label="Outline, scenarios and load lab">
      <OutlinePanel editor={editor} />
      <details className="sidebar-section scenarios" open>
        <summary>
          <h2>Scenarios</h2>
        </summary>
        <p className="sidebar-hint">Run one, then press ⌘⇧D to inspect it.</p>
        <ol>
          {scenarios
            .filter((scenario) => (scenario.mode ?? mode) === mode)
            .map((scenario) => (
              <li key={scenario.id}>
                <details className="scenario">
                  <summary>{scenario.title}</summary>
                  <div className="scenario-body">
                    <p>{scenario.description}</p>
                    {scenario.inspect.map(({ panel, observe }) => (
                      <p key={panel} className="scenario-inspect">
                        <span className="scenario-panel">
                          {panelSections[panel] === panel
                            ? panel
                            : `${panelSections[panel]} › ${panel}`}
                        </span>{" "}
                        {observe}
                      </p>
                    ))}
                    <div className="scenario-actions">
                      <button
                        type="button"
                        aria-label={`Run ${scenario.title}`}
                        onClick={async () => {
                          const outcome = (await scenario.run(editor, devtools, collab))
                            ? "applied"
                            : "no-op";
                          setOutcomes((current) => ({ ...current, [scenario.id]: outcome }));
                        }}
                      >
                        Run
                      </button>
                      {outcomes[scenario.id] ? (
                        <output className={`scenario-outcome is-${outcomes[scenario.id]}`}>
                          {outcomes[scenario.id] === "applied"
                            ? "Dispatched"
                            : "Nothing to do here"}
                        </output>
                      ) : null}
                    </div>
                  </div>
                </details>
              </li>
            ))}
        </ol>
      </details>
      <LoadLab editor={editor} />
    </aside>
  );
}
