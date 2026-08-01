import { DateFormat } from "@/components/ui/date-format";
import { TimeSince } from "@/components/ui/time-since";
import { cn } from "@/lib/utils";
/**
 * When the repeating thing happens next.
 *
 * A recurrence rule is written once and then trusted forever, which is how a
 * report ends up going out on the wrong Sunday for a year. THE ONLY HONEST
 * CHECK IS THE NEXT ACTUAL DATE, computed from the rule and shown back — this
 * is the component that closes that loop.
 *
 * The rule is restated in plain words beside the date, because "the 4th Sunday"
 * and "every 4 weeks" produce the same answer this month and different answers
 * in three months' time. Seeing both together is what catches the mistake.
 *
 * PAUSED IS ITS OWN STATE, not a missing date. A blank where a date belongs
 * reads as a bug; "Paused — no runs scheduled" is a setting somebody chose and
 * can undo.
 *
 * The relative form sits beside the absolute one, never instead of it: "in 3
 * days" is what people want at a glance and useless for anything they have to
 * act on.
 */
export function NextOccurrence({ at, rule, paused, pausedNote = "Paused — nothing scheduled", className }: {
  /** The next run. Omit when there is not one. */
  at?: string | number | Date | null;
  /** The rule in plain words — "Every 4 weeks on Sunday". */
  rule?: string;
  paused?: boolean;
  pausedNote?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {paused || !at ? (
        <p className="text-sm font-medium">{paused ? pausedNote : "No next run"}</p>
      ) : (
        <p className="text-sm">
          <span className="font-medium">Next</span>{" "}
          <time dateTime={new Date(at).toISOString()}><DateFormat date={at} withTime /></time>
          <span className="text-muted-foreground"> · <TimeSince at={at} /></span>
        </p>
      )}
      {rule && <p className="text-xs text-muted-foreground">{rule}</p>}
    </div>
  );
}
