import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The expected format, shown BEFORE anything goes wrong.
 *
 * A HINT IS NOT A PLACEHOLDER. Placeholder text vanishes on the first
 * keystroke — exactly when the person is trying to match it — and its
 * grey-in-the-box look reads as a filled field from a distance (the
 * age-gate lesson). The hint lives UNDER the field, visible the whole
 * time, tied by `aria-describedby` so it is announced with the label.
 *
 * WITH AN EXAMPLE, NOT A SCHEMA. "DD/MM/YYYY" still needs decoding;
 * "like 31/12/2026" is the same fact pre-decoded. Both render when both
 * are given — the pattern for people who think in patterns, the example
 * for everyone.
 *
 * Errors-after-the-fact are the alternative this replaces: a format the
 * form KNEW and only revealed as a rejection was a quiz, not a form.
 */
export function FormatHint({ id, pattern, example, className }: {
  id?: string;
  pattern?: React.ReactNode;
  example?: React.ReactNode;
  className?: string;
}) {
  if (!pattern && !example) return null;
  return (
    <p data-slot="format-hint" id={id} className={cn("text-xs text-muted-foreground", className)}>
      {pattern ? <span className="font-mono">{pattern}</span> : null}
      {pattern && example ? " — " : null}
      {example ? <>like <span className="font-mono">{example}</span></> : null}
    </p>
  );
}
