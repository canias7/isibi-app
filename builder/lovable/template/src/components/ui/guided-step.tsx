import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * One step of a walkthrough, with a way out at every step.
 *
 * "SKIP THE TOUR" IS ON EVERY STEP, not just the first. Somebody who accepted a
 * tour and has seen enough by step two should not have to reach step six to
 * escape — and a tour that traps people is remembered as the product being
 * annoying.
 *
 * BACK IS OFFERED FROM STEP TWO ONWARDS. A walkthrough that only goes forwards
 * makes a misread step unrecoverable, and people re-run the whole tour to see
 * one screen again.
 *
 * `role="dialog"` with a label and no focus trap: the reader usually has to
 * interact with the page the step is describing, and trapping focus makes the
 * instruction impossible to follow.
 */
export function GuidedStep({ title, body, step, of, onNext, onBack, onSkip, nextLabel, className }: {
  title: string; body?: React.ReactNode;
  step: number; of: number;
  onNext?: () => void; onBack?: () => void; onSkip?: () => void;
  nextLabel?: string;
  className?: string;
}) {
  const last = step >= of;
  return (
    <section data-slot="guided-step" role="dialog" aria-label={`${title} — step ${step} of ${of}`}
      className={cn("flex max-w-sm flex-col gap-3 rounded-md border border-border bg-popover p-4 shadow-xs", className)}>
      <div>
        <p className="text-xs text-muted-foreground tabular-nums">Step {step} of {of}</p>
        <h2 className="text-sm font-semibold">{title}</h2>
        {body && <div className="mt-1 text-sm text-muted-foreground">{body}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onNext && <Button size="sm" onClick={onNext}>{nextLabel ?? (last ? "Finish" : "Next")}</Button>}
        {onBack && step > 1 && <Button size="sm" variant="outline" onClick={onBack}>Back</Button>}
        {onSkip && (
          <button type="button" onClick={onSkip}
            className="ms-auto cursor-pointer text-xs text-muted-foreground underline underline-offset-4">Skip the tour</button>
        )}
      </div>
    </section>
  );
}
