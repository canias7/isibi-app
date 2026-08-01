import { cn } from "@/lib/utils";
/**
 * What actually happened today — measured in pages, not in feeling.
 *
 * PAGES SHOT AGAINST PAGES SCHEDULED IS THE MEASURE. Scenes completed is
 * misleading because scenes vary from an eighth of a page to four, and a day
 * that finished six short scenes may be well behind. Pages is the unit the
 * schedule is built in, so it is the unit a day is judged in.
 *
 * WHAT WAS NOT SHOT IS CARRIED, NAMED. Scenes dropped for time do not
 * disappear; they land on another day, and a report that only counts what was
 * achieved hides the debt accumulating behind it.
 *
 * OVERTIME AND TURNAROUND ARE RECORDED because they are contractual and
 * because a short turnaround is a safety matter — a crew back in nine hours
 * after a fourteen-hour day is how people are hurt driving home.
 *
 * IT DOES NOT APPORTION BLAME. A wrap report is a measurement, and a form with
 * a "reason for delay" field pointed at a department produces a form that is
 * filled in defensively and is then useless.
 */
export function WrapReport({ day, scheduledEighths, shotEighths, scenesCarried = [], wrappedAt, overtimeMinutes, turnaroundHours, minimumTurnaround = 11, incidents = [], className }: {
  day?: string | number;
  /** Scheduled length in eighths of a page. */
  scheduledEighths?: number;
  shotEighths?: number;
  /** Scenes pushed to another day. */
  scenesCarried?: string[];
  /** Free text — "19:40". */
  wrappedAt?: string;
  overtimeMinutes?: number;
  /** Hours before the next call. */
  turnaroundHours?: number;
  minimumTurnaround?: number;
  /** Anything that has to be reported. */
  incidents?: string[];
  className?: string;
}) {
  const pages = (e: number) =>
    `${Math.floor(e / 8) || ""}${e % 8 ? ` ${e % 8}/8` : ""}`.trim() || "0";
  const behind =
    scheduledEighths !== undefined && shotEighths !== undefined ? scheduledEighths - shotEighths : undefined;
  const shortTurnaround = turnaroundHours !== undefined && turnaroundHours < minimumTurnaround;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        {day !== undefined ? `Day ${day}` : "Wrap"}
        {wrappedAt && <span className="text-muted-foreground"> · wrapped {wrappedAt}</span>}
      </p>
      {shotEighths !== undefined && (
        <p className="text-xs tabular-nums">
          <span className={cn(behind !== undefined && behind > 0 && "font-medium")}>
            {pages(shotEighths)} pages shot
          </span>
          {scheduledEighths !== undefined && (
            <span className="text-muted-foreground"> of {pages(scheduledEighths)} scheduled</span>
          )}
        </p>
      )}
      {behind !== undefined && behind !== 0 && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {behind > 0 ? `${pages(behind)} pages behind` : `${pages(-behind)} pages ahead`}.
        </p>
      )}
      {scenesCarried.length > 0 && (
        <p className="text-xs font-medium">
          Carried to another day: {scenesCarried.join(", ")}.
        </p>
      )}
      {(overtimeMinutes !== undefined || turnaroundHours !== undefined) && (
        <p className={cn("text-xs tabular-nums", shortTurnaround ? "font-medium" : "text-muted-foreground")}>
          {overtimeMinutes !== undefined && `${overtimeMinutes} minutes of overtime`}
          {overtimeMinutes !== undefined && turnaroundHours !== undefined ? " · " : ""}
          {turnaroundHours !== undefined && `${turnaroundHours} hours before the next call`}
        </p>
      )}
      {shortTurnaround && (
        <p className="text-xs font-medium">
          Under the {minimumTurnaround}-hour turnaround. That is a safety matter, not a scheduling one.
        </p>
      )}
      {incidents.length > 0 && (
        <ul className="text-xs">
          {incidents.map((i, n) => (
            <li key={n} className="flex gap-2"><span aria-hidden="true">—</span><span>{i}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}
