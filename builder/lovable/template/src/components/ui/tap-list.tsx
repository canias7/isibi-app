import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
/**
 * What is pouring. A producer's stock changes weekly and that IS the news, so
 * this is a taproom's front page rather than a menu.
 *
 * STRENGTH IS NEVER OPTIONAL and never small. ABV is the one number that
 * changes what somebody orders and how they get home, so it sits at the same
 * weight as the price rather than in grey beside it.
 *
 * OFF is shown, struck AND worded. A regular scanning for the one they had last
 * time needs to see it has gone, not fail to find it and assume the list is
 * short — and a line through text is invisible to a screen reader, so
 * "off" is written.
 *
 * `pouring` is a nullable position rather than a boolean list: a taproom
 * numbers its taps, and "tap 4" is how the staff and the regulars both talk.
 */
export type Pour = {
  name: string;
  style: string;
  abv: number;
  /** Tap number, when the room has them. */
  tap?: number | null;
  price?: string | null;
  serve?: string | null;
  note?: string | null;
  off?: boolean;
};
export function TapList({ pours, heading, className }: {
  pours: Pour[]; heading?: string; className?: string;
}) {
  if (!pours.length) return null;
  return (
    <div className={cn("", className)}>
      {heading && <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{heading}</p>}
      <ul className={cn("divide-y divide-border border-y border-border", heading && "mt-3")}>
        {pours.map((p, i) => (
          <li key={`${p.name}-${i}`} className={cn("flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5", p.off && "opacity-70")}>
            {p.tap != null && (
              <span className="w-8 shrink-0 text-sm tabular-nums text-muted-foreground">{p.tap}</span>
            )}
            <span className="min-w-0 flex-1">
              <span className={cn("text-sm font-medium", p.off && "line-through")}>{p.name}</span>
              <span className="block text-sm text-muted-foreground">
                {p.style}{p.serve && <> · {p.serve}</>}
              </span>
              {p.note && <span className="mt-0.5 block text-sm text-muted-foreground">{p.note}</span>}
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">{p.abv.toFixed(1)}%</span>
            {p.price && <span className="w-16 shrink-0 text-right text-sm tabular-nums">{p.price}</span>}
            {p.off && <Badge variant="secondary" className="font-normal">Off</Badge>}
          </li>
        ))}
      </ul>
    </div>
  );
}
