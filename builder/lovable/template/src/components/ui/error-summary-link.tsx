import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The error box at the top of a form — every error a LINK to its field.
 *
 * CLICKING AN ERROR FOCUSES THE FIELD (by id), which is the entire value:
 * a summary that only lists what is wrong leaves the person scrolling a
 * long form hunting for the red bits. The GOV.UK pattern, because they
 * measured it.
 *
 * IT APPEARS ON SUBMIT AND TAKES FOCUS ITSELF (tabIndex -1 + focus()) so
 * a screen reader reads the whole situation once, from the top — not
 * per-keystroke, which is the difference between a summary and a nag.
 * `role="alert"` on mount for the same reason.
 *
 * THE COUNT IS IN THE HEADING ("2 things need fixing") — the person
 * needs the size of the job before the list of it.
 */
export function ErrorSummaryLink({ errors, className }: {
  errors: { fieldId: string; message: React.ReactNode }[];
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (errors.length) ref.current?.focus(); }, [errors.length]);
  if (!errors.length) return null;
  return (
    <div data-slot="error-summary-link" ref={ref} role="alert" tabIndex={-1}
      className={cn("rounded-lg border-2 border-foreground p-3 outline-none", className)}>
      <p className="text-sm font-semibold">
        {errors.length === 1 ? "One thing needs fixing" : `${errors.length} things need fixing`}
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {errors.map((e) => (
          <li key={e.fieldId}>
            <a href={`#${e.fieldId}`}
              onClick={(ev) => {
                ev.preventDefault();
                const el = document.getElementById(e.fieldId);
                el?.scrollIntoView({ block: "center" });
                el?.focus();
              }}
              className="cursor-pointer text-sm underline underline-offset-2">
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
