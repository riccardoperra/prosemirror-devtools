import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { memo } from "react";

import { traceCommand } from "../../devtools/session";
import { NumberField } from "../../ui/fields";
import { nodeNames } from "../document";
import { formatDate, groupTimesheet, type TimesheetEntry } from "../model";
import { useInvoiceView } from "../view-context";
import { jsonAttribute } from "./attributes";
import { sameNodeAndSelection } from "./memo";

function TimesheetView({ node, editor, updateAttributes }: ReactNodeViewProps) {
  const { editable } = useInvoiceView();
  const entries = node.attrs.entries as readonly TimesheetEntry[];
  const groups = groupTimesheet(entries);
  const setHours = (index: number, hours: number) =>
    traceCommand(editor, "Edit timesheet hours", () =>
      updateAttributes({
        entries: entries.map((entry, at) => (at === index ? { ...entry, hours } : entry)),
      }),
    );
  return (
    <NodeViewWrapper className="timesheet" contentEditable={false}>
      {groups.map((group) => (
        <table key={group.project}>
          <caption>
            <span>{group.project}</span>
            <span>{group.hours} h</span>
          </caption>
          <tbody>
            {group.entries.map((entry) => {
              const index = entries.indexOf(entry);
              return (
                <tr key={index}>
                  <td>{formatDate(entry.date)}</td>
                  <td>{entry.person}</td>
                  <td>
                    <NumberField
                      label="Hours"
                      value={entry.hours}
                      step={0.5}
                      min={0}
                      disabled={!editable}
                      onCommit={(hours) => setHours(index, hours)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ))}
    </NodeViewWrapper>
  );
}

export const Timesheet = Node.create({
  name: nodeNames.timesheet,
  group: "section",
  atom: true,
  selectable: false,
  addAttributes: () => ({ entries: jsonAttribute<TimesheetEntry[]>("entries", []) }),
  parseHTML: () => [{ tag: "div[data-type=timesheet]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "timesheet" }),
  ],
  addNodeView: () => ReactNodeViewRenderer(memo(TimesheetView, sameNodeAndSelection)),
});
