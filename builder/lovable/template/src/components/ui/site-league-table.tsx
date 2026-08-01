import { cn } from "@/lib/utils";
/**
 * Ranking branches — with the caveats that make a ranking honest.
 *
 * THE GAP BETWEEN POSITIONS IS SHOWN, because most league tables of branches
 * are noise. Where first and fifteenth differ by 2%, the ranking is measuring
 * rounding, and printing the spread stops a manager being congratulated or
 * carpeted for it.
 *
 * SITES ARE EXCLUDED WHERE COMPARISON IS UNFAIR, and the exclusions are listed
 * rather than dropped. A branch trading through building work sits bottom for
 * reasons nobody there controls, and quietly removing it looks like hiding
 * something.
 *
 * THE FIGURE IS NORMALISED AND THE BASIS IS PRINTED. A table of raw totals ranks
 * branches by size, which everybody already knows.
 *
 * NO PODIUM, NO MEDALS, NO BOTTOM-THREE HIGHLIGHT. Highlighting the bottom of a
 * branch table produces managers who manage the measure — and the measure is
 * usually the one thing they can move without helping a customer.
 */
export type LeagueEntry = { id: string; site: string; value: number; excluded?: boolean; excludedReason?: string };

export function SiteLeagueTable({ metric, basis, entries, unit, className }: {
  metric?: string;
  /** What the figure is divided by. */
  basis?: string;
  entries: LeagueEntry[];
  unit?: string;
  className?: string;
}) {
  const ranked = entries.filter((e) => !e.excluded).sort((a, b) => b.value - a.value);
  const excluded = entries.filter((e) => e.excluded);
  const top = ranked[0]?.value;
  const bottom = ranked[ranked.length - 1]?.value;
  const spread = top !== undefined && bottom !== undefined && bottom !== 0 ? (top - bottom) / Math.abs(bottom) : undefined;
  const u = unit ?? "";
  return (
    <div className={cn("space-y-1.5", className)}>
      {(metric || basis) && (
        <p className="text-sm">
          {metric}
          {basis && <span className="text-muted-foreground"> · {basis}</span>}
        </p>
      )}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {ranked.map((e, i) => (
          <li key={e.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1">{e.site}</span>
            <span className="shrink-0 tabular-nums">{u}{e.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
      {spread !== undefined && (
        <p className={cn("text-xs tabular-nums", spread < 0.1 ? "font-medium" : "text-muted-foreground")}>
          {spread < 0.1
            ? `Top to bottom is ${Math.round(spread * 100)}% — that is close enough that this ranking is mostly noise.`
            : `Top to bottom is ${Math.round(spread * 100)}%.`}
        </p>
      )}
      {excluded.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Not ranked</p>
          <ul className="text-xs text-muted-foreground">
            {excluded.map((e) => (
              <li key={e.id} className="flex gap-2">
                <span aria-hidden="true">—</span>
                <span>{e.site}{e.excludedReason ? `, ${e.excludedReason}` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
