import { cn } from "@/lib/utils";
/**
 * Everything that expires, in one list, soonest first.
 *
 * EXPIRIES ARE SCATTERED AND THAT IS WHY THEY LAPSE. An insurance certificate
 * lives on the company record, a licence on a person, a domain in a billing
 * screen — each has a date and nobody has the list. Gathering them is the
 * entire feature; the individual dates were already there.
 *
 * ALREADY-EXPIRED ITEMS COME FIRST AND ARE COUNTED SEPARATELY, because a
 * lapsed certificate is not a deadline, it is a live problem — and mixing it
 * into "expiring soon" is how it stays there for a month.
 *
 * IT NAMES WHO IS RESPONSIBLE where the caller knows. A list of expiring things
 * with no owner is a list somebody reads and does not act on, and the owner is
 * usually recorded somewhere already.
 *
 * DAYS ARE PASSED IN, not computed from a browser clock — the same rule
 * `credential-expiry` follows, since a component disagreeing with the record
 * about whether something has lapsed is worse than one that says nothing.
 */
export type ExpiringItem = {
  id: string;
  label: string;
  /** Free text — "14 August 2026". */
  on: string;
  /** Negative when expired. */
  daysLeft: number;
  owner?: string;
  kind?: string;
};

export function ExpiryAudit({ items, warnWithin = 60, className }: {
  items: ExpiringItem[];
  warnWithin?: number;
  className?: string;
}) {
  const sorted = [...items].sort((a, b) => a.daysLeft - b.daysLeft);
  const shown = sorted.filter((i) => i.daysLeft <= warnWithin);
  const expired = shown.filter((i) => i.daysLeft < 0);
  if (!shown.length) {
    return <p data-slot="expiry-audit" className={cn("text-sm text-muted-foreground", className)}>Nothing expires in the next {warnWithin} days.</p>;
  }
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        {expired.length > 0 && (
          <><span className="font-medium tabular-nums">{expired.length}</span> already expired · </>
        )}
        <span className="tabular-nums">{shown.length - expired.length}</span> expiring within {warnWithin} days
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {shown.map((i) => (
          <li key={i.id} className="flex items-start gap-3 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className={cn("block", i.daysLeft < 0 && "font-medium")}>{i.label}</span>
              <span className="block text-xs text-muted-foreground">
                {i.kind}
                {i.kind && i.owner ? " · " : ""}
                {i.owner}
              </span>
            </span>
            <span className="shrink-0 text-end text-xs">
              <span className={cn("block", i.daysLeft < 0 && "font-medium")}>{i.on}</span>
              <span className="block text-muted-foreground tabular-nums">
                {i.daysLeft < 0 ? `${Math.abs(i.daysLeft)} days ago` : `in ${i.daysLeft} days`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
