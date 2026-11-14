import type { Editor } from "@tiptap/core";
import { useState } from "react";

import { panelSections, scenarios } from "../scenarios";
import { LoadLab } from "./LoadLab";

type Outcome = "applied" | "no-op";

export function ScenariosPanel({ editor }: { editor: Editor }) {
  const [outcomes, setOutcomes] = useState<Readonly<Record<string, Outcome>>>({});
  return (
    <aside className="sidebar sidebar-start" aria-label="Scenarios and load lab">
      <details className="sidebar-section scenarios" open>
        <summary>
          <h2>Scenarios</h2>
        </summary>
        <p className="sidebar-hint">Run one, then press ⌘⇧D to inspect it.</p>
        <ol>
          {scenarios.map((scenario) => (
            <li key={scenario.id}>
              <details className="scenario">
                <summary>{scenario.title}</summary>
                <div className="scenario-body">
                  <p>{scenario.description}</p>
                  <p className="scenario-inspect">
                    <span className="scenario-panel">
                      {panelSections[scenario.inspect.panel] === scenario.inspect.panel
                        ? scenario.inspect.panel
                        : `${panelSections[scenario.inspect.panel]} › ${scenario.inspect.panel}`}
                    </span>{" "}
                    {scenario.inspect.observe}
                  </p>
                  <div className="scenario-actions">
                    <button
                      type="button"
                      aria-label={`Run ${scenario.title}`}
                      onClick={() => {
                        const outcome = scenario.run(editor) ? "applied" : "no-op";
                        setOutcomes((current) => ({ ...current, [scenario.id]: outcome }));
                      }}
                    >
                      Run
                    </button>
                    {outcomes[scenario.id] ? (
                      <output className={`scenario-outcome is-${outcomes[scenario.id]}`}>
                        {outcomes[scenario.id] === "applied" ? "Dispatched" : "Nothing to do here"}
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
