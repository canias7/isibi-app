import { cn } from "@/lib/utils";
/**
 * "Showing the first 500 of 12,400" — the list is capped, said out loud.
 *
 * A SILENTLY TRUNCATED LIST IS THE WORST KIND OF WRONG ANSWER. Somebody
 * searches, scrolls to the bottom, sees no more results and concludes the thing
 * they wanted does not exist — when in fact the query returned a cap. Every
 * list with a server-side limit needs this line and nearly none have it.
 *
 * IT SAYS WHAT TO DO ABOUT IT, because "showing 500 of 12,400" with no next
 * step is merely a complaint. Narrowing the search is almost always the real
 * answer, so that is the default sentence.
 *
 * IT RENDERS NOTHING WHEN THE LIST IS COMPLETE. A permanent "showing 12 of 12"
 * is noise that trains people to skip the row, which is precisely the row they
 * must not skip on the day it is truncated.
 *
 * `role="status"`, so somebody who cannot see the list end learns the result is
 * partial — the group most likely to miss a truncation entirely.
 */
export function PartialListNote({ shown, total, advice = "Narrow your search to see the rest.", action, className }: {
  shown: number;
  /** The real number of matches. */
  total: number;
  advice?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  if (!(total > shown)) return null;
  return (
    <p role="status" className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground", className)}>
      <span>
        Showing the first <span className="font-medium tabular-nums text-foreground">{shown.toLocaleString()}</span>
        {" of "}
        <span className="font-medium tabular-nums text-foreground">{total.toLocaleString()}</span>
      </span>
      <span>{advice}</span>
      {action}
    </p>
  );
}
