import { cn } from "@/lib/utils";
/**
 * What is stopping this step from being finished, listed and linked.
 *
 * IT LINKS EACH PROBLEM TO ITS FIELD. A summary that merely lists errors makes
 * somebody hunt for the field on a long step; an anchor to the input's own id
 * moves focus there, which is the difference between a usable error summary and
 * a decorative one.
 *
 * IT DISTINGUISHES BLOCKING FROM WORTH-CHECKING. "This must be filled in" and
 * "that postcode looks unusual" are different claims, and treating a warning as
 * an error stops somebody submitting a perfectly correct address the validator
 * did not recognise.
 *
 * `tabIndex={-1}` AND A FOCUSABLE CONTAINER, so the caller can move focus here
 * after a failed Next — which is what a screen reader user needs, since
 * `role="alert"` alone announces the text but leaves the cursor on a button
 * that did nothing.
 *
 * IT RENDERS NOTHING WHEN CLEAN. A permanently present validation panel is one
 * people stop reading before the day it matters.
 */
export type StepProblem = { fieldId?: string; message: string; warning?: boolean };

export function StepValidation({ problems, className }: {
  problems: StepProblem[];
  className?: string;
}) {
  if (!problems.length) return null;
  const blocking = problems.filter((p) => !p.warning);
  const warnings = problems.filter((p) => p.warning);
  return (
    <div data-slot="step-validation" tabIndex={-1} role="alert"
      className={cn("space-y-2 rounded-md border border-foreground/40 bg-muted/40 px-3 py-2 text-sm", className)}>
      {blocking.length > 0 && (
        <div>
          <p className="font-medium">
            {blocking.length === 1 ? "One thing needs fixing" : `${blocking.length} things need fixing`}
          </p>
          <ul className="mt-0.5 space-y-0.5 text-xs">
            {blocking.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true">·</span>
                {p.fieldId
                  ? <a href={`#${p.fieldId}`} className="underline underline-offset-2">{p.message}</a>
                  : <span>{p.message}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div>
          <p className="text-xs font-medium">Worth checking</p>
          <ul className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
            {warnings.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true">·</span>
                {p.fieldId
                  ? <a href={`#${p.fieldId}`} className="underline underline-offset-2">{p.message}</a>
                  : <span>{p.message}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
