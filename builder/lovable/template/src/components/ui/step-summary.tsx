import { cn } from "@/lib/utils";
/**
 * What was entered on a finished step, collapsed to a line, with an edit link.
 *
 * IT PUTS THE ANSWERS BACK ON SCREEN. A wizard hides everything but the current
 * step, so by step 5 nobody remembers what they chose at step 2 — and the only
 * recourse is to navigate back, look, and navigate forward, losing their place.
 * A one-line recap per finished step removes that entirely.
 *
 * EDIT RETURNS TO THE STEP, it does not open a dialog. An inline editor here
 * duplicates the step's own form, and the two drift — the dialog validates
 * differently from the step, which is how an invalid answer gets past a wizard.
 *
 * SKIPPED AND EMPTY ARE DIFFERENT and both are stated. A blank recap line reads
 * as a rendering failure; "not answered" is a fact, and on an optional step it
 * is a perfectly good one.
 *
 * A `<dl>` per step so the field names are attached to their values — which is
 * what makes the recap readable rather than a run-on sentence of bare values.
 */
export type StepAnswer = { label: string; value?: string | null };

export function StepSummary({ title, answers, onEdit, editLabel = "Change", emptyNote = "not answered", className }: {
  title: string;
  answers: StepAnswer[];
  onEdit?: () => void;
  editLabel?: string;
  emptyNote?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border border-border px-3 py-2", className)}>
      <div className="flex items-baseline gap-3">
        <p className="min-w-0 flex-1 text-sm font-medium">{title}</p>
        {onEdit && (
          <button type="button" onClick={onEdit} className="shrink-0 text-xs underline underline-offset-2">
            {editLabel}
          </button>
        )}
      </div>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        {answers.map((a) => (
          <div key={a.label} className="contents">
            <dt className="text-muted-foreground">{a.label}</dt>
            <dd className={cn(!a.value && "italic text-muted-foreground")}>{a.value || emptyNote}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
