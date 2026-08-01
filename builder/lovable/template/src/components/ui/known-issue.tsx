import { cn } from "@/lib/utils";
/**
 * "Yes, we know." Shown at the point of failure.
 *
 * SAYING IT WHERE IT BREAKS is the entire value. A status page nobody visits
 * does not stop the ticket; a line on the broken screen does, and it turns "this
 * site is broken" into "they are on it".
 *
 * THE WORKAROUND OUTRANKS THE APOLOGY. If there is another way to do the thing,
 * that is what the reader wants — and it is the part most incident notices leave
 * out entirely.
 *
 * `since` and `updated` are both offered: an issue opened three hours ago with
 * no update in three hours reads very differently from one updated ten minutes
 * ago, and readers are good at telling the difference.
 */
export function KnownIssue({ what, workaround, since, updated, href, className }: {
  what: string;
  /** Another way to get it done. */
  workaround?: string;
  since?: string; updated?: string; href?: string;
  className?: string;
}) {
  return (
    <div role="status" className={cn("flex flex-col gap-1 rounded-md border border-border p-3 text-sm", className)}>
      <p><span className="font-medium">Known issue</span> — {what}</p>
      {workaround && <p>{workaround}</p>}
      <p className="text-xs text-muted-foreground">
        {[since && `Since ${since}`, updated && `updated ${updated}`].filter(Boolean).join(" · ")}
        {href && <> · <a href={href} className="underline underline-offset-2">Follow it</a></>}
      </p>
    </div>
  );
}
