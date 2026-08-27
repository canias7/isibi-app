import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A free-text survey question.
 *
 * NO MINIMUM LENGTH, EVER. "Please write at least 20 characters" fabricates
 * padding, not opinion — the person with a four-word answer has a four-word
 * answer, and it is usually the useful kind. The cap exists (with a counter
 * only near the limit, like appeal-form) because storage and readers are
 * finite; the floor does not.
 *
 * OPTIONAL BY DEFAULT, with the skip visible next to the box. Free text is
 * the highest-effort question type; demanding it converts closers into
 * abandoners.
 *
 * The question is the LABEL, tied to the textarea by id — not a placeholder
 * that vanishes on the first keystroke.
 */
export function OpenQuestion({ question, hint, value, onChange, onSkip, maxLength = 1000, placeholder, className }: {
  question: React.ReactNode;
  hint?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  onSkip?: () => void;
  maxLength?: number;
  placeholder?: string;
  className?: string;
}) {
  const id = React.useId();
  const left = maxLength - value.length;
  return (
    <div data-slot="open-question" className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">{question}</label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <textarea id={id} value={value} onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        rows={3} placeholder={placeholder}
        className="w-full resize-y rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <div className="flex items-center justify-between">
        {onSkip ? (
          <button type="button" onClick={onSkip}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2">
            Nothing to add
          </button>
        ) : <span />}
        {left < 100 ? <span className="text-[11px] tabular-nums text-muted-foreground">{left} left</span> : null}
      </div>
    </div>
  );
}
