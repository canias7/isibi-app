import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Pushing one change onto a set of things, with the damage stated first.
 *
 * IT SEPARATES WHAT WILL BE OVERWRITTEN from what will merely be set. Applying
 * a template to forty records is the operation people most regret, and the
 * regret is always the same shape: some of those records had values somebody
 * had customised. The count of those is the number that decides the answer, so
 * it is the number on screen.
 *
 * SKIP-CUSTOMISED IS OFFERED AS A CHOICE, not assumed either way. Both
 * intentions are legitimate — "bring the stragglers into line" and "leave
 * anything anybody has touched" — and guessing produces a silent wrong answer
 * at scale.
 *
 * THE COUNT IS SPELLED OUT ON THE BUTTON. "Apply to 38 records" is checkable
 * against what somebody meant to select; "Apply" is not, and the selection is
 * usually off-screen by the time they press it.
 *
 * NO CONFIRM DIALOG, because the whole panel already IS the confirmation —
 * stacking one on top trains people to dismiss both.
 */
export function ApplyToMany({ total, customised, onApply, onCancel, busy, noun = "records", className }: {
  /** How many are selected. */
  total: number;
  /** How many of them have their own values that would be overwritten. */
  customised: number;
  onApply: (v: { skipCustomised: boolean }) => void;
  onCancel?: () => void;
  busy?: boolean;
  noun?: string;
  className?: string;
}) {
  const [skip, setSkip] = useState(customised > 0);
  const affected = skip ? total - customised : total;
  return (
    <div data-slot="apply-to-many" className={cn("space-y-3 rounded-lg border border-border p-4", className)}>
      <p className="text-sm">
        <span className="font-medium tabular-nums">{total.toLocaleString()}</span> {noun} selected.
        {customised > 0 && (
          <span className="block text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">{customised.toLocaleString()}</span> of them have their own values.
          </span>
        )}
      </p>
      {customised > 0 && (
        <fieldset className="space-y-1.5 text-sm">
          <legend className="sr-only">What to do with customised {noun}</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="atm" checked={skip} onChange={() => setSkip(true)} className="size-4 accent-foreground" />
            Leave them alone
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="atm" checked={!skip} onChange={() => setSkip(false)} className="size-4 accent-foreground" />
            Overwrite them too
          </label>
        </fieldset>
      )}
      <div className="flex gap-2">
        <Button type="button" disabled={busy || affected === 0} onClick={() => onApply({ skipCustomised: skip })}>
          {affected === 0 ? `Nothing to change` : `Apply to ${affected.toLocaleString()} ${noun}`}
        </Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>}
      </div>
    </div>
  );
}
