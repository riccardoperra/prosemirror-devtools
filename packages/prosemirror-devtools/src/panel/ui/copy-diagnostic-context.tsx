import { createSignal, Show, type JSX } from "solid-js";

import { panelStyles } from "../styles";

export function CopyDiagnosticContext(props: {
  read: () => string;
  ownerDocument: Document;
}): JSX.Element {
  const [text, setText] = createSignal<string>();
  const [status, setStatus] = createSignal("");
  let output: HTMLTextAreaElement | undefined;
  const copy = async (): Promise<void> => {
    try {
      const value = props.read();
      setText(value);
      const clipboard = props.ownerDocument.defaultView?.navigator.clipboard;
      if (!clipboard) throw new Error("Clipboard unavailable");
      await clipboard.writeText(value);
      setStatus("Diagnostic context copied.");
    } catch {
      setStatus("Copy the diagnostic context from the text field.");
      output?.focus();
      output?.select();
    }
  };

  return (
    <>
      <button type="button" class={panelStyles.pmButton} onClick={() => void copy()}>
        Copy diagnostic context
      </button>
      <Show when={text()}>
        <details class={panelStyles.pmDiagnosticContext} open>
          <summary>Diagnostic context</summary>
          <textarea
            aria-label="Diagnostic context JSON"
            readOnly
            value={text()}
            ref={(element) => {
              output = element;
            }}
            class={panelStyles.pmDiagnosticContextText}
          />
          <p role="status">{status()}</p>
        </details>
      </Show>
    </>
  );
}
