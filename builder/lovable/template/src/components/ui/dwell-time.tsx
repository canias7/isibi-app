import { cn } from "@/lib/utils";
/**
 * How long a vehicle waited — the number that turns into a charge.
 *
 * THE FREE PERIOD IS SHOWN WITH THE ELAPSED TIME. Waiting is free up to an
 * agreed point and billed after it, and a raw "waited 2h 40m" cannot be judged
 * without knowing where the line was — which is exactly the disputed figure on
 * every waiting-time invoice.
 *
 * ARRIVAL AND START-OF-UNLOAD ARE SEPARATE TIMES. The gap between them is the
 * waiting; the unloading itself usually is not chargeable. Recording only a
 * total makes the two indistinguishable and the claim unarguable.
 *
 * WHO CAUSED IT MATTERS. A vehicle waiting because it arrived before its slot
 * is not chargeable; one waiting because the bay was blocked is. That
 * attribution is the whole of a waiting-time dispute.
 *
 * THE RUNNING CHARGE IS SHOWN WHERE THE CALLER HAS A RATE, since seeing it
 * accrue is what prompts somebody to escalate rather than to keep waiting.
 */
export function DwellTime({ arrivedAt, startedAt, freeMinutes = 120, elapsedMinutes, rate, charge, cause, className }: {
  /** Free text — "09:12". */
  arrivedAt?: string;
  /** When unloading began. */
  startedAt?: string;
  /** Minutes allowed before charging. */
  freeMinutes?: number;
  /** Total minutes on site. */
  elapsedMinutes: number;
  /** Pre-formatted — "£45 an hour". */
  rate?: string;
  /** Pre-formatted running charge. */
  charge?: string;
  /** Who caused the wait. */
  cause?: string;
  className?: string;
}) {
  const over = Math.max(0, elapsedMinutes - freeMinutes);
  const fmt = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`);
  return (
    <div data-slot="dwell-time" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className={cn("tabular-nums", over > 0 && "font-medium")}>{fmt(elapsedMinutes)}</span>
        <span className="text-muted-foreground tabular-nums"> on site · {fmt(freeMinutes)} free</span>
      </p>
      {/* Joined, not interleaved — the separator was conditional on
          `startedAt` while its fallback still rendered, giving
          "Arrived 09:12unloading not started". */}
      {(arrivedAt || startedAt) && (
        <p className="text-xs text-muted-foreground">
          {[
            arrivedAt ? `Arrived ${arrivedAt}` : null,
            startedAt ? `unloading started ${startedAt}` : arrivedAt ? "unloading not started" : null,
          ].filter(Boolean).join(" · ")}
        </p>
      )}
      {over > 0 && (
        <p className="text-xs">
          <span className="font-medium tabular-nums">{fmt(over)} chargeable</span>
          {rate && <span className="text-muted-foreground"> at {rate}</span>}
          {charge && <span className="text-muted-foreground tabular-nums"> · {charge}</span>}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {cause ? `Waiting caused by ${cause}.` : "Nobody has recorded why it waited — this will be disputed."}
      </p>
    </div>
  );
}
