import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Empty the whole form — behind one confirmation.
 *
 * NEVER A BARE RESET BUTTON NEXT TO SUBMIT. The native `<input type="reset">` is
 * the most notorious control in HTML for exactly this: it sits beside submit,
 * looks the same, and silently destroys ten minutes of typing with no undo. This
 * asks first.
 *
 * IT SAYS HOW MUCH WILL GO, because "clear the form" on a form with two fields
 * filled and one with twenty are very different actions and the reader is the
 * only one who knows which they meant.
 *
 * Renders nothing when the form is empty — a clear button on a blank form is a
 * control that cannot do anything.
 */
export function ClearForm({ filledCount, onClear, label = "Clear the form", className }: {
  /** How many fields have something in them. */
  filledCount: number;
  onClear: () => void;
  label?: string;
  className?: string;
}) {
  const [asking, setAsking] = React.useState(false);
  if (filledCount <= 0) return null;
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)}
        className={cn("cursor-pointer text-sm text-muted-foreground underline underline-offset-4", className)}>
        {label}
      </button>
    );
  }
  return (
    <div role="alertdialog" aria-label={label}
      className={cn("flex flex-wrap items-center gap-2 text-sm", className)}>
      <span className="tabular-nums">
        Clear {filledCount} {filledCount === 1 ? "answer" : "answers"}?
      </span>
      <Button size="sm" variant="outline" onClick={() => setAsking(false)}>Keep them</Button>
      <Button size="sm" onClick={() => { setAsking(false); onClear(); }}>Clear</Button>
    </div>
  );
}
