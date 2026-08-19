import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Everything wrong with the form, in one place, each one a link to the field.
 *
 * THE STANDARD PATTERN FOR AN ACCESSIBLE FORM, and the one hand-written forms
 * always skip. A long form with three errors scattered down it is unnavigable
 * for anybody not scanning visually — the summary at the top is how a screen
 * reader user finds out what happened at all.
 *
 * IT TAKES FOCUS WHEN IT APPEARS. Announcing into a live region is not enough:
 * the reader needs to be AT the list, and a summary that renders silently above
 * the fold is one nobody reaches.
 *
 * EACH ENTRY IS A REAL ANCHOR to the field's id, so following it moves focus to
 * the input rather than merely scrolling it into view.
 */
export function ValidationSummary({ errors, title, className }: {
  /** One per bad field, in the order they appear in the form. */
  errors: { fieldId: string; label: string; message: string }[];
  title?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (errors.length) ref.current?.focus(); }, [errors.length]);
  if (!errors.length) return null;
  return (
    <div ref={ref} tabIndex={-1} role="alert"
      className={cn("rounded-md border border-border p-4 outline-none", className)}>
      <p className="text-sm font-medium">
        {title ?? `${errors.length} ${errors.length === 1 ? "thing needs" : "things need"} fixing`}
      </p>
      <ul className="mt-1 flex list-disc flex-col gap-0.5 ps-5 text-sm">
        {errors.map((e) => (
          <li key={e.fieldId}>
            <a href={`#${e.fieldId}`} className="underline underline-offset-4">
              {e.label}
            </a>
            <span className="text-muted-foreground"> — {e.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
