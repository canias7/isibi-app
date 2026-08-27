import { cn } from "@/lib/utils";
/**
 * Which areas somebody may enter — and when that stops.
 *
 * PERMISSIONS HAVE AN EXPIRY OR THEY ACCUMULATE FOREVER. Access granted for one
 * project outlives it by years, and after enough moves an ordinary employee can
 * open every door in the building. A permanent grant is shown as what it is
 * rather than as the unremarkable default.
 *
 * TIME-OF-DAY LIMITS ARE PART OF THE PERMISSION. Cleaning contractors,
 * out-of-hours engineers and shift staff all have legitimate access at hours
 * that would be alarming for anybody else, and a permission without hours is a
 * permission at 3am.
 *
 * WHO GRANTED IT IS RECORDED. An access review is a conversation with whoever
 * approved each grant, and an unattributed one is renewed by default because
 * nobody will take responsibility for removing it.
 *
 * ACCESS NOBODY HAS USED IS SURFACED. It is the cheapest thing to remove and
 * the least likely to be missed, which is what makes a review actually finish.
 */
export type ZoneGrant = {
  id: string;
  zone: string;
  /** Free text — "14 September 2026". */
  until?: string;
  /** "07:00–19:00, weekdays". */
  hours?: string;
  grantedBy?: string;
  /** Times used since it was granted. */
  timesUsed?: number;
};

export function ZonePermission({ person, grants, className }: {
  person?: string;
  grants: ZoneGrant[];
  className?: string;
}) {
  const permanent = grants.filter((g) => !g.until);
  const unused = grants.filter((g) => g.timesUsed === 0);
  return (
    <div data-slot="zone-permission" className={cn("space-y-1.5", className)}>
      {person && <p className="text-sm">{person}</p>}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {grants.map((g) => (
          <li key={g.id} className="space-y-0.5 px-3 py-1.5">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="min-w-0 flex-1">{g.zone}</span>
              <span className={cn("shrink-0 text-xs", g.until ? "text-muted-foreground" : "font-medium")}>
                {g.until ? `Until ${g.until}` : "No end date"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {g.hours ?? "Any hour, any day"}
              {g.grantedBy ? ` · granted by ${g.grantedBy}` : " · nobody recorded as granting it"}
              {g.timesUsed !== undefined && ` · used ${g.timesUsed} ${g.timesUsed === 1 ? "time" : "times"}`}
            </p>
          </li>
        ))}
      </ul>
      {permanent.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {permanent.length} {permanent.length === 1 ? "grant has" : "grants have"} no end date. Those are the ones that accumulate.
        </p>
      )}
      {unused.length > 0 && (
        <p className="text-xs">
          {unused.length} of these {unused.length === 1 ? "has" : "have"} never been used — the easiest to remove.
        </p>
      )}
    </div>
  );
}
