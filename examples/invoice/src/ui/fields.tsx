import { useState } from "react";

/**
 * Node views rerender after the transaction, so a controlled input bound straight to node attrs
 * would lose partial input such as "12." and move the caret. Keep a local draft and replace it
 * only when the document value changes to something the draft does not already represent.
 */
function useDraft(external: string, represents: (draft: string) => boolean) {
  const [draft, setDraft] = useState(external);
  const [seen, setSeen] = useState(external);
  if (external !== seen) {
    setSeen(external);
    if (!represents(draft)) setDraft(external);
  }
  return [draft, setDraft] as const;
}

interface NumberFieldProps {
  readonly label: string;
  readonly value: number;
  readonly disabled: boolean;
  readonly onCommit: (value: number) => void;
  /** Stored units per displayed unit, e.g. 100 for cents shown as currency. */
  readonly scale?: number;
  readonly step?: number;
  readonly min?: number;
  readonly max?: number;
  readonly className?: string;
}

export function NumberField({
  label,
  value,
  disabled,
  onCommit,
  scale = 1,
  step = 1,
  min,
  max,
  className,
}: NumberFieldProps) {
  const toStored = (draft: string): number | null => {
    if (draft.trim() === "") return null;
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) return null;
    return scale === 1 ? parsed : Math.round(parsed * scale);
  };
  const shown = scale === 1 ? String(value) : (value / scale).toFixed(Math.log10(scale));
  const [draft, setDraft] = useDraft(shown, (current) => toStored(current) === value);
  return (
    <input
      type="number"
      aria-label={label}
      className={className}
      value={draft}
      step={step}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(event) => {
        setDraft(event.target.value);
        const next = toStored(event.target.value);
        if (next !== null && next !== value) onCommit(next);
      }}
    />
  );
}

interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly disabled: boolean;
  readonly onCommit: (value: string) => void;
  readonly type?: "text" | "date";
}

export function TextField({ label, value, disabled, onCommit, type = "text" }: TextFieldProps) {
  const [draft, setDraft] = useDraft(value, (current) => current === value);
  return (
    <input
      type={type}
      aria-label={label}
      value={draft}
      disabled={disabled}
      onChange={(event) => {
        setDraft(event.target.value);
        if (event.target.value !== value) onCommit(event.target.value);
      }}
    />
  );
}
