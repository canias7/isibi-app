import { useId } from "react";
import { cn } from "@/lib/utils";
/**
 * Turning name-blind screening on — and saying exactly what it hides.
 *
 * IT ENUMERATES WHAT IS HIDDEN AND WHAT IS NOT. Name-blind screening that
 * leaves a university, a home postcode or an email address visible removes
 * almost none of the signal it claims to, and the reassuring toggle is worse
 * than no toggle because it stops anybody looking further.
 *
 * IT SAYS WHEN THE NAMES COME BACK. Anonymity that ends at shortlisting is
 * still worth having and is a different claim from anonymity through to offer.
 * Not saying is how it is quietly assumed to be the stronger one.
 *
 * TURNING IT OFF IS RECORDED. A control anybody can silently disable is not a
 * control, and the log is what makes it real rather than decorative.
 *
 * IT IS A REAL CHECKBOX WITH A REAL LABEL, not a styled div — this ends up in
 * an accessibility audit, and a fake switch is the classic finding.
 */
export function AnonymisedToggle({ on, onChange, hides = [], doesNotHide = [], revealedAt, lastChangedBy, className }: {
  on: boolean;
  onChange?: (next: boolean) => void;
  /** What is actually removed. */
  hides?: string[];
  /** What remains visible — the honest half. */
  doesNotHide?: string[];
  /** When names return — "at shortlisting". */
  revealedAt?: string;
  /** Who last turned it off, which is what makes it a control. */
  lastChangedBy?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
        <input
          id={id}
          type="checkbox"
          checked={on}
          onChange={(e) => onChange?.(e.target.checked)}
          className="size-4"
        />
        <span>Hide identifying details while screening</span>
      </label>
      {hides.length > 0 && (
        <p className="text-xs text-muted-foreground">Hides {hides.join(", ")}.</p>
      )}
      {doesNotHide.length > 0 && (
        <p className="text-xs font-medium">
          Still visible: {doesNotHide.join(", ")}. Those carry much of the same signal.
        </p>
      )}
      {revealedAt && <p className="text-xs text-muted-foreground">Names return {revealedAt}.</p>}
      {lastChangedBy && (
        <p className="text-xs text-muted-foreground">Last changed by {lastChangedBy} — changes are recorded.</p>
      )}
    </div>
  );
}
