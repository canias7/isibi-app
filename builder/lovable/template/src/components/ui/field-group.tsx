import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A titled section of a form — "Your details", "When", "Payment".
 *
 * `<fieldset>` and `<legend>`, which is what actually associates the heading
 * with the controls: a screen reader announces "Payment, edit, card number"
 * rather than leaving somebody to work out from the reading order which section
 * a field belongs to. A styled `<div>` with an `<h3>` looks identical and
 * carries none of that.
 *
 * `min-w-0` is on the fieldset, and it is not cosmetic. A fieldset defaults to
 * `min-width: min-content`, which is why one inside a flex or grid container
 * refuses to shrink and pushes the layout wider than its parent — the exact bug
 * `scale-input` was fixed for, and it is a property of the element rather than
 * of anything the caller did.
 *
 * `optional` marks a whole section rather than each field. Six fields each
 * saying "(optional)" is noise; the section saying it once is the same
 * information.
 */
export function FieldGroup({
  legend, hint, optional, children, columns = 1, className,
}: {
  legend?: React.ReactNode;
  hint?: React.ReactNode;
  optional?: boolean;
  children: React.ReactNode;
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <fieldset className={cn("w-full min-w-0 border-0 p-0", className)}>
      {legend ? (
        <legend className="mb-1 flex items-baseline gap-2 p-0 text-sm font-semibold">
          {legend}
          {optional ? <span className="text-xs font-normal text-muted-foreground">Optional</span> : null}
        </legend>
      ) : null}
      {hint ? <p className="mb-3 text-xs text-muted-foreground">{hint}</p> : null}
      <div className={cn("grid gap-3", columns === 2 && "sm:grid-cols-2")}>{children}</div>
    </fieldset>
  );
}
