import * as React from "react";
import { Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "We filled this in from your last booking" — with a way to undo it.
 *
 * A pre-filled field with no explanation is indistinguishable from something
 * the person typed and forgot, so it gets submitted unread. That is how a
 * repeat customer's booking silently keeps last month's barber, and it is worse
 * with anything derived — a total, a delivery date, a tax rate.
 *
 * The UNDO clears back to empty rather than to a previous value: the state
 * before autofill was blank, and pretending otherwise means "undo" leaves
 * something behind that the person did not choose either.
 *
 * It is a `<p>` tied to the field with `aria-describedby`, not a tooltip. A
 * tooltip is invisible on a phone and unreachable by keyboard, and this is
 * information the person needs BEFORE they interact, which is exactly what a
 * hover surface cannot deliver.
 */
export function AutofillNote({ source, onUndo, id, children, className }: {
  source: React.ReactNode;
  onUndo?: () => void;
  id?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <p data-slot="autofill-note" id={id} className={cn("flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span>{children ?? <>Filled in from {source}.</>}</span>
      {onUndo ? (
        <button type="button" onClick={onUndo}
          className="inline-flex cursor-pointer items-center gap-1 underline underline-offset-2 hover:text-foreground">
          <Undo2 aria-hidden className="size-3" />
          Clear it
        </button>
      ) : null}
    </p>
  );
}
