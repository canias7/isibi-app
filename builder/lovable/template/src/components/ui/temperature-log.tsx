import { cn } from "@/lib/utils";
/**
 * A cold chain's temperature history — with the breaches counted.
 *
 * A BREACH IS DEFINED BY TIME AS WELL AS TEMPERATURE. Two minutes above range
 * while a door was open is not a breach; forty minutes is. A log that flags
 * every excursion produces so many alarms that the real one is ignored, so the
 * duration is part of the judgement.
 *
 * THE HIGHEST AND LOWEST ARE SHOWN, not an average. An average across a journey
 * hides an hour at the wrong temperature entirely, and the extremes are what a
 * quality decision turns on.
 *
 * A GAP IN THE RECORD IS TREATED AS A PROBLEM. A logger that stopped for six
 * hours is not evidence that the temperature held — it is the absence of
 * evidence, and it must not read as a clean journey.
 *
 * SEGMENTS, NOT A LINE CHART. This is a summary that gets attached to a
 * delivery note; the shape of the excursions is what matters and a chart
 * library is not worth shipping for it.
 */
export type TempReading = { at: string; celsius: number; missing?: boolean };

export function TemperatureLog({ readings, min, max, breachMinutes = 15, breaches = [], className }: {
  readings: TempReading[];
  /** Allowed range. */
  min: number;
  max: number;
  /** How long outside the range counts as a breach. */
  breachMinutes?: number;
  /** Excursions the caller has judged. */
  breaches?: { from: string; to: string; peak: number; minutes: number }[];
  className?: string;
}) {
  const values = readings.filter((r) => !r.missing).map((r) => r.celsius);
  const lowest = values.length ? Math.min(...values) : null;
  const highest = values.length ? Math.max(...values) : null;
  const gaps = readings.filter((r) => r.missing).length;
  const real = breaches.filter((b) => b.minutes >= breachMinutes);
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-sm">
        {real.length === 0 && gaps === 0
          ? <span className="text-muted-foreground">Stayed in range the whole way</span>
          : <>
              {real.length > 0 && (
                <><span className="font-medium tabular-nums">{real.length}</span> {real.length === 1 ? "breach" : "breaches"}</>
              )}
              {real.length > 0 && gaps > 0 && <span className="text-muted-foreground"> · </span>}
              {gaps > 0 && <span className="font-medium">{gaps} gaps in the record</span>}
            </>}
      </p>
      <p className="text-xs text-muted-foreground tabular-nums">
        Range {min}°C to {max}°C
        {lowest !== null && highest !== null && ` · saw ${lowest}°C to ${highest}°C`}
      </p>
      <div aria-hidden="true" className="flex gap-px">
        {readings.map((r, i) => (
          <span key={i} title={`${r.at} — ${r.missing ? "no reading" : `${r.celsius}°C`}`}
            className={cn("h-5 flex-1 rounded-sm",
              r.missing ? "border border-dashed border-border"
                : r.celsius > max || r.celsius < min
                  ? "bg-[repeating-linear-gradient(45deg,var(--color-foreground)_0_2px,transparent_2px_4px)]"
                  : "bg-foreground")} />
        ))}
      </div>
      {real.map((b) => (
        <p key={`${b.from}-${b.to}`} className="text-xs">
          <span className="font-medium tabular-nums">{b.peak}°C</span>
          <span className="text-muted-foreground tabular-nums"> for {b.minutes} {b.minutes === 1 ? "minute" : "minutes"}, {b.from} to {b.to}</span>
        </p>
      ))}
      {gaps > 0 && (
        <p className="text-xs text-muted-foreground">
          A gap is not evidence the temperature held — it is no evidence at all.
        </p>
      )}
    </div>
  );
}
