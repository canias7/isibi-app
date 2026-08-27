import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The technical half of an error, folded away.
 *
 * TWO AUDIENCES, ONE ERROR. The person who needs "we couldn't reach the payment
 * provider" and the person who needs the stack trace are rarely the same, and
 * showing both at once fails the first while showing only the friendly one
 * strands the second.
 *
 * COLLAPSED BY DEFAULT, always. An error screen that opens with a wall of
 * monospace reads as catastrophic even when the failure is trivial.
 *
 * The detail is selectable and in a `<pre>`, because the single most common
 * thing done with it is copying it into a support message — and text that has
 * been reflowed or truncated for looks is useless there.
 */
export function ErrorDetailToggle({ detail, label = "Technical detail", className }: {
  detail: string; label?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  if (!detail) return null;
  return (
    <div data-slot="error-detail-toggle" className={cn("flex flex-col items-start gap-1", className)}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}
        className="cursor-pointer text-xs underline underline-offset-4">
        {open ? `Hide ${label.toLowerCase()}` : label}
      </button>
      {open && (
        <pre id={id} className="max-w-full overflow-x-auto rounded border border-border bg-muted/40 p-2 font-mono text-xs whitespace-pre-wrap">
          {detail}
        </pre>
      )}
    </div>
  );
}
