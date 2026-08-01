import { cn } from "@/lib/utils";
/**
 * "We skipped this because you said you have no vehicle" — why a step vanished.
 *
 * A STEP DISAPPEARING WITHOUT EXPLANATION IS ALARMING. Somebody who was told
 * there were six steps and sees the count drop to four assumes the form is
 * broken, or that they have missed something — and on a form that matters, an
 * application or a claim, that is enough to make them start over.
 *
 * THE REASON NAMES THE ANSWER THAT CAUSED IT. "Not needed" says nothing;
 * "because you said you have no vehicle" is checkable, and if the answer was
 * wrong this is where somebody notices.
 *
 * IT OFFERS TO GO BACK TO THE ANSWER, not to the skipped step. Reopening a step
 * whose prerequisites are unmet produces a form that cannot be submitted; the
 * fix is always at the answer that caused it.
 *
 * IT SITS IN THE FLOW, in the position the step would have had, so the sequence
 * still makes sense to somebody reading the recap afterwards.
 */
export function StepSkipped({ title, because, onChangeAnswer, changeLabel = "Change that answer", className }: {
  title: string;
  /** "you said you have no vehicle". */
  because: string;
  onChangeAnswer?: () => void;
  changeLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border border-dashed border-border px-3 py-2", className)}>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{title}</span> was skipped because {because}.
      </p>
      {onChangeAnswer && (
        <button type="button" onClick={onChangeAnswer} className="mt-0.5 text-xs underline underline-offset-2">
          {changeLabel}
        </button>
      )}
    </div>
  );
}
