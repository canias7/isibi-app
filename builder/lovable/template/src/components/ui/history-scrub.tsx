import { cn, isoAttr, toDate } from "@/lib/utils";
/**
 * A timeline you can click along, with the gaps to scale.
 *
 * The difference from `revision-slider`: that one steps through versions
 * evenly, one notch each. This places them by WHEN THEY HAPPENED, so forty
 * edits in one afternoon cluster and the quiet fortnight after is visibly
 * empty. That shape is the information — it is where somebody looking for
 * "around when it broke" actually aims.
 *
 * Every marker is a real `<button>` in source order with a date in its
 * accessible name, so the whole thing is tabbable and reads sensibly even
 * though it is positioned absolutely. A row of divs with click handlers is the
 * usual implementation and is unreachable without a mouse.
 *
 * A SINGLE POINT SITS IN THE MIDDLE rather than at 0%, and identical timestamps
 * do not stack invisibly at one edge: with no span there is no meaningful
 * position, and the honest answer is the centre.
 */
export function HistoryScrub({ points, activeKey, onPick, className }: {
  points: { key: string; at: string | number | Date; label?: string }[];
  activeKey?: string;
  onPick: (key: string) => void;
  className?: string;
}) {
  if (!points.length) return null;
  const times = points.map((p) => toDate(p.at).getTime());
  const min = Math.min(...times), max = Math.max(...times);
  const span = max - min;

  return (
    <div data-slot="history-scrub" className={cn("flex flex-col gap-1", className)}>
      <div className="relative h-8">
        <div aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        {points.map((p, i) => {
          const pos = span > 0 ? ((times[i] - min) / span) * 100 : 50;
          const active = p.key === activeKey;
          return (
            <button key={p.key} type="button" onClick={() => onPick(p.key)}
              aria-label={p.label ?? toDate(p.at).toLocaleString()}
              aria-current={active ? "true" : undefined}
              style={{ left: `${pos}%` }}
              className={cn(
                "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border",
                active ? "size-3.5 border-foreground bg-foreground" : "size-2.5 border-border bg-background hover:border-foreground",
              )} />
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <time dateTime={isoAttr(min)}>{toDate(min).toLocaleDateString()}</time>
        <time dateTime={isoAttr(max)}>{toDate(max).toLocaleDateString()}</time>
      </div>
    </div>
  );
}
