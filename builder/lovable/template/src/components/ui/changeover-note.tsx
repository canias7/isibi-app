import { cn } from "@/lib/utils";
/**
 * Switching a machine from one product to the next.
 *
 * THE ORDER OF JOBS DECIDES THE LENGTH, and that is the point of showing it.
 * Going from pale to dark needs a rinse; dark to pale needs a strip-down.
 * Sequencing is where changeover time is actually saved, and a note that hides
 * the dependency makes the schedule look arbitrary.
 *
 * WHAT PHYSICALLY HAS TO CHANGE IS LISTED. Tooling, a die, a colour purge, a
 * new program — each is a different person and a different store, and a single
 * duration tells nobody what to fetch before the line stops.
 *
 * THE FIRST-OFF CHECK IS PART OF IT. A changeover is not finished when the
 * machine runs; it is finished when a part passes. Leaving that out is how a
 * changeover "takes 20 minutes" and consumes an hour.
 *
 * THE ESTIMATE IS SHOWN AGAINST THE LAST ACTUAL, because the standard time on a
 * changeover is usually optimistic and the last real one is the better guess.
 */
export function ChangeoverNote({ machine, fromProduct, toProduct, estimateMinutes, lastActualMinutes, steps = [], needsFirstOff = true, sequenceNote, className }: {
  machine?: string;
  fromProduct: string;
  toProduct: string;
  estimateMinutes?: number;
  /** How long it took last time. */
  lastActualMinutes?: number;
  /** What has to physically change. */
  steps?: string[];
  needsFirstOff?: boolean;
  /** Why this order — "pale to dark needs only a rinse". */
  sequenceNote?: string;
  className?: string;
}) {
  const fmt = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`);
  const worse = estimateMinutes !== undefined && lastActualMinutes !== undefined && lastActualMinutes > estimateMinutes;
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p>
        <span className="font-medium">{fromProduct} <span aria-hidden="true">→</span> {toProduct}</span>
        {machine && <span className="block text-xs text-muted-foreground">{machine}</span>}
      </p>
      {(estimateMinutes !== undefined || lastActualMinutes !== undefined) && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {estimateMinutes !== undefined && `${fmt(estimateMinutes)} allowed`}
          {lastActualMinutes !== undefined && `${estimateMinutes !== undefined ? " · " : ""}${fmt(lastActualMinutes)} last time`}
        </p>
      )}
      {worse && (
        <p className="text-xs font-medium">
          Last one ran over — plan for the actual, not the standard.
        </p>
      )}
      {steps.length > 0 && (
        <ul className="space-y-0.5 text-xs">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true" className="text-muted-foreground">—</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
      {needsFirstOff && (
        <p className="text-xs font-medium">Not finished until a first-off part passes.</p>
      )}
      {sequenceNote && <p className="text-xs text-muted-foreground">{sequenceNote}</p>}
    </div>
  );
}
