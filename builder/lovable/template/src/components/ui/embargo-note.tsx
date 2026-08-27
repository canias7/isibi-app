import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * Written, approved, and not to be shown until a date.
 *
 * DIFFERENT FROM "SCHEDULED". A scheduled item is waiting to publish itself; an
 * embargoed one is already visible to a chosen few and must not go further. The
 * two look identical on a dashboard and have opposite failure modes, which is
 * why this says which it is.
 *
 * THE TIME IS EXPLICIT AND ZONED, because an embargo broken by an hour is broken.
 * A real `<time datetime>` with the zone named beside it, since the audience for
 * an embargo is almost always in several.
 *
 * PASSED IS A DIFFERENT SENTENCE — "lifted", not a disappearing component — so
 * anybody arriving late can tell the embargo ended rather than never existed.
 */
export function EmbargoNote({ until, timezone, lifted, whoCanSee, className }: {
  until: string | number | Date;
  /** Named beside the time — "London". */
  timezone?: string;
  lifted?: boolean;
  /** Who may see it in the meantime. */
  whoCanSee?: string;
  className?: string;
}) {
  return (
    <p data-slot="embargo-note" role="status" className={cn("text-sm", className)}>
      {lifted ? (
        <><span className="font-medium">Embargo lifted</span>
          <span className="text-muted-foreground"> — this can be shared.</span></>
      ) : (
        <>
          <span className="font-medium">
            Under embargo until{" "}
            <DateFormat date={until} withTime />
            {timezone ? ` ${timezone}` : ""}
          </span>
          {whoCanSee && <span className="text-muted-foreground"> — {whoCanSee} only.</span>}
        </>
      )}
    </p>
  );
}
