import { cn } from "@/lib/utils";
/**
 * A volunteer on a list — with what stops them being rostered.
 *
 * A BLOCKER IS SHOWN ON THE ROW, not discovered when a shift is assigned. An
 * expired check, an unsigned agreement or an unfinished induction all mean the
 * person cannot be put on a rota, and an organiser filling gaps at nine on a
 * Friday evening needs to see it there.
 *
 * AVAILABILITY IS IN THE VOLUNTEER'S OWN WORDS. Structured availability grids
 * are answered wrongly by almost everybody, and "Tuesdays and alternate
 * Saturdays, not August" is both more accurate and more useful than a grid of
 * ticks.
 *
 * IT SHOWS WHEN THEY LAST VOLUNTEERED. Somebody who has not been in for six
 * months has usually drifted rather than decided, and that is the moment a
 * phone call brings them back — a list that only shows active people never
 * surfaces it.
 *
 * NO LEAGUE TABLE OF HOURS. Ranking volunteers by hours turns a gift into a
 * performance measure, which is the fastest way to lose the people giving the
 * least and needing it most.
 */
export function VolunteerRow({ name, roles = [], availabilityNote, lastVolunteered, monthsSinceLast, blockers = [], startedOn, className }: {
  name: string;
  roles?: string[];
  /** Their own words, not a grid. */
  availabilityNote?: string;
  /** Free text — "14 February". */
  lastVolunteered?: string;
  monthsSinceLast?: number;
  /** What stops them being rostered. */
  blockers?: string[];
  startedOn?: string;
  className?: string;
}) {
  const drifting = monthsSinceLast !== undefined && monthsSinceLast >= 4;
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {name}
          {roles.length > 0 && <span className="block text-xs text-muted-foreground">{roles.join(" · ")}</span>}
        </span>
        {blockers.length > 0 && (
          <span className="shrink-0 text-xs font-medium">Cannot be rostered</span>
        )}
      </p>
      {blockers.length > 0 && (
        <ul className="text-xs font-medium">
          {blockers.map((b, i) => (
            <li key={i} className="flex gap-2"><span aria-hidden="true" className="font-normal text-muted-foreground">—</span><span>{b}</span></li>
          ))}
        </ul>
      )}
      {availabilityNote && <p className="text-xs">{availabilityNote}</p>}
      <p className={cn("text-xs", drifting ? "font-medium" : "text-muted-foreground")}>
        {lastVolunteered ? `Last in ${lastVolunteered}` : "Has not volunteered yet"}
        {startedOn && ` · joined ${startedOn}`}
      </p>
      {drifting && (
        <p className="text-xs text-muted-foreground">
          People drift rather than decide to stop. A call now usually brings them back.
        </p>
      )}
    </li>
  );
}
