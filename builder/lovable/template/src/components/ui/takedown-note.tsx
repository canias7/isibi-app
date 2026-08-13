import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * Something was removed, and the space says so.
 *
 * A GAP WITH NO EXPLANATION IS WORSE THAN THE REMOVAL. A comment thread that
 * silently loses a message reads as broken, and the people who saw it before
 * assume censorship rather than a rule. A tombstone is the honest form.
 *
 * IT NAMES THE RULE, NOT THE REPORTER. Naming who reported something is how
 * retaliation happens, and it is never necessary to explain the decision.
 *
 * THE APPEAL ROUTE IS ON THE TOMBSTONE, because this is where the affected
 * person looks — putting it in an email they may not have received is how
 * appeals go unmade.
 */
export function TakedownNote({ what = "This", rule, at, appealHref, byAuthor, className }: {
  what?: string;
  /** The rule broken. */
  rule?: string;
  at?: string | number | Date;
  appealHref?: string;
  /** True when the author removed it themselves. */
  byAuthor?: boolean;
  className?: string;
}) {
  return (
    <p className={cn("rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground", className)}>
      <span className="font-medium text-foreground">
        {what} {byAuthor ? "was removed by its author" : "was removed"}
      </span>
      {!byAuthor && rule ? ` under ${rule}` : ""}
      {at && (
        <> · <DateFormat date={at} /></>
      )}
      {appealHref && !byAuthor && (
        <> · <a href={appealHref} className="underline underline-offset-2">Appeal this</a></>
      )}
    </p>
  );
}
