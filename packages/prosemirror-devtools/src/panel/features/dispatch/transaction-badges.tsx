import { Show, type JSX } from "solid-js";

import type { TransactionRecord } from "../../../core/types";
import { Badge } from "../../ui/badge";

export function TransactionBadges(props: { record: TransactionRecord }): JSX.Element {
  return (
    <>
      <Show when={props.record.docChanged}>
        <Badge tone="green">doc</Badge>
      </Show>
      <Show when={props.record.selectionSet}>
        <Badge tone="blue">selection</Badge>
      </Show>
      <Show
        when={
          props.record.appendedTransactionCount != null && props.record.appendedTransactionCount > 0
        }
      >
        <Badge tone="yellow">+{props.record.appendedTransactionCount}</Badge>
      </Show>
      <Show when={props.record.filtered}>
        <Badge tone="red">filtered</Badge>
      </Show>
      <Show when={props.record.applicationStatus === "unknown"}>
        <Badge tone="yellow">custom</Badge>
      </Show>
      <Show when={props.record.error}>
        <Badge tone="red">error</Badge>
      </Show>
    </>
  );
}
