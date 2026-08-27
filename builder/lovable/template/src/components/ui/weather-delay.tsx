import { cn, toDate } from "@/lib/utils";
/**
 * Weather that stopped work — recorded as a claim, not a complaint.
 *
 * IT RECORDS WHAT WAS STOPPED, NOT JUST THAT IT RAINED. A delay claim needs the
 * link between the conditions and the activity: rain does not stop groundworks
 * in a trench with a pump, and it absolutely stops a roof screed. Naming the
 * affected activity is what makes the entry usable.
 *
 * THE MEASURED CONDITION IS RECORDED WHERE THERE IS ONE. Wind speed against a
 * crane's limit is checkable; "too windy" is an opinion, and the contract talks
 * in numbers.
 *
 * HOURS LOST ARE COUNTED SEPARATELY FROM DAYS. Half a day appears in a monthly
 * total as a whole day or as nothing at all depending on who fills it in, and
 * both are wrong.
 *
 * IT SAYS WHETHER IT WAS CLAIMED. A delay recorded and never submitted is worse
 * than one not recorded, because everybody believes it was handled.
 */
export function WeatherDelay({ date, condition, measured, stopped = [], hoursLost, claimed, claimReference, className }: {
  /** ISO date. */
  date: string;
  /** "Heavy rain from 11am". */
  condition: string;
  /** "38 mph gusts against a 25 mph crane limit". */
  measured?: string;
  /** Which activities stopped. */
  stopped?: string[];
  hoursLost?: number;
  claimed?: boolean;
  claimReference?: string;
  className?: string;
}) {
  const d = toDate(date);
  const ok = !Number.isNaN(d.getTime());
  return (
    <li data-slot="weather-delay" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium">
          {ok ? <time dateTime={date}>{d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</time> : date}
        </span>
        <span className="min-w-0 flex-1">{condition}</span>
        {hoursLost !== undefined && (
          <span className="shrink-0 tabular-nums">{hoursLost} {hoursLost === 1 ? "hour" : "hours"}</span>
        )}
      </p>
      {measured && <p className="text-xs text-muted-foreground">{measured}</p>}
      <p className="text-xs text-muted-foreground">
        {stopped.length
          ? `Stopped: ${stopped.join(", ")}`
          : <span className="font-medium text-foreground">No activity named — this will not support a claim</span>}
      </p>
      <p className={cn("text-xs", claimed ? "text-muted-foreground" : "font-medium")}>
        {claimed
          ? `Claimed${claimReference ? ` · ${claimReference}` : ""}`
          : "Not claimed yet"}
      </p>
    </li>
  );
}
