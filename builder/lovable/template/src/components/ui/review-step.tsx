import { StepSummary, type StepAnswer } from "@/components/ui/step-summary";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * The last screen of a wizard: everything, checkable, before it is committed.
 *
 * IT BLOCKS ON MISSING REQUIRED ANSWERS AND SAYS WHICH. The failure this
 * prevents is specific: somebody skips an optional-looking step, reaches the
 * end, presses submit, and gets an error naming a field on a screen they can no
 * longer see. Listing the gaps here, each linked to its step, is the fix.
 *
 * THE SUBMIT BUTTON SAYS WHAT IT DOES — "Book and pay", "Send the application"
 * — never "Submit". This is the one irreversible press in the whole flow and
 * the label is the last thing read before it.
 *
 * EVERY STEP IS EDITABLE FROM HERE, through the same `StepSummary` used
 * mid-flow, so a correction is one click rather than a walk backwards.
 *
 * `role="alert"` on the blocking list, since it appears in response to somebody
 * arriving at the end expecting to finish.
 */
export type ReviewStepData = {
  id: string;
  title: string;
  answers: StepAnswer[];
  /** Labels of required answers still missing. */
  missing?: string[];
};

export function ReviewStep({ steps, onEdit, onSubmit, submitLabel, busy, note, className }: {
  steps: ReviewStepData[];
  onEdit?: (id: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  busy?: boolean;
  note?: React.ReactNode;
  className?: string;
}) {
  const gaps = steps.flatMap((s) => (s.missing ?? []).map((m) => ({ step: s, label: m })));
  return (
    <div className={cn("space-y-3", className)}>
      {gaps.length > 0 && (
        <div role="alert" className="rounded-md border border-foreground/40 bg-muted/40 px-3 py-2 text-sm">
          <p className="font-medium">
            {gaps.length === 1 ? "One answer is still needed" : `${gaps.length} answers are still needed`}
          </p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {gaps.map((g) => (
              <li key={`${g.step.id}-${g.label}`} className="flex gap-2">
                <span aria-hidden="true">·</span>
                <span>
                  {g.label}
                  {onEdit && (
                    <>
                      {" — "}
                      <button type="button" onClick={() => onEdit(g.step.id)} className="underline underline-offset-2">
                        go to {g.step.title}
                      </button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-2">
        {steps.map((s) => (
          <StepSummary key={s.id} title={s.title} answers={s.answers}
            onEdit={onEdit ? () => onEdit(s.id) : undefined} />
        ))}
      </div>
      {note && <div className="text-xs text-muted-foreground">{note}</div>}
      <Button type="button" onClick={onSubmit} disabled={busy || gaps.length > 0}>
        {busy ? "Sending…" : submitLabel}
      </Button>
    </div>
  );
}
