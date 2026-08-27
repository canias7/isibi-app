import * as React from "react";
import { BusyButton } from "@/components/ui/busy-button";
import { cn } from "@/lib/utils";
/**
 * The box you type an instruction into.
 *
 * ENTER SENDS, SHIFT-ENTER MAKES A NEW LINE, and the hint says so. Every product
 * picks one convention and half of them tell nobody, which is why people either
 * send half a sentence or type three paragraphs into one line.
 *
 * IT DOES NOT SEND AN EMPTY PROMPT, and the button is disabled rather than
 * erroring — a request that costs money should not be fireable by a stray press.
 *
 * `examples` are one press each, because the hardest part of a blank prompt box
 * is knowing what it will accept. A field with no examples gets "help" typed
 * into it.
 */
export function PromptField({ value, onChange, onSend, placeholder = "What would you like?", examples, busy, id, className }: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder?: string;
  examples?: string[];
  busy?: boolean;
  id?: string;
  className?: string;
}) {
  const auto = React.useId();
  const fieldId = id ?? auto;
  const empty = !value.trim();
  return (
    <div data-slot="prompt-field" className={cn("flex flex-col gap-2", className)}>
      {examples?.length ? (
        <div className="flex flex-wrap gap-1">
          {examples.map((e) => (
            <button key={e} type="button" onClick={() => onChange(e)}
              className="cursor-pointer rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">
              {e}
            </button>
          ))}
        </div>
      ) : null}
      <label htmlFor={fieldId} className="sr-only">{placeholder}</label>
      <textarea id={fieldId} rows={3} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!empty && !busy) onSend(); }
        }}
        aria-describedby={`${fieldId}-hint`}
        className="rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground">
          Enter sends · Shift and Enter for a new line
        </p>
        <BusyButton size="sm" busy={busy} disabled={empty} onClick={onSend}>Send</BusyButton>
      </div>
    </div>
  );
}
