import { cn } from "@/lib/utils";
/**
 * The way past a step that is not required yet.
 *
 * IT SAYS WHERE THE STEP GOES, which is what makes skipping safe to offer.
 * "You can add this later in Settings" turns an abandoned step into a deferred
 * one; without it people either complete something they do not need or leave and
 * never return to it.
 *
 * DELIBERATELY UNDERSTATED. A skip styled as a button competes with the action
 * it sits beside and gets pressed by people who meant to continue — it is a text
 * link on purpose.
 *
 * A real `<button>` rather than a styled span, so it is reachable by keyboard
 * like any other control on the step.
 */
export function SkipForNow({ onSkip, where, label = "Skip for now", className }: {
  onSkip: () => void;
  /** Where it can be done later — "Settings → Payments". */
  where?: string;
  label?: string;
  className?: string;
}) {
  return (
    <span data-slot="skip-for-now" className={cn("inline-flex flex-wrap items-baseline gap-x-2 text-sm", className)}>
      <button type="button" onClick={onSkip}
        className="cursor-pointer text-muted-foreground underline underline-offset-4">{label}</button>
      {where && <span className="text-xs text-muted-foreground">You can add it later in {where}.</span>}
    </span>
  );
}
