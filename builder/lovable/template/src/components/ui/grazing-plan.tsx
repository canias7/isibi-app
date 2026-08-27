import { cn } from "@/lib/utils";
/**
 * Which paddock the stock are on, and how long the rest have had to recover.
 *
 * REST DAYS ARE THE WHOLE OF ROTATIONAL GRAZING. Returning to a paddock too
 * soon takes the regrowth before the plant has recovered its reserves, and the
 * sward degrades over a season in a way nobody attributes to the rotation. The
 * days-since-grazed number is what prevents it.
 *
 * IT FLAGS PADDOCKS NOT YET READY rather than only showing what is available.
 * The temptation when grass is short is to go back early, and a list that shows
 * only "next" hides that the next one has had eleven days.
 *
 * COVER IS SHOWN WHERE MEASURED, because rest days alone are a proxy — growth
 * rates vary tenfold across a season, so twenty days in May and in August are
 * different amounts of grass.
 *
 * NO STOCKING CALCULATION. Converting animals to livestock units and dividing
 * by cover depends on class, weight and target intake, and a component guessing
 * those produces a confident number nobody should act on.
 */
export type Paddock = {
  id: string;
  name: string;
  area?: number;
  /** Days since it was last grazed. */
  restDays?: number;
  /** Measured cover, in the caller's own unit. */
  cover?: number;
  current?: boolean;
};

export function GrazingPlan({ paddocks, minimumRest = 21, coverUnit = "kg DM/ha", areaUnit = "ha", className }: {
  paddocks: Paddock[];
  /** Days a paddock needs before it can be grazed again. */
  minimumRest?: number;
  coverUnit?: string;
  areaUnit?: string;
  className?: string;
}) {
  const on = paddocks.find((p) => p.current);
  const ready = paddocks.filter((p) => !p.current && (p.restDays ?? 0) >= minimumRest);
  return (
    <div data-slot="grazing-plan" className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        {on ? <>Stock on <span className="font-medium">{on.name}</span></> : <span className="text-muted-foreground">Nothing grazing</span>}
        <span className="text-muted-foreground tabular-nums"> · {ready.length} rested enough to go back to</span>
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {paddocks.map((p) => {
          const short = !p.current && (p.restDays ?? 0) < minimumRest;
          return (
            <li key={p.id} className="flex items-start gap-3 px-3 py-1.5">
              <span className="min-w-0 flex-1">
                {p.name}
                {p.current && <span className="ms-1.5 text-xs font-medium">stock here now</span>}
                {p.area !== undefined && (
                  <span className="block text-xs tabular-nums text-muted-foreground">{p.area} {areaUnit}</span>
                )}
              </span>
              <span className="shrink-0 text-end text-xs">
                {p.restDays !== undefined && (
                  <span className={cn("block tabular-nums", short ? "font-medium" : "text-muted-foreground")}>
                    {p.restDays} days rest{short ? " — too soon" : ""}
                  </span>
                )}
                {p.cover !== undefined && (
                  <span className="block tabular-nums text-muted-foreground">{p.cover.toLocaleString()} {coverUnit}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
