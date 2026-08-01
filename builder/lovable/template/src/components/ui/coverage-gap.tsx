import { cn } from "@/lib/utils";
/**
 * Times nobody is on — the holes in a rota, named.
 *
 * A ROTA IS READ AS COMPLETE UNLESS SOMETHING SAYS OTHERWISE. Whoever builds it
 * sees the shifts they added, not the hours they did not — so a Tuesday
 * afternoon with nobody on looks exactly like a Tuesday afternoon they decided
 * not to staff. This lists the holes explicitly.
 *
 * IT SEPARATES "NOBODY" FROM "NOT ENOUGH". Zero cover is a closed shop; one
 * person where two are needed is a bad afternoon — different urgency, different
 * fix, and a single "understaffed" flag hides which.
 *
 * IT COUNTS THE HOURS. Six scattered gaps of twenty minutes and one gap of four
 * hours are the same number of rows, and the total is what says which rota this
 * is.
 *
 * NO SUGGESTED FIX. Who covers a gap depends on contracts, overtime rules and
 * who has already done six days, and a component proposing a name would be
 * wrong most of the time.
 */
export type Gap = { id: string; when: string; have: number; need: number; hours?: number };

export function CoverageGap({ gaps, allCoveredNote = "Everything is covered", className }: {
  gaps: Gap[];
  allCoveredNote?: string;
  className?: string;
}) {
  if (!gaps.length) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{allCoveredNote}</p>;
  }
  const empty = gaps.filter((g) => g.have === 0);
  const hours = gaps.reduce((n, g) => n + (g.hours ?? 0), 0);
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        <span className="font-medium tabular-nums">{gaps.length}</span>
        {gaps.length === 1 ? " gap" : " gaps"}
        {hours > 0 && <span className="text-muted-foreground"> · {hours} {hours === 1 ? "hour" : "hours"} uncovered</span>}
        {empty.length > 0 && (
          <span className="block text-xs">
            <span className="font-medium tabular-nums">{empty.length}</span> with nobody on at all
          </span>
        )}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {gaps.map((g) => (
          <li key={g.id} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
            <span className={cn(g.have === 0 && "font-medium")}>{g.when}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {g.have === 0
                ? "nobody on"
                : `${g.have} on, ${g.need} needed`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
