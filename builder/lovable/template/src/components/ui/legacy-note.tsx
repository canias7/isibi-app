import { cn } from "@/lib/utils";
/**
 * "This is the old system" — a read-only remnant, labelled as one.
 *
 * PEOPLE KEEP USING THE OLD ONE BECAUSE NOTHING SAYS NOT TO. After a migration
 * the previous system usually stays reachable — bookmarked, linked from an old
 * email — and somebody enters a week of work into it before anybody notices.
 * The label plus the link to the new place is the whole fix.
 *
 * IT SAYS WHETHER WRITING STILL WORKS. Read-only is safe; still-writable is the
 * dangerous case and the one that needs the loudest sentence, because the data
 * is going somewhere nobody looks.
 *
 * IT NAMES WHEN THIS GOES AWAY. A legacy system with no stated end date is one
 * that survives for years, and people plan around whichever assumption suits
 * them.
 *
 * IT LINKS TO THE EQUIVALENT PLACE, not to the new system's home page.
 * Somebody looking at an old booking wants the same booking in the new system,
 * and a link to a dashboard makes them search for it.
 */
export function LegacyNote({ writable, newPlaceUrl, newPlaceLabel = "the new system", retiresOn, whyKept, className }: {
  /** True when changes here still save — the dangerous case. */
  writable?: boolean;
  /** Link to the equivalent thing in the new system. */
  newPlaceUrl?: string;
  newPlaceLabel?: string;
  /** Free text — "1 December". */
  retiresOn?: string;
  /** Why it is still here — "so you can look up old invoices". */
  whyKept?: string;
  className?: string;
}) {
  return (
    <div role="note"
      className={cn("space-y-0.5 rounded-md border px-3 py-2 text-sm",
        writable ? "border-foreground/40 bg-muted/40" : "border-border", className)}>
      <p className={cn(writable && "font-medium")}>
        This is the old system.
        {writable
          ? " Changes here still save — and nobody is looking at them."
          : " You can read it, but nothing here can be changed."}
      </p>
      <p className="text-xs text-muted-foreground">
        {whyKept && <span>{whyKept}. </span>}
        {retiresOn ? <span>It goes away on {retiresOn}.</span> : <span>No date has been set for switching it off.</span>}
      </p>
      {newPlaceUrl && (
        <p className="text-xs">
          <a href={newPlaceUrl} className="underline underline-offset-2">Go to this in {newPlaceLabel}</a>
        </p>
      )}
    </div>
  );
}
