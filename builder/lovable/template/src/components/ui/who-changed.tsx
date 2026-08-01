import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * The one-line attribution that sits under a record.
 *
 * "Edited by Sam, Tuesday at 14:20" — the smallest possible answer to the
 * question people ask about any shared record, which is who touched this last.
 *
 * THE VERB IS THE CALLER'S. Created, edited, approved and cancelled all fit
 * this shape and mean entirely different things, and a component that
 * hard-codes "edited" quietly mislabels three of them.
 *
 * The timestamp is a real `<time datetime>` beside human phrasing, so this
 * survives being read in another timezone six months later — which is when an
 * attribution line is most likely to matter.
 *
 * No avatar. A 20px circle next to a name that is already written out adds a
 * network request and a layout shift for no information, and a record footer
 * is the last place worth spending either.
 */
export function WhoChanged({ by, at, action = "Edited", className }: {
  by: string;
  at: string | number | Date;
  /** The verb — Created, Edited, Approved, Cancelled. */
  action?: string;
  className?: string;
}) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {action} by <span className="font-medium text-foreground">{by}</span>
      {" · "}
      <time dateTime={new Date(at).toISOString()}><DateFormat date={at} withTime /></time>
    </p>
  );
}
